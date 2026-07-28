import {
  DirectoryListingSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  decodeTerminalDataFrame,
  type ClientMessage,
  type DirectoryListing,
  type LaunchPresetId,
  type QueueApprovalDecisionPayload,
  type QueueItemInspectionIdentity,
  type PaciumWorkspace,
  type QueueQuestionAnswerPayload,
  type QueueResolutionRequest,
  type ServerMessage,
  type TerminalDataFrame,
} from "@pacium/contracts";

export type ConnectionState =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export type TransportEvent =
  | { type: "connection"; state: ConnectionState }
  | {
      type: "pacium.config.requested";
      requestId: string;
      intent: "get" | "replace";
    }
  | { type: "pacium.queue.requested"; requestId: string }
  | { type: "message"; message: ServerMessage }
  | { type: "terminal.data"; frame: TerminalDataFrame }
  | { type: "transport.error"; message: string };

interface BootstrapResponse {
  protocolVersion: number;
  accessToken: string;
  webSocketPath: string;
}

export class PaciumTransport {
  private socket: WebSocket | null = null;
  private accessToken: string | null = null;
  private stopped = false;
  private retryAttempt = 0;
  private retryTimer: number | undefined;

  public constructor(private readonly emit: (event: TransportEvent) => void) {}

  public start(): void {
    this.stopped = false;
    void this.connect();
  }

  public stop(): void {
    this.stopped = true;
    if (this.retryTimer !== undefined) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.socket?.close(1000, "Pacium browser closed");
    this.socket = null;
    this.accessToken = null;
    this.emit({ type: "connection", state: "disconnected" });
  }

  public listSessions(): void {
    this.send({ type: "session.list", requestId: crypto.randomUUID() });
  }

  public listRelaunchManifests(): void {
    this.send({
      type: "relaunch.manifest.list",
      requestId: crypto.randomUUID(),
    });
  }

  public listTmuxSessions(): string {
    const requestId = crypto.randomUUID();
    this.send(tmuxSessionsListMessage(requestId));
    return requestId;
  }

  public createSession(input: {
    cwd: string;
    displayName?: string;
    launchPreset: LaunchPresetId;
    cols: number;
    rows: number;
    keepAlive?: boolean;
  }): string {
    const requestId = crypto.randomUUID();
    this.send(sessionCreateMessage(input, requestId));
    return requestId;
  }

  public attach(sessionId: string): void {
    this.send({
      type: "terminal.attach",
      requestId: crypto.randomUUID(),
      sessionId,
    });
  }

  public relaunch(manifestId: string, cols: number, rows: number): string {
    const requestId = crypto.randomUUID();
    this.send(relaunchSessionMessage(manifestId, cols, rows, requestId));
    return requestId;
  }

  public attachTmux(
    serverId: string,
    sessionId: string,
    cols: number,
    rows: number,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(
      tmuxSessionAttachMessage(serverId, sessionId, cols, rows, requestId),
    );
    return requestId;
  }

  public input(sessionId: string, data: string): string {
    const requestId = crypto.randomUUID();
    this.send(terminalInputMessage(sessionId, data, requestId));
    return requestId;
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    this.send({
      type: "terminal.resize",
      requestId: crypto.randomUUID(),
      sessionId,
      cols,
      rows,
    });
  }

  public interrupt(sessionId: string): void {
    this.send({
      type: "terminal.interrupt",
      requestId: crypto.randomUUID(),
      sessionId,
    });
  }

  public renameSession(sessionId: string, displayName: string): void {
    this.send({
      type: "session.rename",
      requestId: crypto.randomUUID(),
      sessionId,
      displayName,
    });
  }

  public revealRepository(sessionId: string): void {
    this.send({
      type: "session.revealRepository",
      requestId: crypto.randomUUID(),
      sessionId,
    });
  }

  public refreshRepository(sessionId: string): void {
    this.send(repositoryRefreshMessage(sessionId, crypto.randomUUID()));
  }

