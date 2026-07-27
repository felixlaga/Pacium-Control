import { describe, expect, it } from "vitest";

import {
  MAX_QUEUE_ANSWER_BYTES,
  QueueApprovalDecisionPayloadSchema,
  QueueDecisionRecordSchema,
  QueueDecisionResultSchema,
  QueueItemDecisionStateSchema,
  QueueQuestionAnswerPayloadSchema,
  QueueStateDocumentSchema,
  queueDecisionError,
} from "./queue-decision.js";

const source = {
  workspaceId: "pacium",
  workspaceRevision: 4,
  sourceId: "needs-felix",
  observationRevision: 7,
  boundary: "whole_source_v1" as const,
  contentHash: "a".repeat(64),
  itemId: "b".repeat(64),
  itemType: "question" as const,
};

const questionDecision = {
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  kind: "question_answer" as const,
  source,
  payload: {
    answer: "Use the smaller verified slice.",
    note: null,
  },
  actor: {
    kind: "local_operator" as const,
    label: "Local operator" as const,
  },
  decidedAt: "2026-07-27T14:00:00.000Z",
  decisionHash: "c".repeat(64),
};

const requestIdentity = {
  workspaceRevision: source.workspaceRevision,
  sourceId: source.sourceId,
  observationRevision: source.observationRevision,
  contentHash: source.contentHash,
  itemId: source.itemId,
};

describe("queue decision contracts", () => {
  it("keeps question answers and approval outcomes structurally separate", () => {
    expect(
      QueueQuestionAnswerPayloadSchema.safeParse({
        answer: "Proceed with the narrow fix.",
        note: "Verified locally.",
      }).success,
    ).toBe(true);
    expect(
      QueueQuestionAnswerPayloadSchema.safeParse({
        answer: "Approve",
        outcome: "approved",
        note: null,
      }).success,
    ).toBe(false);
    expect(
      QueueApprovalDecisionPayloadSchema.safeParse({
        outcome: "denied",
        note: null,
      }).success,
    ).toBe(true);
    expect(
      QueueApprovalDecisionPayloadSchema.safeParse({
        outcome: "approved",
        answer: "yes",
        note: null,
      }).success,
    ).toBe(false);
  });

  it("bounds answers by UTF-8 bytes and rejects blank answers", () => {
    expect(
      QueueQuestionAnswerPayloadSchema.safeParse({
        answer: " \n\t ",
        note: null,
      }).success,
    ).toBe(false);
    expect(
      QueueQuestionAnswerPayloadSchema.safeParse({
        answer: "a".repeat(MAX_QUEUE_ANSWER_BYTES),
        note: null,
      }).success,
    ).toBe(true);
    expect(
      QueueQuestionAnswerPayloadSchema.safeParse({
        answer: "é".repeat(MAX_QUEUE_ANSWER_BYTES / 2 + 1),
        note: null,
      }).success,
    ).toBe(false);
  });

  it("requires record kind and classified source type to agree", () => {
    expect(QueueDecisionRecordSchema.safeParse(questionDecision).success).toBe(
      true,
    );
    expect(
      QueueDecisionRecordSchema.safeParse({
        ...questionDecision,
        source: { ...source, itemType: "approval" },
      }).success,
    ).toBe(false);
    expect(
      QueueDecisionRecordSchema.safeParse({
        ...questionDecision,
        actor: { kind: "local_operator", label: "Felix" },
      }).success,
    ).toBe(false);
  });

  it("enforces one immutable record per queue-item identity", () => {
    expect(
      QueueStateDocumentSchema.safeParse({
        schemaVersion: 1,
        revision: 1,
        decisions: [questionDecision],
      }).success,
    ).toBe(true);
    expect(
      QueueStateDocumentSchema.safeParse({
        schemaVersion: 1,
        revision: 2,
        decisions: [
          questionDecision,
          {
            ...questionDecision,
            decisionId: "4699b11f-94d3-430a-960e-1c574a03db41",
            decisionHash: "d".repeat(64),
            payload: { answer: "A different answer.", note: null },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("separates open, decided, and unavailable item state", () => {
    expect(
      QueueItemDecisionStateSchema.safeParse({
        status: "open",
        decision: null,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueItemDecisionStateSchema.safeParse({
        status: "decided",
        decision: questionDecision,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueItemDecisionStateSchema.safeParse({
        status: "unavailable",
        decision: null,
        error: queueDecisionError("DECISION_STATE_UNAVAILABLE"),
      }).success,
    ).toBe(true);
    expect(
      QueueItemDecisionStateSchema.safeParse({
        status: "open",
        decision: questionDecision,
        error: null,
      }).success,
    ).toBe(false);
  });

  it("requires result statuses to use the matching fixed safe error", () => {
    expect(
      QueueDecisionResultSchema.safeParse({
        status: "recorded",
        ...requestIdentity,
        decision: questionDecision,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueDecisionResultSchema.safeParse({
        status: "rejected",
        ...requestIdentity,
        decision: null,
        error: queueDecisionError("ITEM_ALREADY_DECIDED"),
      }).success,
    ).toBe(true);
    expect(
      QueueDecisionResultSchema.safeParse({
        status: "stale",
        ...requestIdentity,
        decision: null,
        error: queueDecisionError("DECISION_WRITE_FAILED"),
      }).success,
    ).toBe(false);
  });
});
