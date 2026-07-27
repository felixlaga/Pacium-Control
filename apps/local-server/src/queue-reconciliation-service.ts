import { randomUUID } from "node:crypto";

import {
  QueueResolutionRecordSchema,
  QueueResolutionRequestSchema,
  queueResolutionError,
  type QueueDecisionRecord,
  type QueueDeliveryRecord,
  type QueueLifecycleState,
  type QueueResolutionRecord,
  type QueueResolutionRequest,
  type QueueResolutionResult,
} from "@pacium/contracts";

import {
  QueueDecisionStoreWriteError,
  type QueueDecisionStoreObservation,
  type QueueResolutionStoreMutationResult,
} from "./queue-decision-store.js";
import { computeQueueResolutionHash } from "./queue-resolution-hash.js";

export interface QueueResolutionStateStore {
  inspect(): Promise<QueueDecisionStoreObservation>;
  appendResolution(
    resolution: QueueResolutionRecord,
  ): Promise<QueueResolutionStoreMutationResult>;
}

export interface QueueReconciliationServiceOptions {
  isDeliveryActive?: (deliveryId: string) => boolean;
  now?: () => string;
  randomId?: () => string;
}

export class QueueReconciliationService {
  private readonly isDeliveryActive: (deliveryId: string) => boolean;
  private readonly now: () => string;
  private readonly randomId: () => string;

  public constructor(
    private readonly store: QueueResolutionStateStore,
    options: QueueReconciliationServiceOptions = {},
  ) {
    this.isDeliveryActive = options.isDeliveryActive ?? (() => false);
    this.now = options.now ?? (() => new Date().toISOString());
    this.randomId = options.randomId ?? randomUUID;
  }

  public async lifecycle(
    decisionId: string,
    decisionHash: string,
  ): Promise<QueueLifecycleState | null> {
    const state = await this.store.inspect();
    if (state.status !== "ready") {
      return null;
    }
    const decision = findDecision(state, decisionId, decisionHash);
    return decision === null
      ? null
      : lifecycleState(
          state.resolutions.filter(
            (resolution) => resolution.decisionId === decision.decisionId,
          ),
        );
  }

  public async resolve(
    request: QueueResolutionRequest,
  ): Promise<QueueResolutionResult> {
    const parsed = QueueResolutionRequestSchema.parse(request);
    const state = await this.store.inspect();
    if (state.status !== "ready") {
      return failedResult(
        parsed,
        "unavailable",
        "RESOLUTION_STATE_UNAVAILABLE",
      );
    }
    const decisionById = state.decisions.find(
      (candidate) => candidate.decisionId === parsed.decisionId,
    );
    if (decisionById === undefined) {
      return failedResult(parsed, "rejected", "RESOLUTION_DECISION_NOT_FOUND");
    }
    if (decisionById.decisionHash !== parsed.decisionHash) {
      return failedResult(
        parsed,
        "rejected",
        "RESOLUTION_DECISION_HASH_MISMATCH",
      );
    }

    const deliveryResult = resolveDelivery(state, decisionById, parsed);
    if ("error" in deliveryResult) {
      return failedResult(parsed, "rejected", deliveryResult.error);
    }
    const relatedResult = resolveRelatedDecision(state, decisionById, parsed);
    if ("error" in relatedResult) {
      return failedResult(parsed, "rejected", relatedResult.error);
    }
    if (
      deliveryResult.delivery !== null &&
      deliveryResult.delivery.outcome === null &&
      this.isDeliveryActive(deliveryResult.delivery.deliveryId)
    ) {
      return failedResult(parsed, "rejected", "RESOLUTION_TRANSITION_INVALID");
    }
    const history = state.resolutions.filter(
      (resolution) => resolution.decisionId === parsed.decisionId,
    );
    if (!canAppendResolution(history, parsed.action)) {
      return failedResult(parsed, "rejected", "RESOLUTION_TRANSITION_INVALID");
    }
    if (
      parsed.action === "confirmed_not_delivered" &&
      deliveryResult.delivery?.outcome?.status === "delivered"
    ) {
      return failedResult(parsed, "rejected", "RESOLUTION_TRANSITION_INVALID");
    }

    const unhashed = {
      resolutionId: this.randomId(),
      decisionId: decisionById.decisionId,
      decisionHash: decisionById.decisionHash,
      action: parsed.action,
      delivery: parsed.delivery,
      relatedDecision: parsed.relatedDecision,
      actor: {
        kind: "local_operator" as const,
        label: "Local operator" as const,
      },
      source: "human_labelled" as const,
      recordedAt: this.now(),
      note: parsed.note,
    };
    const resolution = QueueResolutionRecordSchema.parse({
      ...unhashed,
      resolutionHash: computeQueueResolutionHash(unhashed),
    });

    try {
      const result = await this.store.appendResolution(resolution);
      return {
        status: result.status,
        decisionId: parsed.decisionId,
        decisionHash: parsed.decisionHash,
        resolution: result.resolution,
        error: null,
      };
    } catch (error) {
      if (!(error instanceof QueueDecisionStoreWriteError)) {
        return failedResult(parsed, "unavailable", "RESOLUTION_WRITE_FAILED");
      }
      if (error.code === "durability_unknown") {
        return failedResult(
          parsed,
          "durability_unknown",
          "RESOLUTION_DURABILITY_UNKNOWN",
        );
      }
      if (error.code === "state_full") {
        return failedResult(parsed, "unavailable", "RESOLUTION_STATE_FULL");
      }
      return failedResult(
        parsed,
        error.code === "write_failed" ? "unavailable" : "rejected",
        error.code === "write_failed"
          ? "RESOLUTION_WRITE_FAILED"
          : "RESOLUTION_TRANSITION_INVALID",
      );
    }
  }
}

