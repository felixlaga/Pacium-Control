import {
  ClientMessageSchema,
  MAX_APPLICATION_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  encodeTerminalDataFrame,
  queueDecisionError,
  type ClientMessage,
  type QueueDecisionRequestIdentity,
  type ServerMessage,
} from "@pacium/contracts";
import { WebSocket, WebSocketServer, type RawData } from "ws";

import type { ServerConfig } from "./config.js";
import {
  PaciumConfigStoreError,
  type PaciumConfigStore,
} from "./pacium-config-store.js";
import { PaciumContextService } from "./pacium-context-service.js";
import { presetCapabilities } from "./launch-presets.js";
import { classifyRequestAccess, type RequestAccess } from "./remote-access.js";
import {
  createQueueDecisionService,
  type QueueDecisionService,
} from "./queue-decision-service.js";
import { QueueDeliveryService } from "./queue-delivery-service.js";
import { QueueDecisionStore } from "./queue-decision-store.js";
import { withQueueSourceConflicts } from "./queue-conflict-model.js";
import { QueueObserver } from "./queue-observer.js";
import { QueueReconciliationService } from "./queue-reconciliation-service.js";
import { SessionError, type SessionManager } from "./session-manager.js";

interface ConnectedClient {
  socket: WebSocket;
  subscriptions: Set<string>;
}

const MAX_SOCKET_BUFFER_BYTES = 4 * 1024 * 1024;

