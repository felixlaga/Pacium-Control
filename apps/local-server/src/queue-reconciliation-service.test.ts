import type {
  QueueDecisionRecord,
  QueueDeliveryRecord,
  QueueResolutionRecord,
  QueueResolutionRequest,
} from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import { computeQueueDecisionHash } from "./queue-decision-hash.js";
import { computeQueueDeliveryHash } from "./queue-delivery-hash.js";
import {
  QueueDecisionStoreWriteError,
  type QueueDecisionStoreObservation,
} from "./queue-decision-store.js";
import {
  QueueReconciliationService,
  lifecycleState,
  type QueueResolutionStateStore,
} from "./queue-reconciliation-service.js";

const now = "2026-07-27T16:00:00.000Z";

describe("queue reconciliation service", () => {
  it("authors and appends one human-labelled acknowledgement", async () => {
    const fixture = serviceFixture();
    const request = resolutionRequest("acknowledged", fixture.delivery);
    const result = await fixture.service.resolve(request);

    expect(result).toMatchObject({
      status: "recorded",
      decisionId: fixture.decision.decisionId,
      decisionHash: fixture.decision.decisionHash,
      resolution: {
        resolutionId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
        action: "acknowledged",
        actor: { kind: "local_operator", label: "Local operator" },
        source: "human_labelled",
        recordedAt: now,
      },
      error: null,
    });
    expect(fixture.store.appendResolution).toHaveBeenCalledOnce();
  });

  it("rejects active or delivered attempts as confirmed not delivered", async () => {
    const active = serviceFixture({ isDeliveryActive: true });
    await expect(
      active.service.resolve(
        resolutionRequest("confirmed_not_delivered", active.delivery),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "RESOLUTION_TRANSITION_INVALID" },
    });

    const delivered = serviceFixture({
      outcome: {
        status: "delivered",
        recordedAt: now,
        evidence: {
          kind: "answer_file_created",
          byteLength: 512,
          contentHash: "d".repeat(64),
        },
        error: null,
      },
    });
    await expect(
      delivered.service.resolve(
        resolutionRequest("confirmed_not_delivered", delivered.delivery),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "RESOLUTION_TRANSITION_INVALID" },
    });
  });

  it("accepts confirmed-not-delivered for a failed immutable attempt", async () => {
    const fixture = serviceFixture({
      outcome: {
        status: "failed",
        recordedAt: now,
        evidence: null,
        error: {
          code: "DELIVERY_WRITE_FAILED",
          message:
            "The configured transport failed before delivery could be confirmed.",
        },
      },
    });
    await expect(
      fixture.service.resolve(
        resolutionRequest("confirmed_not_delivered", fixture.delivery),
      ),
    ).resolves.toMatchObject({
      status: "recorded",
      resolution: { action: "confirmed_not_delivered" },
    });
  });

  it("requires a distinct same-source replacement for supersession", async () => {
    const replacement = decision({
      decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
      itemId: "f".repeat(64),
    });
    const fixture = serviceFixture({ decisions: [replacement] });
    await expect(
      fixture.service.resolve({
        decisionId: fixture.decision.decisionId,
        decisionHash: fixture.decision.decisionHash,
        action: "superseded",
        delivery: null,
        relatedDecision: {
          decisionId: replacement.decisionId,
          decisionHash: replacement.decisionHash,
        },
        note: null,
      }),
    ).resolves.toMatchObject({
      status: "recorded",
      resolution: {
        action: "superseded",
        relatedDecision: {
          decisionId: replacement.decisionId,
        },
      },
    });

    const other = decision({
      decisionId: "27adb772-f575-459b-a74e-993437a706d8",
      itemId: "8".repeat(64),
      sourceId: "other-source",
    });
    const invalid = serviceFixture({ decisions: [other] });
    await expect(
      invalid.service.resolve({
        decisionId: invalid.decision.decisionId,
        decisionHash: invalid.decision.decisionHash,
        action: "superseded",
        delivery: null,
        relatedDecision: {
          decisionId: other.decisionId,
          decisionHash: other.decisionHash,
        },
        note: null,
      }),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "RESOLUTION_RELATED_DECISION_INVALID" },
    });
  });

  it("enforces monotonic terminal lifecycle and maps durability", async () => {
    const applied = resolutionRecord("applied");
    const terminal = serviceFixture({ resolutions: [applied] });
    await expect(
      terminal.service.resolve(
        resolutionRequest("acknowledged", terminal.delivery),
      ),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "RESOLUTION_TRANSITION_INVALID" },
    });

    const unknown = serviceFixture();
    unknown.store.appendResolution.mockRejectedValueOnce(
      new QueueDecisionStoreWriteError(
        "durability_unknown",
        "Synthetic unknown durability.",
      ),
    );
    await expect(
      unknown.service.resolve(
        resolutionRequest("acknowledged", unknown.delivery),
      ),
    ).resolves.toMatchObject({
      status: "durability_unknown",
      error: { code: "RESOLUTION_DURABILITY_UNKNOWN" },
    });
  });

  it("projects bounded lifecycle history without provider claims", () => {
    const acknowledged = resolutionRecord("acknowledged");
    const applied = resolutionRecord("applied", {
      resolutionId: "27adb772-f575-459b-a74e-993437a706d8",
    });
    expect(lifecycleState([acknowledged, applied])).toEqual({
      status: "applied",
      current: applied,
      history: [acknowledged, applied],
      historyTruncated: false,
    });
    expect(lifecycleState([])).toEqual({
      status: "awaiting_evidence",
      current: null,
      history: [],
      historyTruncated: false,
    });
  });
});

