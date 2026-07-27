import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PaciumQueueInspectionState } from "./pacium-queue-inspection-model.js";
import { PaciumQueueDecisionPanel } from "./pacium-queue-decision-panel.js";

describe("Pacium queue decision panel", () => {
  it("renders a question answer without approval authority", () => {
    const html = render(questionState());

    expect(html).toContain("<h3");
    expect(html).toContain("Answer");
    expect(html).toContain("Record answer");
    expect(html).toContain("cannot approve an action");
    expect(html).not.toContain(">Approve<");
    expect(html).not.toContain(">Deny<");
  });

  it("renders separate labelled approval outcomes without an answer field", () => {
    const html = render({
      ...questionState(),
      selection: {
        ...questionState().selection!,
        type: "approval",
      },
    });

    expect(html).toContain("Approval decision");
    expect(html).toContain(">Approve<");
    expect(html).toContain(">Deny<");
    expect(html).toContain("separate from question answers");
    expect(html).not.toContain("Record answer");
  });

  it("renders an immutable recovered record and no active control", () => {
    const state = questionState();
    const html = render({
      ...state,
      decisionState: {
        status: "decided",
        decision: decision(),
        error: null,
      },
    });

    expect(html).toContain("Immutable local decision");
    expect(html).toContain("Use the verified slice.");
    expect(html).toContain("Local operator");
    expect(html).toContain("Not delivered yet");
    expect(html).toContain("c".repeat(64));
    expect(html).not.toContain("Record answer");
  });

  it("fails closed when durable state is unavailable", () => {
    const html = render({
      ...questionState(),
      decisionState: {
        status: "unavailable",
        decision: null,
        error: {
          code: "DECISION_STATE_UNAVAILABLE",
          message:
            "Local decision state is unavailable. Queue sources and terminals were not changed.",
        },
      },
    });

    expect(html).toContain("Decision unavailable");
    expect(html).toContain("Queue sources and terminals were not changed");
    expect(html).not.toContain("Record answer");
  });
});

function render(state: PaciumQueueInspectionState): string {
  return renderToStaticMarkup(
    <PaciumQueueDecisionPanel
      onRecordApproval={() => undefined}
      onRecordQuestion={() => undefined}
      state={state}
    />,
  );
}

function questionState(): PaciumQueueInspectionState {
  return {
    selection: {
      identity: {
        workspaceRevision: 4,
        sourceId: "needs-felix",
        observationRevision: 7,
        contentHash: "a".repeat(64),
        itemId: "b".repeat(64),
      },
      sourceLabel: "Needs Felix",
      sourcePath: "/queue/NEEDS-FELIX",
      requestingRole: "meta",
      type: "question",
      confidence: "high",
      boundary: "whole_source_v1",
      diagnostic: "A supported plain-text legacy marker was used.",
      firstObservedAt: "2026-07-27T11:50:00.000Z",
      sourceObservedAt: "2026-07-27T12:00:00.000Z",
    },
    requestId: null,
    status: "ready",
    originalText: "Question: Choose",
    inspection: {
      status: "ready",
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 7,
      contentHash: "a".repeat(64),
      itemId: "b".repeat(64),
      sourceObservedAt: "2026-07-27T12:00:00.000Z",
      firstObservedAt: "2026-07-27T11:50:00.000Z",
      byteLength: 16,
      error: null,
    },
    errorMessage: null,
    decisionState: {
      status: "open",
      decision: null,
      error: null,
    },
    decisionRequestId: null,
    decisionStatus: "idle",
    decisionErrorMessage: null,
  };
}

function decision() {
  return {
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
    payload: {
      answer: "Use the verified slice.",
      note: null,
    },
    actor: {
      kind: "local_operator" as const,
      label: "Local operator" as const,
    },
    decidedAt: "2026-07-27T12:05:00.000Z",
    decisionHash: "c".repeat(64),
  };
}