export class WebSocketHub {
  public readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_APPLICATION_MESSAGE_BYTES,
    perMessageDeflate: false,
    handleProtocols(protocols) {
      return protocols.has("pacium.v1") ? "pacium.v1" : false;
    },
  });

  private readonly clients = new Set<ConnectedClient>();
  private readonly unsubscribeData: () => void;
  private readonly unsubscribeSessions: () => void;
  private readonly unsubscribeQueue: () => void;

  public constructor(
    private readonly config: ServerConfig,
    private readonly sessions: SessionManager,
    private readonly paciumConfig: PaciumConfigStore,
    private readonly queueObserver: QueueObserver = new QueueObserver(),
    private readonly queueState: QueueDecisionStore = new QueueDecisionStore(
      config.dataDirectory,
    ),
    private readonly queueDecisions: QueueDecisionService = createQueueDecisionService(
      queueObserver,
      queueState,
    ),
    private readonly queueDeliveries: QueueDeliveryService = new QueueDeliveryService(
      paciumConfig,
      queueObserver,
      queueState,
      sessions,
    ),
    private readonly queueReconciliation: QueueReconciliationService = new QueueReconciliationService(
      queueState,
      {
        isDeliveryActive: (deliveryId) => queueDeliveries.isActive(deliveryId),
      },
    ),
    private readonly paciumContext: PaciumContextService = new PaciumContextService(
      paciumConfig,
      queueState,
      {
        isDeliveryActive: (deliveryId) => queueDeliveries.isActive(deliveryId),
      },
    ),
  ) {
    this.server.on("connection", (socket, request) => {
      const access = classifyRequestAccess(request, this.config, "websocket");
      if (access === null) {
        socket.close(1008, "Connection authority is unavailable");
        return;
      }
      this.handleConnection(socket, access);
    });

    this.unsubscribeData = sessions.onTerminalData((event) => {
      const frame = encodeTerminalDataFrame(
        event.sessionId,
        event.epoch,
        event.sequence,
        event.data,
      );
      for (const client of this.clients) {
        if (client.subscriptions.has(event.sessionId)) {
          this.sendBinary(client.socket, frame);
        }
      }
    });

    this.unsubscribeSessions = sessions.onSessionEvent((event) => {
      if (event.type === "updated") {
        this.broadcast({ type: "session.updated", session: event.session });
        if (event.session.relaunchManifest !== undefined) {
          this.broadcast({
            type: "relaunch.manifest.updated",
            manifest: event.session.relaunchManifest,
          });
        }
        return;
      }
      if (event.type === "exited") {
        this.broadcast({ type: "session.exited", session: event.session });
        return;
      }
      if (event.type === "verification") {
        this.broadcast(
          boundVerificationResponse({
            type: "repository.verification.updated",
            sessionId: event.sessionId,
            observation: event.observation,
          }),
        );
        return;
      }

      for (const client of this.clients) {
        client.subscriptions.delete(event.sessionId);
      }
      const message: ServerMessage =
        event.requestId === undefined
          ? { type: "session.closed", sessionId: event.sessionId }
          : {
              type: "session.closed",
              sessionId: event.sessionId,
              requestId: event.requestId,
            };
      this.broadcast(message);
    });

    this.unsubscribeQueue = queueObserver.subscribe((observation) => {
      void this.enrichQueueObservation(observation).then((enriched) => {
        if (this.queueObserver.snapshot() === observation) {
          this.broadcast({
            type: "pacium.queue.sources.updated",
            observation: enriched,
          });
        }
      });
    });
  }

  public dispose(): void {
    this.unsubscribeData();
    this.unsubscribeSessions();
    this.unsubscribeQueue();
    this.queueObserver.dispose();
    for (const client of this.clients) {
      client.socket.close(1001, "Pacium server is shutting down");
    }
    this.clients.clear();
    this.server.close();
  }

  private handleConnection(socket: WebSocket, access: RequestAccess): void {
    const client: ConnectedClient = {
      socket,
      subscriptions: new Set(),
    };
    this.clients.add(client);

    this.send(socket, {
      type: "server.welcome",
      protocolVersion: PROTOCOL_VERSION,
      serverId: this.config.serverId,
      platform: process.platform,
      defaultCwd: this.config.defaultCwd,
      connection: access,
      capabilities: {
        directPty: true,
        reconnectSnapshot: true,
        tmux: this.sessions.tmuxCapability(),
        launchPresets: presetCapabilities(this.config.launchPresets),
      },
    });

    socket.on("message", (data, isBinary) => {
      void this.handleMessage(client, data, isBinary);
    });
    socket.on("close", () => {
      this.clients.delete(client);
    });
    socket.on("error", () => {
      this.clients.delete(client);
    });
  }

  private async handleMessage(
    client: ConnectedClient,
    raw: RawData,
    isBinary: boolean,
  ): Promise<void> {
    if (isBinary) {
      this.sendError(
        client.socket,
        undefined,
        "BINARY_INPUT_UNSUPPORTED",
        "Browser-to-server terminal messages must use the typed JSON protocol.",
      );
      return;
    }

    const byteLength = rawByteLength(raw);
    if (byteLength > MAX_APPLICATION_MESSAGE_BYTES) {
      client.socket.close(1009, "Application message is too large");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawToUtf8(raw));
    } catch {
      this.sendError(
        client.socket,
        undefined,
        "INVALID_JSON",
        "The application message is not valid JSON.",
      );
      return;
    }

    const parsed = ClientMessageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const requestId = extractRequestId(parsedJson);
      this.sendError(
        client.socket,
        requestId,
        "INVALID_MESSAGE",
        "The application message does not match the Pacium protocol.",
      );
      return;
    }

    try {
      await this.dispatch(client, parsed.data);
    } catch (error) {
      if (error instanceof SessionError) {
        this.sendError(
          client.socket,
          parsed.data.requestId,
          error.code,
          error.message,
          error.retryable,
        );
        return;
      }
      if (error instanceof PaciumConfigStoreError) {
        this.sendError(
          client.socket,
          parsed.data.requestId,
          `PACIUM_CONFIG_${error.code.toUpperCase()}`,
          error.message,
          error.code === "conflict" ||
            error.code === "write_failed" ||
            error.code === "durability_unknown" ||
            error.code === "invalid_result",
        );
        return;
      }
      this.sendError(
        client.socket,
        parsed.data.requestId,
        "INTERNAL_ERROR",
        "The local server could not complete the terminal operation.",
        true,
      );
    }
  }

  private async dispatch(
    client: ConnectedClient,
    message: ClientMessage,
  ): Promise<void> {
    switch (message.type) {
      case "session.list":
        this.send(client.socket, {
          type: "session.list",
          requestId: message.requestId,
          sessions: this.sessions.list(),
        });
        return;
      case "relaunch.manifest.list":
        this.send(client.socket, {
          type: "relaunch.manifest.list",
          requestId: message.requestId,
          manifests: this.sessions.listRelaunchManifests(),
        });
        return;
      case "tmux.sessions.list":
        this.send(client.socket, {
          type: "tmux.sessions",
          requestId: message.requestId,
          observation: await this.sessions.discoverTmux(),
        });
        return;
      case "session.create": {
        const session = await this.sessions.create({
          cwd: message.payload.cwd,
          launchPreset: message.payload.launchPreset,
          cols: message.payload.cols,
          rows: message.payload.rows,
          ...(message.payload.displayName === undefined
            ? {}
            : { displayName: message.payload.displayName }),
          ...(message.payload.keepAlive === undefined
            ? {}
            : { keepAlive: message.payload.keepAlive }),
        });
        client.subscriptions.add(session.id);
        this.send(client.socket, {
          type: "session.created",
          requestId: message.requestId,
          session,
        });
        return;
      }
      case "session.relaunch": {
        const session = await this.sessions.relaunch(
          message.manifestId,
          message.cols,
          message.rows,
        );
        client.subscriptions.add(session.id);
        this.send(client.socket, {
          type: "session.created",
          requestId: message.requestId,
          session,
        });
        return;
      }
      case "tmux.session.attach": {
        const session = await this.sessions.attachTmux(
          message.serverId,
          message.sessionId,
          message.cols,
          message.rows,
        );
        client.subscriptions.add(session.id);
        this.send(client.socket, {
          type: "session.created",
          requestId: message.requestId,
          session,
        });
        return;
      }
      case "terminal.attach": {
        client.subscriptions.add(message.sessionId);
        try {
          const snapshot = await this.sessions.snapshot(message.sessionId);
          this.send(client.socket, {
            type: "terminal.snapshot",
            requestId: message.requestId,
            ...snapshot,
          });
        } catch (error) {
          client.subscriptions.delete(message.sessionId);
          throw error;
        }
        return;
      }
      case "terminal.input":
        this.sessions.input(message.sessionId, message.data);
        this.sendResult(client.socket, message.requestId);
        return;
      case "terminal.resize":
        this.sessions.resize(message.sessionId, message.cols, message.rows);
        this.sendResult(client.socket, message.requestId);
        return;
      case "terminal.interrupt":
        this.sessions.interrupt(message.sessionId);
        this.sendResult(client.socket, message.requestId);
        return;
      case "session.rename":
        this.sessions.rename(message.sessionId, message.displayName);
        this.sendResult(client.socket, message.requestId);
        return;
      case "session.revealRepository":
        await this.sessions.revealRepository(message.sessionId);
        this.sendResult(client.socket, message.requestId);
        return;
      case "session.refreshRepository":
        await this.sessions.refreshRepository(message.sessionId);
        this.sendResult(client.socket, message.requestId);
        return;
      case "repository.changes": {
        const observation = await this.sessions.repositoryChanges(
          message.sessionId,
        );
        this.send(client.socket, {
          type: "repository.changes",
          requestId: message.requestId,
          sessionId: message.sessionId,
          observation,
        });
        return;
      }
      case "repository.diff": {
        const observation = await this.sessions.repositoryDiff(
          message.sessionId,
          message.path,
        );
        this.send(
          client.socket,
          boundRepositoryDiffResponse({
            type: "repository.diff",
            requestId: message.requestId,
            sessionId: message.sessionId,
            observation,
          }),
        );
        return;
      }
      case "repository.history": {
        const observation = await this.sessions.repositoryHistory(
          message.sessionId,
        );
        this.send(
          client.socket,
          boundRepositoryHistoryResponse({
            type: "repository.history",
            requestId: message.requestId,
            sessionId: message.sessionId,
            observation,
          }),
        );
        return;
      }
      case "repository.verification.inspect":
        this.send(
          client.socket,
          boundVerificationResponse({
            type: "repository.verification",
            requestId: message.requestId,
            sessionId: message.sessionId,
            observation: this.sessions.repositoryVerification(
              message.sessionId,
            ),
          }),
        );
        return;
      case "repository.verification.run":
        this.send(
          client.socket,
          boundVerificationResponse({
            type: "repository.verification",
            requestId: message.requestId,
            sessionId: message.sessionId,
            observation: await this.sessions.runRepositoryVerification(
              message.sessionId,
              message.presetId,
            ),
          }),
        );
        return;
      case "repository.verification.cancel":
        this.send(
          client.socket,
          boundVerificationResponse({
            type: "repository.verification",
            requestId: message.requestId,
            sessionId: message.sessionId,
            observation: this.sessions.cancelRepositoryVerification(
              message.sessionId,
              message.runId,
            ),
          }),
        );
        return;
      case "pacium.config.get":
        {
          const observation = await this.paciumConfig.inspect();
          this.send(client.socket, {
            type: "pacium.config",
            requestId: message.requestId,
            observation,
          });
          await this.queueObserver.syncConfig(observation);
        }
        return;
      case "pacium.config.replace": {
        const observation = await this.paciumConfig.replace(
          message.expectedRevision,
          message.workspace,
        );
        this.send(client.socket, {
          type: "pacium.config",
          requestId: message.requestId,
          observation,
        });
        await this.queueObserver.syncConfig(observation);
        return;
      }
      case "pacium.context.inspect":
        this.send(client.socket, {
          type: "pacium.context",
          requestId: message.requestId,
          observation: await this.paciumContext.inspect(),
        });
        return;
      case "pacium.queue.observe": {
        const config = await this.paciumConfig.inspect();
        const observation = await this.queueObserver.syncConfig(config);
        this.send(client.socket, {
          type: "pacium.queue.sources",
          requestId: message.requestId,
          observation: await this.enrichQueueObservation(observation),
        });
        return;
      }
      case "pacium.queue.item.inspect": {
        const identity = queueDecisionIdentity(message);
        let inspection = this.queueObserver.inspectItem(identity);
        const decisionState =
          inspection.status === "ready"
            ? await this.queueDecisions.inspect(identity)
            : null;
        const deliveryState =
          decisionState?.status === "decided"
            ? await this.queueDeliveries.inspect(
                decisionState.decision.decisionId,
                decisionState.decision.decisionHash,
              )
            : null;
        const enriched = await this.enrichQueueObservation(
          this.queueObserver.snapshot(),
        );
        const conflicts =
          enriched.status === "ready"
            ? (enriched.sources.find(
                (source) => source.sourceId === identity.sourceId,
              )?.conflicts ?? [])
            : [];
        const reconciliation =
          decisionState?.status === "decided"
            ? await this.queueReconciliation.inspectItem(
                decisionState.decision.decisionId,
                decisionState.decision.decisionHash,
                conflicts,
              )
            : null;
        inspection = this.queueObserver.inspectItem(identity);
        const completeDecidedEvidence =
          decisionState?.status !== "decided" ||
          (deliveryState !== null && reconciliation !== null);
        const responseDecisionState =
          inspection.status !== "ready"
            ? null
            : completeDecidedEvidence
              ? decisionState
              : {
                  status: "unavailable" as const,
                  decision: null,
                  error: queueDecisionError("DECISION_STATE_UNAVAILABLE"),
                };
        this.send(client.socket, {
          type: "pacium.queue.item",
          requestId: message.requestId,
          inspection,
          decisionState: responseDecisionState,
          deliveryState:
            responseDecisionState?.status === "decided" ? deliveryState : null,
          reconciliation:
            responseDecisionState?.status === "decided" ? reconciliation : null,
        });
        return;
      }
      case "pacium.queue.question.answer":
        {
          const identity = queueDecisionIdentity(message);
          this.send(client.socket, {
            type: "pacium.queue.decision",
            requestId: message.requestId,
            result: await this.queueDecisions.recordQuestionAnswer(
              identity,
              message.payload,
            ),
          });
        }
        return;
      case "pacium.queue.approval.decide":
        {
          const identity = queueDecisionIdentity(message);
          this.send(client.socket, {
            type: "pacium.queue.decision",
            requestId: message.requestId,
            result: await this.queueDecisions.recordApprovalDecision(
              identity,
              message.payload,
            ),
          });
        }
        return;
      case "pacium.queue.decision.deliver":
        this.send(client.socket, {
          type: "pacium.queue.delivery",
          requestId: message.requestId,
          result: await this.queueDeliveries.deliver(
            message.decisionId,
            message.decisionHash,
          ),
        });
        return;
      case "pacium.queue.decision.resolve":
        this.send(client.socket, {
          type: "pacium.queue.resolution",
          requestId: message.requestId,
          result: await this.queueReconciliation.resolve({
            decisionId: message.decisionId,
            decisionHash: message.decisionHash,
            action: message.action,
            delivery: message.delivery,
            relatedDecision: message.relatedDecision,
            note: message.note,
          }),
        });
        return;
      case "session.close":
        this.sessions.close(
          message.sessionId,
          message.force,
          message.requestId,
        );
    }
  }

  private sendResult(socket: WebSocket, requestId: string): void {
    this.send(socket, { type: "command.result", requestId, ok: true });
  }

  private async enrichQueueObservation(
    observation: ReturnType<QueueObserver["snapshot"]>,
  ): Promise<ReturnType<QueueObserver["snapshot"]>> {
    if (observation.status !== "ready") {
      return observation;
    }
    const [config, state] = await Promise.all([
      this.paciumConfig.inspect(),
      this.queueState.inspect(),
    ]);
    if (
      config.status !== "ready" ||
      config.workspace === null ||
      config.revision !== observation.workspaceRevision ||
      state.status === "error"
    ) {
      return observation;
    }
    return withQueueSourceConflicts(
      observation,
      config.workspace.id,
      state.decisions,
    );
  }

  private sendError(
    socket: WebSocket,
    requestId: string | undefined,
    code: string,
    message: string,
    retryable = false,
  ): void {
    const payload: ServerMessage =
      requestId === undefined
        ? { type: "error", code, message, retryable }
        : { type: "error", requestId, code, message, retryable };
    this.send(socket, payload);
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.clients) {
      this.send(client.socket, message);
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private sendBinary(socket: WebSocket, frame: Uint8Array): void {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > MAX_SOCKET_BUFFER_BYTES) {
        socket.close(
          1013,
          "Terminal client fell behind; reconnect for a fresh snapshot",
        );
        return;
      }
      socket.send(frame, { binary: true });
    }
  }
}

