import { randomUUID } from "node:crypto";

import {
  MAX_QUEUE_DECISIONS,
  QueueApprovalDecisionPayloadSchema,
  QueueApprovalDecisionSchema,
  QueueQuestionAnswerDecisionSchema,
  QueueQuestionAnswerPayloadSchema,
  queueDecisionError,
  queueDecisionIdentityKey,
  type QueueApprovalDecisionPayload,
  type QueueDecisionRecord,
  type QueueDecisionRequestIdentity,
  type QueueDecisionResult,
  type QueueDecisionSourceIdentity,
  type QueueItemDecisionState,
  type QueueQuestionAnswerPayload,
} from "@pacium/contracts";

import { computeQueueDecisionHash } from "./queue-decision-hash.js";
import {
  QueueDecisionStoreWriteError,
  type QueueDecisionStore,
  type QueueDecisionStoreAppendResult,
  type QueueDecisionStoreObservation,
} from "./queue-decision-store.js";

export interface QueueDecisionSourceReader {
  decisionSourceIdentity(
    identity: QueueDecisionRequestIdentity,
  ): QueueDecisionSourceIdentity | null;
}

export interface QueueDecisionStateStore {
  inspect(): Promise<QueueDecisionStoreObservation>;
  append(
    decision: QueueDecisionRecord,
  ): Promise<QueueDecisionStoreAppendResult>;
}

export interface QueueDecisionServiceOptions {
  now?: () => string;
  randomId?: () => string;
}

export class QueueDecisionService {
  private readonly now: () => string;
  private readonly randomId: () => string;

  public constructor(
    private readonly sourceReader: QueueDecisionSourceReader,
    private readonly store: QueueDecisionStateStore,
    options: QueueDecisionServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.randomId = options.randomId ?? randomUUID;
  }

  public async inspect(
    identity: QueueDecisionRequestIdentity,
  ): Promise<QueueItemDecisionState> {
    const source = this.sourceReader.decisionSourceIdentity(identity);
    if (source === null) {
      return unavailableDecisionState("DECISION_STATE_UNAVAILABLE");
    }
    const observation = await this.store.inspect();
    if (observation.status === "error") {
      return unavailableDecisionState("DECISION_STATE_UNAVAILABLE");
    }
    const sourceKey = queueDecisionIdentityKey(source);
    const decision = observation.decisions.find(
      (candidate) => queueDecisionIdentityKey(candidate.source) === sourceKey,
    );
    if (decision !== undefined) {
      return {
        status: "decided",
        decision,
        error: null,
      };
    }
    if (observation.decisions.length >= MAX_QUEUE_DECISIONS) {
      return unavailableDecisionState("DECISION_STATE_FULL");
    }
    return {
      status: "open",
      decision: null,
      error: null,
    };
  }

  public recordQuestionAnswer(
    identity: QueueDecisionRequestIdentity,
    payload: QueueQuestionAnswerPayload,
  ): Promise<QueueDecisionResult> {
    return this.record(
      identity,
      "question",
      QueueQuestionAnswerPayloadSchema.parse(payload),
    );
  }

  public recordApprovalDecision(
    identity: QueueDecisionRequestIdentity,
    payload: QueueApprovalDecisionPayload,
  ): Promise<QueueDecisionResult> {
    return this.record(
      identity,
      "approval",
      QueueApprovalDecisionPayloadSchema.parse(payload),
    );
  }

  private async record(
    identity: QueueDecisionRequestIdentity,
    expectedType: "question" | "approval",
    payload: QueueQuestionAnswerPayload | QueueApprovalDecisionPayload,
  ): Promise<QueueDecisionResult> {
    const source = this.sourceReader.decisionSourceIdentity(identity);
    if (source === null) {
      return failedResult(identity, "stale", "ITEM_STALE");
    }
    if (source.itemType !== expectedType) {
      return failedResult(identity, "rejected", "ITEM_TYPE_MISMATCH");
    }

    const unhashed =
      expectedType === "question"
        ? {
            decisionId: this.randomId(),
            kind: "question_answer" as const,
            source,
            payload: QueueQuestionAnswerPayloadSchema.parse(payload),
            actor: {
              kind: "local_operator" as const,
              label: "Local operator" as const,
            },
            decidedAt: this.now(),
          }
        : {
            decisionId: this.randomId(),
            kind: "approval_decision" as const,
            source,
            payload: QueueApprovalDecisionPayloadSchema.parse(payload),
            actor: {
              kind: "local_operator" as const,
              label: "Local operator" as const,
            },
            decidedAt: this.now(),
          };
    const decision =
      unhashed.kind === "question_answer"
        ? QueueQuestionAnswerDecisionSchema.parse({
            ...unhashed,
            decisionHash: computeQueueDecisionHash(unhashed),
          })
        : QueueApprovalDecisionSchema.parse({
            ...unhashed,
            decisionHash: computeQueueDecisionHash(unhashed),
          });

    const revalidated = this.sourceReader.decisionSourceIdentity(identity);
    if (revalidated === null || !hasSameSourceIdentity(source, revalidated)) {
      return failedResult(identity, "stale", "ITEM_STALE");
    }

    try {
      const result = await this.store.append(decision);
      return {
        status: result.status,
        ...identity,
        decision: result.decision,
        error: null,
      };
    } catch (error) {
      if (!(error instanceof QueueDecisionStoreWriteError)) {
        return failedResult(identity, "unavailable", "DECISION_WRITE_FAILED");
      }
      switch (error.code) {
        case "already_decided":
          return failedResult(identity, "rejected", "ITEM_ALREADY_DECIDED");
        case "state_full":
          return failedResult(identity, "unavailable", "DECISION_STATE_FULL");
        case "durability_unknown":
          return failedResult(
            identity,
            "unavailable",
            "DECISION_DURABILITY_UNKNOWN",
          );
        case "invalid_state":
        case "invalid_result":
          return failedResult(
            identity,
            "unavailable",
            "DECISION_STATE_UNAVAILABLE",
          );
        case "write_failed":
          return failedResult(identity, "unavailable", "DECISION_WRITE_FAILED");
      }
    }
  }
}

function hasSameSourceIdentity(
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

function unavailableDecisionState(
  code: "DECISION_STATE_UNAVAILABLE" | "DECISION_STATE_FULL",
): QueueItemDecisionState {
  return {
    status: "unavailable",
    decision: null,
    error: queueDecisionError(code),
  };
}

function failedResult(
  identity: QueueDecisionRequestIdentity,
  status: "stale" | "unavailable" | "rejected",
  code:
    | "ITEM_STALE"
    | "ITEM_TYPE_MISMATCH"
    | "ITEM_ALREADY_DECIDED"
    | "DECISION_STATE_UNAVAILABLE"
    | "DECISION_STATE_FULL"
    | "DECISION_WRITE_FAILED"
    | "DECISION_DURABILITY_UNKNOWN",
): QueueDecisionResult {
  return {
    status,
    ...identity,
    decision: null,
    error: queueDecisionError(code),
  };
}

export function createQueueDecisionService(
  sourceReader: QueueDecisionSourceReader,
  store: QueueDecisionStore,
): QueueDecisionService {
  return new QueueDecisionService(sourceReader, store);
}