  public requestRepositoryChanges(sessionId: string): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryChangesMessage(sessionId, requestId));
    return requestId;
  }

  public requestRepositoryDiff(sessionId: string, path: string): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryDiffMessage(sessionId, path, requestId));
    return requestId;
  }

  public requestRepositoryHistory(sessionId: string): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryHistoryMessage(sessionId, requestId));
    return requestId;
  }

  public requestRepositoryVerification(sessionId: string): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryVerificationInspectMessage(sessionId, requestId));
    return requestId;
  }

  public runRepositoryVerification(
    sessionId: string,
    presetId: string,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryVerificationRunMessage(sessionId, presetId, requestId));
    return requestId;
  }

  public cancelRepositoryVerification(
    sessionId: string,
    runId: string,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(repositoryVerificationCancelMessage(sessionId, runId, requestId));
    return requestId;
  }

  public requestPaciumConfig(): string {
    const requestId = crypto.randomUUID();
    this.emit({
      type: "pacium.config.requested",
      requestId,
      intent: "get",
    });
    this.send(paciumConfigGetMessage(requestId));
    return requestId;
  }

  public replacePaciumConfig(
    expectedRevision: number,
    workspace: PaciumWorkspace,
  ): string {
    const requestId = crypto.randomUUID();
    this.emit({
      type: "pacium.config.requested",
      requestId,
      intent: "replace",
    });
    this.send(
      paciumConfigReplaceMessage(expectedRevision, workspace, requestId),
    );
    return requestId;
  }

  public requestQueueObservation(): string {
    const requestId = crypto.randomUUID();
    this.emit({ type: "pacium.queue.requested", requestId });
    this.send(queueObserveMessage(requestId));
    return requestId;
  }

  public requestPaciumContext(): string {
    const requestId = crypto.randomUUID();
    this.send(paciumContextInspectMessage(requestId));
    return requestId;
  }

  public requestQueueItemInspection(
    identity: QueueItemInspectionIdentity,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(queueItemInspectMessage(identity, requestId));
    return requestId;
  }

  public recordQueueQuestionAnswer(
    identity: QueueItemInspectionIdentity,
    payload: QueueQuestionAnswerPayload,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(queueQuestionAnswerMessage(identity, payload, requestId));
    return requestId;
  }

  public recordQueueApprovalDecision(
    identity: QueueItemInspectionIdentity,
    payload: QueueApprovalDecisionPayload,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(queueApprovalDecisionMessage(identity, payload, requestId));
    return requestId;
  }

  public deliverQueueDecision(
    decisionId: string,
    decisionHash: string,
  ): string {
    const requestId = crypto.randomUUID();
    this.send(
      queueDecisionDeliveryMessage(decisionId, decisionHash, requestId),
    );
    return requestId;
  }

  public resolveQueueDecision(request: QueueResolutionRequest): string {
    const requestId = crypto.randomUUID();
    this.send(queueDecisionResolutionMessage(request, requestId));
    return requestId;
  }

  public closeSession(sessionId: string, force: boolean): void {
    this.send({
      type: "session.close",
      requestId: crypto.randomUUID(),
      sessionId,
      force,
    });
  }

  public async listDirectories(path?: string): Promise<DirectoryListing> {
    if (this.accessToken === null) {
      throw new Error(
        "Pacium is still connecting. Try browsing host folders again.",
      );
    }
    return fetchDirectoryListing({
      accessToken: this.accessToken,
      ...(path === undefined ? {} : { path }),
    });
  }

  private async connect(): Promise<void> {
    this.emit({
      type: "connection",
      state: this.retryAttempt === 0 ? "connecting" : "reconnecting",
    });

    try {
      const response = await fetch("/api/bootstrap", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        method: browserReadMethod(window.location.protocol),
      });
      if (!response.ok) {
        throw new Error(`Bootstrap failed with HTTP ${response.status}`);
      }
      const bootstrap = (await response.json()) as BootstrapResponse;
      if (bootstrap.protocolVersion !== PROTOCOL_VERSION) {
        throw new Error("Browser and local server protocol versions differ");
      }
      this.accessToken = bootstrap.accessToken;

      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${scheme}//${window.location.host}${bootstrap.webSocketPath}`;
      const socket = new WebSocket(url, [
        "pacium.v1",
        `pacium.token.${bootstrap.accessToken}`,
      ]);
      socket.binaryType = "arraybuffer";
      this.socket = socket;

      socket.addEventListener("open", () => {
        this.retryAttempt = 0;
        this.emit({ type: "connection", state: "connected" });
        this.listSessions();
        this.listRelaunchManifests();
        this.requestPaciumConfig();
        this.requestQueueObservation();
      });
      socket.addEventListener("message", (event) => {
        const data: unknown = event.data;
        if (
          typeof data === "string" ||
          data instanceof ArrayBuffer ||
          data instanceof Blob
        ) {
          this.handleIncoming(data);
        } else {
          this.emit({
            type: "transport.error",
            message: "The server sent an unsupported WebSocket payload.",
          });
        }
      });
      socket.addEventListener("close", () => {
        if (this.socket === socket) {
          this.socket = null;
        }
        if (!this.stopped) {
          this.scheduleReconnect();
        }
      });
      socket.addEventListener("error", () => {
        this.emit({
          type: "transport.error",
          message: "The browser lost its connection to the local server.",
        });
      });
    } catch (error) {
      this.emit({
        type: "transport.error",
        message:
          error instanceof Error
            ? error.message
            : "The local server could not be reached.",
      });
      this.scheduleReconnect();
    }
  }

  private handleIncoming(data: string | ArrayBuffer | Blob): void {
    if (data instanceof ArrayBuffer) {
      try {
        this.emit({
          type: "terminal.data",
          frame: decodeTerminalDataFrame(data),
        });
      } catch {
        this.emit({
          type: "transport.error",
          message: "The server sent an invalid terminal frame.",
        });
      }
      return;
    }

    if (typeof data !== "string") {
      this.emit({
        type: "transport.error",
        message: "The server sent an unsupported WebSocket payload.",
      });
      return;
    }

    try {
      const parsed = ServerMessageSchema.safeParse(JSON.parse(data));
      if (!parsed.success) {
        throw new Error("Protocol validation failed");
      }
      this.emit({ type: "message", message: parsed.data });
    } catch {
      this.emit({
        type: "transport.error",
        message: "The server sent an invalid application message.",
      });
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.emit({
        type: "transport.error",
        message:
          "The terminal is temporarily disconnected; input was not sent.",
      });
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer !== undefined) {
      return;
    }
    this.retryAttempt += 1;
    const delay = Math.min(4_000, 250 * 2 ** (this.retryAttempt - 1));
    this.emit({ type: "connection", state: "reconnecting" });
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, delay);
  }
}