type RepositoryDiffResponse = Extract<
  ServerMessage,
  { type: "repository.diff" }
>;

export function boundRepositoryDiffResponse(
  message: RepositoryDiffResponse,
): RepositoryDiffResponse {
  if (
    Buffer.byteLength(JSON.stringify(message)) <=
      MAX_APPLICATION_MESSAGE_BYTES ||
    message.observation.root === null
  ) {
    return message;
  }
  return {
    ...message,
    observation: {
      ...message.observation,
      status: "too_large",
      sections: [],
      patchBytes: 0,
      patchLines: 0,
      error: null,
    },
  };
}

type RepositoryHistoryResponse = Extract<
  ServerMessage,
  { type: "repository.history" }
>;

export function boundRepositoryHistoryResponse(
  message: RepositoryHistoryResponse,
): RepositoryHistoryResponse {
  if (
    Buffer.byteLength(JSON.stringify(message)) <= MAX_APPLICATION_MESSAGE_BYTES
  ) {
    return message;
  }
  return {
    ...message,
    observation: {
      ...message.observation,
      status: "error",
      commits: [],
      truncated: false,
      error: {
        code: "invalid_output",
        message: "Git returned invalid or excessive commit history.",
      },
    },
  };
}

type VerificationResponse = Extract<
  ServerMessage,
  {
    type: "repository.verification" | "repository.verification.updated";
  }
