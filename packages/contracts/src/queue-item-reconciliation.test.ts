import { describe, expect, it } from "vitest";

import { QueueItemReconciliationSchema } from "./queue-item-reconciliation.js";

const decisionId = "1d49b467-b5ce-4dc9-a6a8-6a618f9e68af";
const decisionHash = "a".repeat(64);
const attempt = {
  deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
  decisionId,
  decisionHash,
  target: {
    type: "answer_file" as const,
    methodId: "answers",
    methodLabel: "Pacium answers",
    path: "/private/tmp/PACIUM-ANSWERS",
  },
  payloadHash: "f".repeat(64),
  payloadByteLength: 512,
  requestedAt: "2026-07-27T11:00:00.000Z",
  outcome: null,
  deliveryHash: "d".repeat(64),
};
const confirmed = {
  resolutionId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
  decisionId,
  decisionHash,
  action: "confirmed_not_delivered" as const,
  delivery: {
    deliveryId: attempt.deliveryId,
    deliveryHash: attempt.deliveryHash,
  },
  relatedDecision: null,
  actor: { kind: "local_operator" as const, label: "Local operator" as const },
  source: "human_labelled" as const,
  recordedAt: "2026-07-27T12:00:00.000Z",
  note: null,
  resolutionHash: "e".repeat(64),
};

describe("queue item reconciliation contract", () => {
  it("derives retry eligibility only from attempts and lifecycle", () => {
    expect(
      QueueItemReconciliationSchema.safeParse({
        decisionId,
        decisionHash,
        conflicts: [],
        priorDecisions: { decisions: [], truncated: false },
        attempts: [attempt],
        artifact: {
          status: "acknowledgement_unavailable",
          source: "filesystem_observed",
          observedAt: "2026-07-27T12:00:00.000Z",
          reason: "answer_file_missing",
          byteLength: null,
          contentHash: null,
        },
        lifecycle: {
          status: "confirmed_not_delivered",
          current: confirmed,
          history: [confirmed],
          historyTruncated: false,
        },
        retry: { status: "ready" },
      }).success,
    ).toBe(true);
  });

  it("requires artifact, retry, and immutable identities to agree", () => {
    const base = {
      decisionId,
      decisionHash,
      conflicts: [],
      priorDecisions: { decisions: [], truncated: false },
      attempts: [attempt],
      artifact: {
        status: "acknowledgement_unavailable" as const,
        source: "filesystem_observed" as const,
        observedAt: "2026-07-27T12:00:00.000Z",
        reason: "answer_file_missing" as const,
        byteLength: null,
        contentHash: null,
      },
      lifecycle: {
        status: "awaiting_evidence" as const,
        current: null,
        history: [],
        historyTruncated: false,
      },
      retry: { status: "locked" as const },
    };
    expect(QueueItemReconciliationSchema.safeParse(base).success).toBe(true);
    expect(
      QueueItemReconciliationSchema.safeParse({
        ...base,
        artifact: null,
      }).success,
    ).toBe(false);
    expect(
      QueueItemReconciliationSchema.safeParse({
        ...base,
        retry: { status: "ready" },
      }).success,
    ).toBe(false);
    expect(
      QueueItemReconciliationSchema.safeParse({
        ...base,
        decisionHash: "9".repeat(64),
      }).success,
    ).toBe(false);
  });
});
