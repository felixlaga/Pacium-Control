import { randomUUID } from "node:crypto";

import {
  QueueDeliveryRecordSchema,
  queueDeliveryError,
  type PaciumConfigObservation,
  type QueueDecisionRecord,
  type QueueDecisionSourceIdentity,
  type QueueDeliveryErrorCode,
  type QueueDeliveryOutcome,
  type QueueDeliveryRecord,
  type QueueDeliveryResult,
  type QueueDeliveryState,
  type QueueDeliveryTarget,
  type SessionSummary,
} from "@pacium/contracts";

import {
  AnswerFileDeliveryError,
  inspectAnswerFileTarget,
  publishAnswerFile,
} from "./answer-file-delivery.js";
import { computeQueueDeliveryHash } from "./queue-delivery-hash.js";
import {
  serializeAnswerFileDelivery,
  serializeRolePromptDelivery,
  type QueueDeliveryPayload,
} from "./queue-delivery-payload.js";
import {
  QueueDecisionStoreWriteError,
  type QueueDecisionStoreObservation,
  type QueueDeliveryStoreMutationResult,
} from "./queue-decision-store.js";

export interface QueueDeliveryConfigReader {
  inspect(): Promise<PaciumConfigObservation>;
}

export interface QueueDeliverySourceReader {
  decisionSourceIdentity(
    identity: QueueDecisionSourceIdentity,
  ): QueueDecisionSourceIdentity | null;
}

export interface QueueDeliveryStateStore {
  inspect(): Promise<QueueDecisionStoreObservation>;
  beginDelivery(
    delivery: QueueDeliveryRecord,
  ): Promise<QueueDeliveryStoreMutationResult>;
  finishDelivery(
    deliveryId: string,
    outcome: QueueDeliveryOutcome,
  ): Promise<QueueDeliveryStoreMutationResult>;
}

export interface QueueDeliverySessions {
  list(): SessionSummary[];
  input(sessionId: string, data: string): void;
}

export interface QueueDeliveryServiceOptions {
  inspectAnswerTarget?: typeof inspectAnswerFileTarget;
  now?: () => string;
  publishAnswer?: typeof publishAnswerFile;
  randomId?: () => string;
}

interface ReadyDelivery {
  decision: QueueDecisionRecord;
  target: QueueDeliveryTarget;
}

export class QueueDeliveryService {
  private readonly activeDeliveries = new Set<string>();
  private readonly inspectAnswerTarget: typeof inspectAnswerFileTarget;
  private readonly now: () => string;
  private readonly publishAnswer: typeof publishAnswerFile;
  private readonly randomId: () => string;

  public constructor(
    private readonly config: QueueDeliveryConfigReader,
    private readonly sourceReader: QueueDeliverySourceReader,
    private readonly store: QueueDeliveryStateStore,
    private readonly sessions: QueueDeliverySessions,
    options: QueueDeliveryServiceOptions = {},
  ) {
    this.inspectAnswerTarget =
      options.inspectAnswerTarget ?? inspectAnswerFileTarget;
    this.now = options.now ?? (() => new Date().toISOString());
    this.publishAnswer = options.publishAnswer ?? publishAnswerFile;
    this.randomId = options.randomId ?? randomUUID;
  }

  public async inspect(
    decisionId: string,
    decisionHash: string,
  ): Promise<QueueDeliveryState> {
    const resolved = await this.resolve(decisionId, decisionHash);
    return "state" in resolved ? resolved.state : readyState(resolved);
  }

  public isActive(deliveryId: string): boolean {
    return this.activeDeliveries.has(deliveryId);
  }

  public async deliver(
    decisionId: string,
    decisionHash: string,
  ): Promise<QueueDeliveryResult> {
    const resolved = await this.resolve(decisionId, decisionHash);
    if ("state" in resolved) {
      if (resolved.state.delivery !== null) {
        return {
          status: "existing",
          decisionId,
          decisionHash,
          state: resolved.state,
        };
      }
      return {
        status: "rejected",
        decisionId,
        decisionHash,
        state: resolved.state,
      };
    }

    const payload = payloadFor(resolved.decision, resolved.target);
    const unhashed = {
      deliveryId: this.randomId(),
      decisionId,
      decisionHash,
      target: resolved.target,
      payloadHash: payload.contentHash,
      payloadByteLength: payload.byteLength,
      requestedAt: this.now(),
      outcome: null,
    };
    const delivery = QueueDeliveryRecordSchema.parse({
      ...unhashed,
      deliveryHash: computeQueueDeliveryHash(unhashed),
    });

    let begun: QueueDeliveryStoreMutationResult;
    try {
      begun = await this.store.beginDelivery(delivery);
    } catch (error) {
      return this.beginFailure(
        decisionId,
        decisionHash,
        resolved.target,
        error,
      );
    }
    if (begun.status === "existing") {
      return {
        status: "existing",
        decisionId,
        decisionHash,
        state: stateFromDelivery(
          begun.delivery,
          this.activeDeliveries.has(begun.delivery.deliveryId),
        ),
      };
    }

    this.activeDeliveries.add(delivery.deliveryId);
    try {
      const outcome = await this.invoke(resolved, payload);
      try {
        const finished = await this.store.finishDelivery(
          delivery.deliveryId,
          outcome,
        );
        const state = stateFromDelivery(finished.delivery, false);
        return {
          status:
            state.status === "delivered"
              ? "delivered"
              : state.status === "failed"
                ? "failed"
                : "unknown",
          decisionId,
          decisionHash,
          state,
        };
      } catch {
        const current = await this.store.inspect();
        const recovered =
          current.status === "ready"
            ? current.deliveries.find(
                (candidate) => candidate.deliveryId === delivery.deliveryId,
              )
            : undefined;
        const state =
          recovered === undefined
            ? unavailableState(
                decisionId,
                decisionHash,
                resolved.target,
                "DELIVERY_STATE_UNAVAILABLE",
              )
            : unknownState(recovered);
        return {
          status: state.status === "unknown" ? "unknown" : "rejected",
          decisionId,
          decisionHash,
          state,
        };
      }
    } finally {
      this.activeDeliveries.delete(delivery.deliveryId);
    }
  }

