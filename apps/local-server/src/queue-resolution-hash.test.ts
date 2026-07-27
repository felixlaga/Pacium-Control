import type { QueueResolutionRecord } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  computeQueueResolutionHash,
  hasValidQueueResolutionHash,
  type UnhashedQueueResolution,
} from "./queue-resolution-hash.js";

const resolution: UnhashedQueueResolution = {
  resolutionId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
  decisionId: "1d49b467-b5ce-4dc9-a6a8-6a618f9e68af",
  decisionHash: "a".repeat(64),
  action: "acknowledged",
  delivery: {
    deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
    deliveryHash: "d".repeat(64),
  },
  relatedDecision: null,
  actor: { kind: "local_operator", label: "Local operator" },
  source: "human_labelled",
  recordedAt: "2026-07-27T12:00:00.000Z",
  note: "Confirmed with Meta",
};

describe("queue resolution hashing", () => {
  it("is canonical across object key order", () => {
    expect(computeQueueResolutionHash(resolution)).toBe(
      "06c86b5044326e90f32ddcd3a5170c4012c0ebf010041ff748b3dde46bfe9961",
    );
    const reordered = {
      note: resolution.note,
      recordedAt: resolution.recordedAt,
      source: resolution.source,
      actor: resolution.actor,
      relatedDecision: resolution.relatedDecision,
      delivery: resolution.delivery,
      action: resolution.action,
      decisionHash: resolution.decisionHash,
      decisionId: resolution.decisionId,
      resolutionId: resolution.resolutionId,
    };
    expect(computeQueueResolutionHash(reordered)).toBe(
      computeQueueResolutionHash(resolution),
    );
  });

  it("detects immutable record tampering", () => {
    const record: QueueResolutionRecord = {
      ...resolution,
      resolutionHash: computeQueueResolutionHash(resolution),
    };
    expect(hasValidQueueResolutionHash(record)).toBe(true);
    expect(
      hasValidQueueResolutionHash({
        ...record,
        note: "Different evidence",
      }),
    ).toBe(false);
  });
});