>;

export function boundVerificationResponse<T extends VerificationResponse>(
  message: T,
): T {
  if (
    Buffer.byteLength(JSON.stringify(message)) <= MAX_APPLICATION_MESSAGE_BYTES
  ) {
    return message;
  }
  return {
    ...message,
    observation: {
      status: "error",
      configured: message.observation.configured,
      root: message.observation.root,
      observedAt: message.observation.observedAt,
      presets: [],
      run: null,
      error: {
        code: "invalid_state",
        message:
          "Verification configuration or output exceeds the application message bound.",
      },
    },
  };
}

function queueDecisionIdentity(
  message: QueueDecisionRequestIdentity,
): QueueDecisionRequestIdentity {
  return {
    workspaceRevision: message.workspaceRevision,
    sourceId: message.sourceId,
    observationRevision: message.observationRevision,
    contentHash: message.contentHash,
    itemId: message.itemId,
  };
}

function rawByteLength(raw: RawData): number {
  if (Array.isArray(raw)) {
    return raw.reduce((total, entry) => total + entry.byteLength, 0);
  }
  return raw.byteLength;
}

function rawToUtf8(raw: RawData): string {
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString(
    "utf8",
  );
}

function extractRequestId(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "requestId" in value &&
    typeof value.requestId === "string"
  ) {
    return value.requestId;
  }
  return undefined;
}
