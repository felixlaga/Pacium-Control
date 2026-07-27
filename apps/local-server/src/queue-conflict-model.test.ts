import type {
  QueueDecisionRecord,
  QueueSourceObservation,
  QueueSourcesObservation,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { withQueueSourceConflicts } from "./queue-conflict-model.js";

const observedAt = "2026-07-27T12:00:00.000Z";
const currentItemId = "b".repeat(64);
const contentHash = "a".repeat(64);

describe("queue source conflict model", () => {
  it("derives a stable source rewrite from prior immutable identity", () => {
    const result = withQueueSourceConflicts(observation([source()]), "pacium", [
      decision({ itemId: "c".repeat(64) }),
    ]);
    expect(result.sources[0]?.conflicts).toEqual([
      expect.objectContaining({
        kind: "source_changed_after_decision",
        decisionCount: 1,
        relatedSourceIds: [],
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("Use the smaller slice");
  });

  it("keeps empty, missing, and changing sources visibly conflicted", () => {
    for (const status of ["empty", "missing", "changing"] as const) {
      const degraded = source({
        status,
        byteLength: status === "empty" ? 0 : null,
        contentHash:
          status === "empty"
            ? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            : null,
        classification: null,
        candidateFirstObservedAt: null,
      });
      const result = withQueueSourceConflicts(
        observation([degraded]),
        "pacium",
        [decision()],
      );
      expect(result.sources[0]?.conflicts[0]).toMatchObject({
        kind: "source_unavailable_after_decision",
        decisionCount: 1,
      });
    }
  });

  it("marks exact current duplicates on every accepted source", () => {
    const result = withQueueSourceConflicts(
      observation([
        source({ sourceId: "meta-queue" }),
        source({ sourceId: "orchestrator-queue" }),
      ]),
      "pacium",
      [],
    );
    expect(result.sources[0]?.conflicts).toEqual([
      expect.objectContaining({
        kind: "duplicate_current_item",
        decisionCount: 0,
        relatedSourceIds: ["orchestrator-queue"],
      }),
    ]);
    expect(result.sources[1]?.conflicts).toEqual([
      expect.objectContaining({
        kind: "duplicate_current_item",
        decisionCount: 0,
        relatedSourceIds: ["meta-queue"],
      }),
    ]);
  });

  it("ignores another workspace and an exact current decision", () => {
    const result = withQueueSourceConflicts(observation([source()]), "pacium", [
      decision(),
      decision({
        decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
        workspaceId: "other",
        itemId: "c".repeat(64),
      }),
    ]);
    expect(result.sources[0]?.conflicts).toEqual([]);
  });
});

function observation(
  sources: QueueSourceObservation[],
): QueueSourcesObservation {
  return {
    status: "ready",
    workspaceRevision: 4,
    observedAt,
    sources,
    error: null,
  };
}

function source(
  overrides: Partial<QueueSourceObservation> = {},
): QueueSourceObservation {
  return {
    sourceId: "needs-felix",
    observationRevision: 7,
    status: "stable",
    observedAt,
    byteLength: 24,
    modifiedAt: observedAt,
    contentHash,
    classification: {
      status: "candidate",
      boundary: "whole_source_v1",
      candidate: {
        itemId: currentItemId,
        type: "question",
        confidence: "high",
      },
      diagnostics: [],
    },
    candidateFirstObservedAt: observedAt,
    conflicts: [],
    error: null,
    ...overrides,
  };
}

function decision(
  overrides: {
    decisionId?: string;
    itemId?: string;
    workspaceId?: string;
  } = {},
): QueueDecisionRecord {
  return {
    decisionId: overrides.decisionId ?? "28c9142a-8986-43c7-9451-445fd8c13c3e",
    kind: "question_answer",
    source: {
      workspaceId: overrides.workspaceId ?? "pacium",
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 6,
      boundary: "whole_source_v1",
      contentHash: "9".repeat(64),
      itemId: overrides.itemId ?? currentItemId,
      itemType: "question",
    },
    payload: {
      answer: "Use the smaller slice.",
      note: null,
    },
    actor: {
      kind: "local_operator",
      label: "Local operator",
    },
    decidedAt: "2026-07-27T11:00:00.000Z",
    decisionHash:
      overrides.workspaceId === "other" ? "e".repeat(64) : "d".repeat(64),
  };
}
