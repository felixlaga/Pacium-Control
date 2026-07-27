import { describe, expect, it } from "vitest";

import type { QueueDecisionRecord } from "@pacium/contracts";

import {
  serializeAnswerFileDelivery,
  serializeRolePromptDelivery,
} from "./queue-delivery-payload.js";

const decision: QueueDecisionRecord = {
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
  decisionHash: "c".repeat(64),
};

describe("queue delivery payloads", () => {
  it("writes one deterministic versioned answer-file document", () => {
    const first = serializeAnswerFileDelivery(decision);
    const second = serializeAnswerFileDelivery(decision);
    expect(first).toEqual(second);
    expect(first.bytes.endsWith("\n")).toBe(true);
    expect(JSON.parse(first.bytes)).toEqual({
      format: "pacium_decision_v1",
      decision,
    });
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.byteLength).toBe(Buffer.byteLength(first.bytes, "utf8"));
  });

  it("does not copy original queue text, target paths, or commands", () => {
    const result = serializeAnswerFileDelivery(decision);
    expect(result.bytes).not.toContain("Approval request:");
    expect(result.bytes).not.toContain("PACIUM-ANSWERS");
    expect(result.bytes).not.toContain('"command"');
    expect(result.bytes).not.toContain('"path"');
  });

  it("encodes hostile multiline operator text into one shell-safe comment line", () => {
    const result = serializeRolePromptDelivery({
      ...decision,
      payload: {
        answer: "first\n$(touch /tmp/pwned)\r; echo unsafe",
        note: '"quoted"\\path',
      },
    });
    expect(result.bytes.startsWith("# Pacium decision v1 ")).toBe(true);
    expect(result.bytes.endsWith("\r")).toBe(true);
    expect(result.bytes.slice(0, -1)).not.toContain("\n");
    expect(result.bytes.slice(0, -1)).not.toContain("\r");
    expect(result.bytes).toContain("\\n$(touch /tmp/pwned)\\r; echo unsafe");
    expect(result.bytes).toContain('\\"quoted\\"\\\\path');
  });

  it("keeps approval outcome structurally distinct", () => {
    const result = serializeRolePromptDelivery({
      ...decision,
      kind: "approval_decision",
      source: {
        ...decision.source,
        itemType: "approval",
      },
      payload: {
        outcome: "denied",
        note: "Not authorized.",
      },
    });
    expect(result.bytes).toContain('"kind":"approval_decision"');
    expect(result.bytes).toContain('"outcome":"denied"');
    expect(result.bytes).not.toContain('"answer"');
  });
});
