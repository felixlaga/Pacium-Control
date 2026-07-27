import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PaciumContextInspector } from "./pacium-context-inspector.js";
import type { PaciumContextViewState } from "./pacium-context-model.js";

describe("Pacium Control context inspector", () => {
  it("renders inert objective, empty plan, and separate decision evidence", () => {
    const markup = render(state());
    expect(markup).toContain("Objective, plan, and decisions");
    expect(markup).toContain("<pre");
    expect(markup).toContain("Ship the terminal slice");
    expect(markup).toContain("The configured file is empty");
    expect(markup).toContain("Question answered");
    expect(markup).toContain("Proceed with the bounded slice.");
    expect(markup).toContain("Terminal transport accepted");
    expect(markup).toContain("Applied · human labelled");
    expect(markup).toContain(
      "They do not prove provider handling or resulting Git work.",
    );
    expect(markup).not.toMatch(/Approve|Deny|Deliver|Apply now/);
  });

  it("escapes hostile context and answer preview content", () => {
    const hostile = state();
    hostile.objectiveText = "</pre><script>context()</script>";
    if (
      hostile.observation?.status === "ready" &&
      hostile.observation.recentDecisions.status === "ready"
    ) {
      const decision = hostile.observation.recentDecisions.decisions[0];
      if (decision?.response.kind === "question_answer") {
        decision.response.preview =
          '</blockquote><img src=x onerror="decision()">';
      }
    }
    const markup = render(hostile);
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;context()&lt;/script&gt;");
    expect(markup).toContain(
      "&lt;img src=x onerror=&quot;decision()&quot;&gt;",
    );
  });

  it("keeps prior evidence visible during explicit Refresh", () => {
    const refreshing = state();
    refreshing.status = "loading";
    refreshing.pendingRequestId = "request-2";
    const markup = render(refreshing);
    expect(markup).toContain(
      "Refreshing. Prior accepted evidence remains visible.",
    );
    expect(markup).toContain("Ship the terminal slice");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Refreshing…");
  });

  it("renders partial source and decision-state degradation independently", () => {
    const partial = state();
    partial.status = "partial";
    if (partial.observation?.status === "ready") {
      partial.observation.status = "partial";
      partial.observation.objective = {
        kind: "objective",
        status: "missing",
        path: "/context/OBJECTIVE",
        format: "plain_text",
        observedAt: "2026-07-27T12:00:00.000Z",
        byteLength: null,
        modifiedAt: null,
        contentHash: null,
        contentBase64: null,
        error: {
          code: "missing",
          message: "The configured context file is missing.",
        },
      };
      partial.observation.recentDecisions = {
        status: "unavailable",
        decisions: [],
        truncated: false,
        error: {
          code: "decision_state_unavailable",
          message:
            "Recent decision state is unavailable. Context files and terminals remain available.",
        },
      };
    }
    partial.objectiveText = null;
    const markup = render(partial);
    expect(markup).toContain("Partial evidence");
    expect(markup).toContain("The configured context file is missing.");
    expect(markup).toContain(
      "Recent decision state is unavailable. Context files and terminals remain available.",
    );
    expect(markup).toContain("The configured file is empty");
  });

  it("teaches initial loading and fail-closed error states", () => {
    const loading: PaciumContextViewState = {
      status: "loading",
      selection: {
        workspaceId: "primary",
        workspaceRevision: 7,
      },
      pendingRequestId: "request-1",
      observation: null,
      objectiveText: null,
      planText: null,
      error: null,
    };
    expect(render(loading)).toContain(
      "Reading the two accepted context sources",
    );
    expect(
      render({
        ...loading,
        status: "error",
        pendingRequestId: null,
        error: "Configuration changed.",
      }),
    ).toContain("No terminal, configured source, or queue state was changed.");
  });

  it("labels preview and list truncation explicitly", () => {
    const truncated = state();
    if (
      truncated.observation?.status === "ready" &&
      truncated.observation.recentDecisions.status === "ready"
    ) {
      truncated.observation.recentDecisions.truncated = true;
      const decision = truncated.observation.recentDecisions.decisions[0];
      if (decision?.response.kind === "question_answer") {
        decision.response.truncated = true;
      }
    }
    const markup = render(truncated);
    expect(markup).toContain('aria-label="Answer preview truncated"');
    expect(markup).toContain(
      "Only the 12 newest immutable decisions are shown.",
    );
  });
});

function render(contextState: PaciumContextViewState): string {
  return renderToStaticMarkup(
    <PaciumContextInspector
      onBack={vi.fn()}
      onRefresh={vi.fn()}
      state={contextState}
    />,
  );
}

function state(): PaciumContextViewState {
  return {
    status: "ready",
    selection: {
      workspaceId: "primary",
      workspaceRevision: 7,
    },
    pendingRequestId: null,
    objectiveText: "Ship the terminal slice",
    planText: null,
    error: null,
    observation: {
      status: "ready",
      workspaceId: "primary",
      workspaceRevision: 7,
      objective: {
        kind: "objective",
        status: "ready",
        path: "/context/OBJECTIVE",
        format: "plain_text",
        observedAt: "2026-07-27T12:00:00.000Z",
        byteLength: 23,
        modifiedAt: "2026-07-27T11:59:00.000Z",
        contentHash: "a".repeat(64),
        contentBase64: btoa("Ship the terminal slice"),
        error: null,
      },
      plan: {
        kind: "plan",
        status: "empty",
        path: "/context/PLAN",
        format: "plain_text",
        observedAt: "2026-07-27T12:00:00.000Z",
        byteLength: 0,
        modifiedAt: "2026-07-27T11:58:00.000Z",
        contentHash: "b".repeat(64),
        contentBase64: null,
        error: null,
      },
      recentDecisions: {
        status: "ready",
        truncated: false,
        error: null,
        decisions: [
          {
            decisionId: "10000000-0000-4000-8000-000000000001",
            decisionHash: "c".repeat(64),
            workspaceId: "primary",
            sourceId: "needs-owner",
            sourceLabel: "Needs owner",
            sourceCurrent: true,
            itemId: "d".repeat(64),
            contentHash: "e".repeat(64),
            decidedAt: "2026-07-27T11:55:00.000Z",
            actorLabel: "Local operator",
            response: {
              kind: "question_answer",
              preview: "Proceed with the bounded slice.",
              truncated: false,
            },
            delivery: {
              attemptCount: 1,
              deliveryId: "20000000-0000-4000-8000-000000000001",
              deliveryHash: "f".repeat(64),
              status: "delivered",
              requestedAt: "2026-07-27T11:56:00.000Z",
              completedAt: "2026-07-27T11:56:01.000Z",
              evidenceKind: "terminal_transport_accepted",
            },
            lifecycle: {
              resolutionId: "30000000-0000-4000-8000-000000000001",
              resolutionHash: "1".repeat(64),
              action: "applied",
              source: "human_labelled",
              actorLabel: "Local operator",
              recordedAt: "2026-07-27T11:57:00.000Z",
            },
          },
        ],
      },
      observedAt: "2026-07-27T12:00:00.000Z",
      error: null,
    },
  };
}