function serviceFixture(
  options: {
    decisions?: QueueDecisionRecord[];
    isDeliveryActive?: boolean;
    outcome?: QueueDeliveryRecord["outcome"];
    resolutions?: QueueResolutionRecord[];
  } = {},
) {
  const primaryDecision = decision();
  const primaryDelivery = delivery(primaryDecision, options.outcome ?? null);
  const resolutions = [...(options.resolutions ?? [])];
  const observation: QueueDecisionStoreObservation = {
    status: "ready",
    revision: 3,
    decisions: [primaryDecision, ...(options.decisions ?? [])],
    deliveries: [primaryDelivery],
    resolutions,
    error: null,
  };
  const store = {
    inspect: vi.fn<QueueResolutionStateStore["inspect"]>(() =>
      Promise.resolve(observation),
    ),
    appendResolution: vi.fn<QueueResolutionStateStore["appendResolution"]>(
      (record) => {
        resolutions.push(record);
        return Promise.resolve({
          status: "recorded",
          revision: observation.revision + 1,
          resolution: record,
        });
      },
    ),
  };
  return {
    decision: primaryDecision,
    delivery: primaryDelivery,
    service: new QueueReconciliationService(store, {
      isDeliveryActive: () => options.isDeliveryActive ?? false,
      now: () => now,
      randomId: () => "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
    }),
    store,
  };
}

function resolutionRequest(
  action: Exclude<QueueResolutionRequest["action"], "superseded">,
  attempt: QueueDeliveryRecord,
): QueueResolutionRequest {
  return {
    decisionId: attempt.decisionId,
    decisionHash: attempt.decisionHash,
    action,
    delivery: {
      deliveryId: attempt.deliveryId,
      deliveryHash: attempt.deliveryHash,
    },
    relatedDecision: null,
    note: null,
  };
}

function decision(
  overrides: {
    decisionId?: string;
    itemId?: string;
    sourceId?: string;
  } = {},
): QueueDecisionRecord {
  const unhashed = {
    decisionId: overrides.decisionId ?? "28c9142a-8986-43c7-9451-445fd8c13c3e",
    kind: "question_answer" as const,
    source: {
      workspaceId: "pacium",
      workspaceRevision: 4,
      sourceId: overrides.sourceId ?? "needs-felix",
      observationRevision: 7,
      boundary: "whole_source_v1" as const,
      contentHash: "a".repeat(64),
      itemId: overrides.itemId ?? "b".repeat(64),
      itemType: "question" as const,
    },
    payload: {
      answer: "Use the smaller verified slice.",
      note: null,
    },
    actor: {
      kind: "local_operator" as const,
      label: "Local operator" as const,
    },
    decidedAt: "2026-07-27T14:00:00.000Z",
  };
  return {
    ...unhashed,
    decisionHash: computeQueueDecisionHash(unhashed),
  };
}

function delivery(
  queueDecision: QueueDecisionRecord,
  outcome: QueueDeliveryRecord["outcome"],
): QueueDeliveryRecord {
  const unhashed = {
    deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
    decisionId: queueDecision.decisionId,
    decisionHash: queueDecision.decisionHash,
    target: {
      type: "answer_file" as const,
      methodId: "answers",
      methodLabel: "Pacium answers",
      path: "/private/tmp/PACIUM-ANSWERS",
    },
    payloadHash: "d".repeat(64),
    payloadByteLength: 512,
    requestedAt: "2026-07-27T15:00:00.000Z",
    outcome,
  };
  return {
    ...unhashed,
    deliveryHash: computeQueueDeliveryHash(unhashed),
  };
}

function resolutionRecord(
  action: "acknowledged" | "applied",
  overrides: { resolutionId?: string } = {},
): QueueResolutionRecord {
  return {
    resolutionId:
      overrides.resolutionId ?? "253a4e0e-d606-4438-9e7e-c27b0021994c",
    decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
    decisionHash: decision().decisionHash,
    action,
    delivery: {
      deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
      deliveryHash: delivery(decision(), null).deliveryHash,
    },
    relatedDecision: null,
    actor: { kind: "local_operator", label: "Local operator" },
    source: "human_labelled",
    recordedAt: now,
    note: null,
    resolutionHash: "e".repeat(64),
  };
}
