import { describe, expect, it } from "vitest";

import {
  QueueArtifactObservationSchema,
  QueueLifecycleStateSchema,
  QueueResolutionRecordSchema,
  QueueResolutionRequestSchema,
  QueueResolutionResultSchema,
  QueueSourceConflictSchema,
  queueResolutionError,
} from "./queue-reconciliation.js";

const delivery = {
  deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
  deliveryHash: "d".repeat(64),
};

const resolution = {
  resolutionId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
  decisionId: "1d49b467-b5ce-4dc9-a6a8-6a618f9e68af",
  decisionHash: "a".repeat(64),
  action: "acknowledged" as const,
  delivery,
  relatedDecision: null,
  actor: { kind: "local_operator" as const, label: "Local operator" as const },
  source: "human_labelled" as const,
  recordedAt: "2026-07-27T12:00:00.000Z",
  note: "Checked with Meta",
  resolutionHash: "e".repeat(64),
};

describe("queue reconciliation contracts", () => {
  it("keeps delivery and supersession references action-specific", () => {
    expect(QueueResolutionRecordSchema.safeParse(resolution).success).toBe(
      true,
    );
    expect(
      QueueResolutionRecordSchema.safeParse({
        ...resolution,
        action: "superseded",
      }).success,
    ).toBe(false);
    expect(
      QueueResolutionRecordSchema.safeParse({
        ...resolution,
        action: "superseded",
        delivery: null,
        relatedDecision: {
          decisionId: "253a4e0e-d606-4438-9e7e-c27b0021994c",
          decisionHash: "b".repeat(64),
        },
      }).success,
    ).toBe(true);
  });

  it("rejects browser-authored resolution evidence", () => {
    const request = {
      decisionId: resolution.decisionId,
      decisionHash: resolution.decisionHash,
      action: "acknowledged",
      delivery,
      relatedDecision: null,
      note: null,
    };
    expect(QueueResolutionRequestSchema.safeParse(request).success).toBe(true);
    expect(
      QueueResolutionRequestSchema.safeParse({
        ...request,
        actor: resolution.actor,
      }).success,
    ).toBe(false);
    expect(
      QueueResolutionRequestSchema.safeParse({
        ...request,
        path: "/tmp/answer",
      }).success,
    ).toBe(false);
    expect(
      QueueResolutionRequestSchema.safeParse({
        ...request,
        retry: true,
      }).success,
    ).toBe(false);
  });

  it("requires result records and fixed errors to match status", () => {
    expect(
      QueueResolutionResultSchema.safeParse({
        status: "recorded",
        decisionId: resolution.decisionId,
        decisionHash: resolution.decisionHash,
        resolution,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueResolutionResultSchema.safeParse({
        status: "durability_unknown",
        decisionId: resolution.decisionId,
        decisionHash: resolution.decisionHash,
        resolution: null,
        error: queueResolutionError("RESOLUTION_DURABILITY_UNKNOWN"),
      }).success,
    ).toBe(true);
    expect(
      QueueResolutionResultSchema.safeParse({
        status: "rejected",
        decisionId: resolution.decisionId,
        decisionHash: resolution.decisionHash,
        resolution: null,
        error: queueResolutionError("RESOLUTION_DURABILITY_UNKNOWN"),
      }).success,
    ).toBe(false);
  });

  it("keeps source conflicts content-free and duplicate-specific", () => {
    expect(
      QueueSourceConflictSchema.safeParse({
        conflictId: "c".repeat(64),
        kind: "duplicate_current_item",
        decisionCount: 1,
        relatedSourceIds: ["other-source"],
        observedAt: "2026-07-27T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      QueueSourceConflictSchema.safeParse({
        conflictId: "c".repeat(64),
        kind: "source_changed_after_decision",
        decisionCount: 1,
        relatedSourceIds: ["other-source"],
        observedAt: "2026-07-27T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("separates exact artifacts from unavailable acknowledgement", () => {
    expect(
      QueueArtifactObservationSchema.safeParse({
        status: "transport_artifact_present",
        source: "filesystem_observed",
        observedAt: "2026-07-27T12:00:00.000Z",
        reason: null,
        byteLength: 140,
        contentHash: "f".repeat(64),
      }).success,
    ).toBe(true);
    expect(
      QueueArtifactObservationSchema.safeParse({
        status: "acknowledgement_unavailable",
        source: "provider_unavailable",
        observedAt: "2026-07-27T12:00:00.000Z",
        reason: "answer_file_missing",
        byteLength: null,
        contentHash: null,
      }).success,
    ).toBe(false);
  });

  it("requires lifecycle current evidence to match the status", () => {
    expect(
      QueueLifecycleStateSchema.safeParse({
        status: "awaiting_evidence",
        current: null,
        history: [],
        historyTruncated: false,
      }).success,
    ).toBe(true);
    expect(
      QueueLifecycleStateSchema.safeParse({
        status: "applied",
        current: resolution,
        history: [resolution],
        historyTruncated: false,
      }).success,
    ).toBe(false);
  });
});