export function lifecycleState(
  resolutions: readonly QueueResolutionRecord[],
): QueueLifecycleState {
  const history = resolutions.slice(-2);
  const current = history.at(-1) ?? null;
  return {
    status: current?.action ?? "awaiting_evidence",
    current,
    history,
    historyTruncated: resolutions.length > history.length,
  };
}

function findDecision(
  state: Extract<QueueDecisionStoreObservation, { status: "ready" }>,
  decisionId: string,
  decisionHash: string,
): QueueDecisionRecord | null {
  return (
    state.decisions.find(
      (decision) =>
        decision.decisionId === decisionId &&
        decision.decisionHash === decisionHash,
    ) ?? null
  );
}

function resolveDelivery(
  state: Extract<QueueDecisionStoreObservation, { status: "ready" }>,
  decision: QueueDecisionRecord,
  request: QueueResolutionRequest,
):
  | { delivery: QueueDeliveryRecord | null }
  | {
      error:
        "RESOLUTION_DELIVERY_NOT_FOUND" | "RESOLUTION_DELIVERY_HASH_MISMATCH";
    } {
  if (request.delivery === null) {
    return { delivery: null };
  }
  const delivery = state.deliveries.find(
    (candidate) => candidate.deliveryId === request.delivery?.deliveryId,
  );
  if (delivery === undefined || delivery.decisionId !== decision.decisionId) {
    return { error: "RESOLUTION_DELIVERY_NOT_FOUND" };
  }
  if (delivery.deliveryHash !== request.delivery.deliveryHash) {
    return { error: "RESOLUTION_DELIVERY_HASH_MISMATCH" };
  }
  return { delivery };
}

function resolveRelatedDecision(
  state: Extract<QueueDecisionStoreObservation, { status: "ready" }>,
  decision: QueueDecisionRecord,
  request: QueueResolutionRequest,
):
  | { related: QueueDecisionRecord | null }
  | { error: "RESOLUTION_RELATED_DECISION_INVALID" } {
  if (request.relatedDecision === null) {
    return { related: null };
  }
  const related = state.decisions.find(
    (candidate) =>
      candidate.decisionId === request.relatedDecision?.decisionId &&
      candidate.decisionHash === request.relatedDecision.decisionHash,
  );
  if (
    related === undefined ||
    related.source.workspaceId !== decision.source.workspaceId ||
    related.source.sourceId !== decision.source.sourceId ||
    related.source.itemId === decision.source.itemId
  ) {
    return { error: "RESOLUTION_RELATED_DECISION_INVALID" };
  }
  return { related };
}

function canAppendResolution(
  history: readonly QueueResolutionRecord[],
  next: QueueResolutionRequest["action"],
): boolean {
  if (history.some((resolution) => resolution.action === next)) {
    return false;
  }
  const current = history.at(-1)?.action;
  if (current === undefined) {
    return true;
  }
  if (
    current === "applied" ||
    current === "unable_to_apply" ||
    current === "superseded"
  ) {
    return false;
  }
  if (current === "acknowledged") {
    return (
      next === "applied" || next === "unable_to_apply" || next === "superseded"
    );
  }
  return next !== "confirmed_not_delivered";
}

function failedResult(
  request: Pick<QueueResolutionRequest, "decisionId" | "decisionHash">,
  status: "rejected" | "unavailable" | "durability_unknown",
  code: Parameters<typeof queueResolutionError>[0],
): QueueResolutionResult {
  return {
    status,
    decisionId: request.decisionId,
    decisionHash: request.decisionHash,
    resolution: null,
    error: queueResolutionError(code),
  };
}