export function repositoryRefreshMessage(
  sessionId: string,
  requestId: string,
): ClientMessage {
  return {
    type: "session.refreshRepository",
    requestId,
    sessionId,
  };
}

export function repositoryChangesMessage(
  sessionId: string,
  requestId: string,
): ClientMessage {
  return {
    type: "repository.changes",
    requestId,
    sessionId,
  };
}

export function repositoryDiffMessage(
  sessionId: string,
  path: string,
  requestId: string,
): Extract<ClientMessage, { type: "repository.diff" }> {
  return {
    type: "repository.diff",
    requestId,
    sessionId,
    path,
  };
}

export function repositoryHistoryMessage(
  sessionId: string,
  requestId: string,
): Extract<ClientMessage, { type: "repository.history" }> {
  return {
    type: "repository.history",
    requestId,
    sessionId,
  };
}

export function repositoryVerificationInspectMessage(
  sessionId: string,
  requestId: string,
): Extract<ClientMessage, { type: "repository.verification.inspect" }> {
  return {
    type: "repository.verification.inspect",
    requestId,
    sessionId,
  };
}

export function repositoryVerificationRunMessage(
  sessionId: string,
  presetId: string,
  requestId: string,
): Extract<ClientMessage, { type: "repository.verification.run" }> {
  return {
    type: "repository.verification.run",
    requestId,
    sessionId,
    presetId,
  };
}

export function repositoryVerificationCancelMessage(
  sessionId: string,
  runId: string,
  requestId: string,
): Extract<ClientMessage, { type: "repository.verification.cancel" }> {
  return {
    type: "repository.verification.cancel",
    requestId,
    sessionId,
    runId,
  };
}

export function paciumConfigGetMessage(
  requestId: string,
): Extract<ClientMessage, { type: "pacium.config.get" }> {
  return {
    type: "pacium.config.get",
    requestId,
  };
}

export function paciumContextInspectMessage(
  requestId: string,
): Extract<ClientMessage, { type: "pacium.context.inspect" }> {
  return {
    type: "pacium.context.inspect",
    requestId,
  };
}

export function paciumConfigReplaceMessage(
  expectedRevision: number,
  workspace: PaciumWorkspace,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.config.replace" }> {
  return {
    type: "pacium.config.replace",
    requestId,
    expectedRevision,
    workspace,
  };
}

export function queueObserveMessage(
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.observe" }> {
  return {
    type: "pacium.queue.observe",
    requestId,
  };
}

export function queueItemInspectMessage(
  identity: QueueItemInspectionIdentity,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.item.inspect" }> {
  return {
    type: "pacium.queue.item.inspect",
    requestId,
    workspaceRevision: identity.workspaceRevision,
    sourceId: identity.sourceId,
    observationRevision: identity.observationRevision,
    contentHash: identity.contentHash,
    itemId: identity.itemId,
  };
}

