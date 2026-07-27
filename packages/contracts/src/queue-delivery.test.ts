import { describe, expect, it } from "vitest";

import {
  QueueAnswerFileDocumentSchema,
  QueueDeliveryResultSchema,
  QueueDeliveryStateSchema,
  QueueRolePromptDocumentSchema,
  QueueStateDocumentSchema,
  QueueStateV2DocumentSchema,
  queueDeliveryError,
} from "./queue-delivery.js";

const decision = {
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  kind: "question_answer" as const,
  source: {
    workspaceId: "pacium",
    workspaceRevision: 4,
    sourceId: "needs-felix",
    observationRevision: 7,
    boundary: "whole_source_v1" as const,
    contentHash: "a".repeat(64),
    itemId: "b".repeat(64),
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
  decisionHash: "c".repeat(64),
};

const target = {
  type: "answer_file" as const,
  methodId: "answers",
  methodLabel: "Pacium answers",
  path: "/private/tmp/PACIUM-ANSWERS",
};

const delivery = {
  deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
  decisionId: decision.decisionId,
  decisionHash: decision.decisionHash,
  target,
  payloadHash: "d".repeat(64),
  payloadByteLength: 512,
  requestedAt: "2026-07-27T15:00:00.000Z",
  outcome: null,
  deliveryHash: "e".repeat(64),
};

describe("queue delivery contracts", () => {
  it("accepts legacy v1 and current v2 state without weakening either shape", () => {
    expect(
      QueueStateDocumentSchema.safeParse({
        schemaVersion: 1,
        revision: 1,
        decisions: [decision],
      }).success,
    ).toBe(true);
    expect(
      QueueStateV2DocumentSchema.safeParse({
        schemaVersion: 2,
        revision: 2,
        decisions: [decision],
        deliveries: [delivery],
      }).success,
    ).toBe(true);
    expect(
      QueueStateDocumentSchema.safeParse({
        schemaVersion: 2,
        revision: 2,
        decisions: [decision],
      }).success,
    ).toBe(false);
  });

  it("requires one delivery per matching immutable decision", () => {
    expect(
      QueueStateV2DocumentSchema.safeParse({
        schemaVersion: 2,
        revision: 2,
        decisions: [decision],
        deliveries: [
          delivery,
          {
            ...delivery,
            deliveryId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
            deliveryHash: "f".repeat(64),
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      QueueStateV2DocumentSchema.safeParse({
        schemaVersion: 2,
        revision: 2,
        decisions: [decision],
        deliveries: [
          {
            ...delivery,
            decisionHash: "f".repeat(64),
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps answer-file and role-prompt payloads data-only", () => {
    expect(
      QueueAnswerFileDocumentSchema.safeParse({
        format: "pacium_decision_v1",
        decision,
      }).success,
    ).toBe(true);
    expect(
      QueueRolePromptDocumentSchema.safeParse({
        format: "pacium_decision_v1",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        kind: decision.kind,
        payload: decision.payload,
      }).success,
    ).toBe(true);
    expect(
      QueueRolePromptDocumentSchema.safeParse({
        format: "pacium_decision_v1",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        kind: decision.kind,
        payload: decision.payload,
        command: "rm -rf /",
      }).success,
    ).toBe(false);
  });

  it("keeps ready, delivered, failed, and unknown evidence distinct", () => {
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "ready",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target,
        delivery: null,
        error: null,
      }).success,
    ).toBe(true);

    const delivered = {
      ...delivery,
      outcome: {
        status: "delivered" as const,
        recordedAt: "2026-07-27T15:00:01.000Z",
        evidence: {
          kind: "answer_file_created" as const,
          byteLength: 512,
          contentHash: "d".repeat(64),
        },
        error: null,
      },
    };
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "delivered",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target,
        delivery: delivered,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "failed",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target,
        delivery: delivered,
        error: queueDeliveryError("DELIVERY_WRITE_FAILED"),
      }).success,
    ).toBe(false);
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "unknown",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target,
        delivery,
        error: queueDeliveryError("DELIVERY_OUTCOME_UNKNOWN"),
      }).success,
    ).toBe(true);
  });

  it("requires result status to agree with the complete state", () => {
    const state = {
      status: "unknown" as const,
      decisionId: decision.decisionId,
      decisionHash: decision.decisionHash,
      target,
      delivery,
      error: queueDeliveryError("DELIVERY_OUTCOME_UNKNOWN"),
    };
    expect(
      QueueDeliveryResultSchema.safeParse({
        status: "unknown",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        state,
      }).success,
    ).toBe(true);
    expect(
      QueueDeliveryResultSchema.safeParse({
        status: "delivered",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        state,
      }).success,
    ).toBe(false);
    expect(
      QueueDeliveryResultSchema.safeParse({
        status: "unknown",
        decisionId: "bb3d98ca-8308-46d7-9fe3-cf8a131e8dad",
        decisionHash: decision.decisionHash,
        state,
      }).success,
    ).toBe(false);
    expect(
      QueueDeliveryStateSchema.safeParse({
        ...state,
        decisionHash: "f".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("rejects forged target and retry authority", () => {
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "ready",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target: {
          ...target,
          command: "send",
        },
        delivery: null,
        error: null,
      }).success,
    ).toBe(false);
    expect(
      QueueDeliveryResultSchema.safeParse({
        status: "rejected",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        state: {
          status: "not_configured",
          decisionId: decision.decisionId,
          decisionHash: decision.decisionHash,
          target: null,
          delivery: null,
          error: queueDeliveryError("DELIVERY_NOT_CONFIGURED"),
        },
        retry: true,
      }).success,
    ).toBe(false);
    expect(
      QueueDeliveryStateSchema.safeParse({
        status: "not_configured",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target: null,
        delivery: null,
        error: queueDeliveryError("DELIVERY_STATE_UNAVAILABLE"),
      }).success,
    ).toBe(false);
  });
});
