import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumQueueDeliveryPanel } from "./pacium-queue-delivery-panel.js";

const decision = {
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  kind: "question_answer" as const,
  source: {
    workspaceId: "primary",
    workspaceRevision: 4,
    sourceId: "needs-felix",
    observationRevision: 7,
    boundary: "whole_source_v1" as const,
    contentHash: "a".repeat(64),
    itemId: "b".repeat(64),
    itemType: "question" as const,
  },
  payload: { answer: "Use the verified slice.", note: null },
  actor: {
    kind: "local_operator" as const,
    label: "Local operator" as const,
  },
  decidedAt: "2026-07-27T12:05:00.000Z",
  decisionHash: "c".repeat(64),
};

const target = {
  type: "answer_file" as const,
  methodId: "answers",
  methodLabel: "Pacium answers",
  path: "/queue/PACIUM-ANSWERS",
};

describe("Pacium queue delivery panel", () => {
  it("requires review before one compatible delivery action", () => {
    const html = render({
      status: "ready",
      decisionId: decision.decisionId,
      decisionHash: decision.decisionHash,
      target,
      delivery: null,
      error: null,
    });

    expect(html).toContain("Ready for delivery");
    expect(html).toContain("<summary>Review delivery</summary>");
    expect(html).toContain("Cancel");
    expect(html).toContain("Confirm delivery");
    expect(html).toContain("/queue/PACIUM-ANSWERS");
    expect(html).toContain("will not be overwritten");
    expect(html).not.toContain("retry");
  });

  it("renders unavailable state without a delivery control", () => {
    const html = render({
      status: "unavailable",
      decisionId: decision.decisionId,
      decisionHash: decision.decisionHash,
      target,
      delivery: null,
      error: {
        code: "DELIVERY_TARGET_OCCUPIED",
        message:
          "The configured answer file already exists. Pacium did not overwrite it.",
      },
    });

    expect(html).toContain("Delivery unavailable");
    expect(html).toContain("already exists");
    expect(html).not.toContain("Confirm delivery");
  });

  it("keeps terminal acceptance distinct from agent handling", () => {
    const roleTarget = {
      type: "role_prompt" as const,
      methodId: "orchestrator-prompt",
      methodLabel: "Orchestrator prompt",
      role: "orchestrator" as const,
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      sessionEpoch: 3,
    };
    const html = render({
      status: "delivered",
      decisionId: decision.decisionId,
      decisionHash: decision.decisionHash,
      target: roleTarget,
      delivery: {
        deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target: roleTarget,
        payloadHash: "d".repeat(64),
        payloadByteLength: 512,
        requestedAt: "2026-07-27T12:06:00.000Z",
        outcome: {
          status: "delivered",
          recordedAt: "2026-07-27T12:06:01.000Z",
          evidence: {
            kind: "terminal_transport_accepted",
            sessionId: roleTarget.sessionId,
            sessionEpoch: roleTarget.sessionEpoch,
            byteLength: 512,
            contentHash: "d".repeat(64),
          },
          error: null,
        },
        deliveryHash: "e".repeat(64),
      },
      error: null,
    });

    expect(html).toContain("terminal accepted");
    expect(html).toContain("Agent handling is not confirmed");
    expect(html).not.toContain("Confirm delivery");
  });

  it("reports unknown outcomes without a retry action", () => {
    const html = render({
      status: "unknown",
      decisionId: decision.decisionId,
      decisionHash: decision.decisionHash,
      target,
      delivery: {
        deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
        decisionId: decision.decisionId,
        decisionHash: decision.decisionHash,
        target,
        payloadHash: "d".repeat(64),
        payloadByteLength: 512,
        requestedAt: "2026-07-27T12:06:00.000Z",
        outcome: null,
        deliveryHash: "e".repeat(64),
      },
      error: {
        code: "DELIVERY_OUTCOME_UNKNOWN",
        message:
          "The delivery side effect may have occurred, but its durable outcome is unknown. Pacium will not retry it.",
      },
    });

    expect(html).toContain("Delivery outcome unknown");
    expect(html).toContain("will not retry");
    expect(html).not.toContain("Confirm delivery");
  });
});

function render(
  state: Parameters<typeof PaciumQueueDeliveryPanel>[0]["state"],
): string {
  return renderToStaticMarkup(
    <PaciumQueueDeliveryPanel
      decision={decision}
      errorMessage={null}
      onDeliver={() => undefined}
      state={state}
      status="idle"
    />,
  );
}