  private async resolve(
    decisionId: string,
    decisionHash: string,
  ): Promise<ReadyDelivery | { state: QueueDeliveryState }> {
    const observation = await this.store.inspect();
    if (observation.status === "error") {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_STATE_UNAVAILABLE",
        ),
      };
    }
    const decision = observation.decisions.find(
      (candidate) => candidate.decisionId === decisionId,
    );
    if (decision === undefined) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DECISION_NOT_FOUND",
        ),
      };
    }
    if (decision.decisionHash !== decisionHash) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DECISION_HASH_MISMATCH",
        ),
      };
    }
    const existing = observation.deliveries.find(
      (delivery) => delivery.decisionId === decisionId,
    );
    if (existing !== undefined) {
      return {
        state: stateFromDelivery(
          existing,
          this.activeDeliveries.has(existing.deliveryId),
        ),
      };
    }

    const currentSource = this.sourceReader.decisionSourceIdentity(
      decision.source,
    );
    if (
      currentSource === null ||
      !sameSourceIdentity(currentSource, decision.source)
    ) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_ITEM_STALE",
        ),
      };
    }
    const config = await this.config.inspect();
    if (
      config.status !== "ready" ||
      config.revision !== decision.source.workspaceRevision ||
      config.workspace?.id !== decision.source.workspaceId
    ) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_CONFIG_UNAVAILABLE",
        ),
      };
    }
    const source = config.workspace.queueSources.find(
      (candidate) => candidate.id === decision.source.sourceId,
    );
    if (source === undefined) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_CONFIG_UNAVAILABLE",
        ),
      };
    }
    if (source.deliveryMethodId === null) {
      return {
        state: {
          status: "not_configured",
          decisionId,
          decisionHash,
          target: null,
          delivery: null,
          error: queueDeliveryError("DELIVERY_NOT_CONFIGURED"),
        },
      };
    }
    const method = config.workspace.deliveryMethods.find(
      (candidate) => candidate.id === source.deliveryMethodId,
    );
    if (method === undefined) {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_CONFIG_UNAVAILABLE",
        ),
      };
    }
    if (method.type === "answer_file") {
      const target: QueueDeliveryTarget = {
        type: "answer_file",
        methodId: method.id,
        methodLabel: method.label,
        path: method.path,
      };
      const status = await this.inspectAnswerTarget(method.path);
      return status === "ready"
        ? { decision, target }
        : {
            state: unavailableState(
              decisionId,
              decisionHash,
              target,
              status === "occupied"
                ? "DELIVERY_TARGET_OCCUPIED"
                : "DELIVERY_TARGET_UNAVAILABLE",
            ),
          };
    }

    const binding = config.workspace.roles[method.role];
    const session =
      binding?.type === "session"
        ? this.sessions
            .list()
            .find((candidate) => candidate.id === binding.sessionId)
        : undefined;
    if (session === undefined || session.processState !== "live") {
      return {
        state: unavailableState(
          decisionId,
          decisionHash,
          null,
          "DELIVERY_TARGET_UNAVAILABLE",
        ),
      };
    }
    return {
      decision,
      target: {
        type: "role_prompt",
        methodId: method.id,
        methodLabel: method.label,
        role: method.role,
        sessionId: session.id,
        sessionEpoch: session.epoch,
      },
    };
  }

  private async invoke(
    resolved: ReadyDelivery,
    payload: QueueDeliveryPayload,
  ): Promise<QueueDeliveryOutcome> {
    const target = resolved.target;
    if (target.type === "answer_file") {
      try {
        const evidence = await this.publishAnswer(target.path, payload);
        return {
          status: "delivered",
          recordedAt: this.now(),
          evidence,
          error: null,
        };
      } catch (error) {
        const code =
          error instanceof AnswerFileDeliveryError
            ? error.code
            : "write_failed";
        return failureOutcome(
          this.now(),
          code === "unknown" ? "unknown" : "failed",
          code === "occupied"
            ? "DELIVERY_TARGET_OCCUPIED"
            : code === "unavailable"
              ? "DELIVERY_TARGET_UNAVAILABLE"
              : code === "unknown"
                ? "DELIVERY_OUTCOME_UNKNOWN"
                : "DELIVERY_WRITE_FAILED",
        );
      }
    }

    const current = this.sessions
      .list()
      .find((session) => session.id === target.sessionId);
    if (
      current === undefined ||
      current.processState !== "live" ||
      current.epoch !== target.sessionEpoch
    ) {
      return failureOutcome(
        this.now(),
        "failed",
        "DELIVERY_TARGET_UNAVAILABLE",
      );
    }
    try {
      this.sessions.input(target.sessionId, payload.bytes);
      return {
        status: "delivered",
        recordedAt: this.now(),
        evidence: {
          kind: "terminal_transport_accepted",
          sessionId: target.sessionId,
          sessionEpoch: target.sessionEpoch,
          byteLength: payload.byteLength,
          contentHash: payload.contentHash,
        },
        error: null,
      };
    } catch {
      return failureOutcome(
        this.now(),
        "failed",
        "DELIVERY_TARGET_UNAVAILABLE",
      );
    }
  }

  private async beginFailure(
    decisionId: string,
    decisionHash: string,
    target: QueueDeliveryTarget,
    error: unknown,
  ): Promise<QueueDeliveryResult> {
    const current = await this.store.inspect();
    const recovered =
      current.status === "ready"
        ? current.deliveries.find(
            (delivery) => delivery.decisionId === decisionId,
          )
        : undefined;
    if (recovered !== undefined) {
      return {
        status: "existing",
        decisionId,
        decisionHash,
        state: stateFromDelivery(recovered, false),
      };
    }
    const code: QueueDeliveryErrorCode =
      error instanceof QueueDecisionStoreWriteError
        ? error.code === "state_full"
          ? "DELIVERY_STATE_FULL"
          : error.code === "durability_unknown"
            ? "DELIVERY_DURABILITY_UNKNOWN"
            : "DELIVERY_STATE_UNAVAILABLE"
        : "DELIVERY_STATE_UNAVAILABLE";
    return {
      status: "rejected",
      decisionId,
      decisionHash,
      state: unavailableState(decisionId, decisionHash, target, code),
    };
  }
}