export function queueQuestionAnswerMessage(
  identity: QueueItemInspectionIdentity,
  payload: QueueQuestionAnswerPayload,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.question.answer" }> {
  return {
    type: "pacium.queue.question.answer",
    requestId,
    workspaceRevision: identity.workspaceRevision,
    sourceId: identity.sourceId,
    observationRevision: identity.observationRevision,
    contentHash: identity.contentHash,
    itemId: identity.itemId,
    payload,
  };
}

export function queueApprovalDecisionMessage(
  identity: QueueItemInspectionIdentity,
  payload: QueueApprovalDecisionPayload,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.approval.decide" }> {
  return {
    type: "pacium.queue.approval.decide",
    requestId,
    workspaceRevision: identity.workspaceRevision,
    sourceId: identity.sourceId,
    observationRevision: identity.observationRevision,
    contentHash: identity.contentHash,
    itemId: identity.itemId,
    payload,
  };
}

export function queueDecisionDeliveryMessage(
  decisionId: string,
  decisionHash: string,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.decision.deliver" }> {
  return {
    type: "pacium.queue.decision.deliver",
    requestId,
    decisionId,
    decisionHash,
  };
}

export function queueDecisionResolutionMessage(
  request: QueueResolutionRequest,
  requestId: string,
): Extract<ClientMessage, { type: "pacium.queue.decision.resolve" }> {
  return {
    type: "pacium.queue.decision.resolve",
    requestId,
    ...request,
  };
}

export function sessionCreateMessage(
  input: {
    cwd: string;
    displayName?: string;
    launchPreset: LaunchPresetId;
    cols: number;
    rows: number;
    keepAlive?: boolean;
  },
  requestId: string,
): Extract<ClientMessage, { type: "session.create" }> {
  const payload = {
    cwd: input.cwd,
    launchPreset: input.launchPreset,
    cols: input.cols,
    rows: input.rows,
    ...(input.displayName === undefined
      ? {}
      : { displayName: input.displayName }),
    ...(input.keepAlive === undefined ? {} : { keepAlive: input.keepAlive }),
  };
  return {
    type: "session.create",
    requestId,
    payload,
  };
}

export function relaunchSessionMessage(
  manifestId: string,
  cols: number,
  rows: number,
  requestId: string,
): Extract<ClientMessage, { type: "session.relaunch" }> {
  return {
    type: "session.relaunch",
    requestId,
    manifestId,
    cols,
    rows,
  };
}

export function tmuxSessionsListMessage(
  requestId: string,
): Extract<ClientMessage, { type: "tmux.sessions.list" }> {
  return {
    type: "tmux.sessions.list",
    requestId,
  };
}

export function tmuxSessionAttachMessage(
  serverId: string,
  sessionId: string,
  cols: number,
  rows: number,
  requestId: string,
): Extract<ClientMessage, { type: "tmux.session.attach" }> {
  return {
    type: "tmux.session.attach",
    requestId,
    serverId,
    sessionId,
    cols,
    rows,
  };
}

export function terminalInputMessage(
  sessionId: string,
  data: string,
  requestId: string,
): Extract<ClientMessage, { type: "terminal.input" }> {
  return {
    type: "terminal.input",
    requestId,
    sessionId,
    data,
  };
}

export async function fetchDirectoryListing(input: {
  accessToken: string;
  path?: string;
  fetcher?: typeof fetch;
  secure?: boolean;
}): Promise<DirectoryListing> {
  const fetcher = input.fetcher ?? fetch;
  const query =
    input.path === undefined ? "" : `?path=${encodeURIComponent(input.path)}`;
  const response = await fetcher(`/api/directories${query}`, {
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${input.accessToken}`,
    },
    method: browserReadMethod(
      input.secure === undefined
        ? typeof window === "undefined"
          ? "http:"
          : window.location.protocol
        : input.secure
          ? "https:"
          : "http:",
    ),
  });
  if (!response.ok) {
    let message = `Host folder browsing failed with HTTP ${response.status}`;
    try {
      const body = (await response.json()) as unknown;
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // Keep the bounded HTTP status message when no JSON error exists.
    }
    throw new Error(message);
  }
  const parsed = DirectoryListingSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("The Pacium host returned an invalid directory listing.");
  }
  return parsed.data;
}

export function browserReadMethod(protocol: string): "GET" | "POST" {
  return protocol === "https:" ? "POST" : "GET";
}
