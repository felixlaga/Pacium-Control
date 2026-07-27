import { describe, expect, it } from "vitest";

import type { QueueDecisionRecord } from "@pacium/contracts";

import {
  computeQueueDecisionHash,
  hasValidQueueDecisionHash,
  type UnhashedQueueDecision,
} from "./queue-decision-hash.js";

const decision: UnhashedQueueDecision = {
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  kind: "question_answer",
  source: {
    workspaceId: "pacium",
    workspaceRevision: 4,
    sourceId: "needs-felix",
    observationRevision: 7,
    boundary: "whole_source_v1",
    contentHash: "a".repeat(64),
    itemId: "b".repeat(64),
    itemType: "question",
  },
  payload: {
    answer: "Use the smaller verified slice.",
    note: null,
  },
  actor: {
    kind: "local_operator",
    label: "Local operator",
  },
  decidedAt: "2026-07-27T14:00:00.000Z",
};

describe("queue decision hashing", () => {
  it("produces a deterministic lower-case SHA-256 hash", () => {
    expect(computeQueueDecisionHash(decision)).toBe(
      "3a8871070c1973520f8502a88107cafeb2d5426728257512328cce3f78e16974",
    );
  });

  it("canonicalizes object property order", () => {
    const reordered = {
      decidedAt: decision.decidedAt,
      actor: decision.actor,
      payload: decision.payload,
      source: decision.source,
      kind: decision.kind,
      decisionId: decision.decisionId,
    } as UnhashedQueueDecision;

    expect(computeQueueDecisionHash(reordered)).toBe(
      computeQueueDecisionHash(decision),
    );
  });

  it("detects payload and provenance tampering", () => {
    const record: QueueDecisionRecord = {
      ...decision,
      decisionHash: computeQueueDecisionHash(decision),
    };
    expect(hasValidQueueDecisionHash(record)).toBe(true);
    expect(
      hasValidQueueDecisionHash({
        ...record,
        payload: {
          answer: "A changed answer.",
          note: null,
        },
      }),
    ).toBe(false);
    expect(
      hasValidQueueDecisionHash({
        ...record,
        source: {
          ...record.source,
          itemId: "c".repeat(64),
        },
      }),
    ).toBe(false);
  });
});