function payloadFor(
  decision: QueueDecisionRecord,
  target: QueueDeliveryTarget,
): QueueDeliveryPayload {
  return target.type === "answer_file"
    ? serializeAnswerFileDelivery(decision)
    : serializeRolePromptDelivery(decision);
}

function readyState(resolved: ReadyDelivery): QueueDeliveryState {
  return {
    status: "ready",
    decisionId: resolved.decision.decisionId,
    decisionHash: resolved.decision.decisionHash,
    target: resolved.target,
    delivery: null,
    error: null,
  };
}

function unavailableState(
  decisionId: string,
  decisionHash: string,
  target: QueueDeliveryTarget | null,
  code: QueueDeliveryErrorCode,
): QueueDeliveryState {
  return {
    status: "unavailable",
    decisionId,
    decisionHash,
    target,
    delivery: null,
    error: queueDeliveryError(code),
  };
}

function stateFromDelivery(
  delivery: QueueDeliveryRecord,
  active: boolean,
): QueueDeliveryState {
  if (delivery.outcome === null) {
    return active
      ? {
          status: "delivering",
          decisionId: delivery.decisionId,
          decisionHash: delivery.decisionHash,
          target: delivery.target,
          delivery,
          error: null,
        }
      : unknownState(delivery);
  }
  return {
    status: delivery.outcome.status,
    decisionId: delivery.decisionId,
    decisionHash: delivery.decisionHash,
    target: delivery.target,
    delivery,
    error: delivery.outcome.error,
  };
}

function unknownState(delivery: QueueDeliveryRecord): QueueDeliveryState {
  return {
    status: "unknown",
    decisionId: delivery.decisionId,
    decisionHash: delivery.decisionHash,
    target: delivery.target,
    delivery,
    error: queueDeliveryError("DELIVERY_OUTCOME_UNKNOWN"),
  };
}

function failureOutcome(
  recordedAt: string,
  status: "failed" | "unknown",
  code: QueueDeliveryErrorCode,
): QueueDeliveryOutcome {
  return {
    status,
    recordedAt,
    evidence: null,
    error: queueDeliveryError(code),
  };
}

function sameSourceIdentity(
  left: QueueDecisionSourceIdentity,
  right: QueueDecisionSourceIdentity,
): boolean {
  return (
    left.workspaceId === right.workspaceId &&
    left.workspaceRevision === right.workspaceRevision &&
    left.sourceId === right.sourceId &&
    left.observationRevision === right.observationRevision &&
    left.boundary === right.boundary &&
    left.contentHash === right.contentHash &&
    left.itemId === right.itemId &&
    left.itemType === right.itemType
  );
}
