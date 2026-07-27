import { describe, expect, it } from "vitest";

import {
  MAX_PACIUM_CONTEXT_SOURCE_BYTES,
  MAX_PACIUM_DECISION_PREVIEW_BYTES,
  MAX_PACIUM_RECENT_DECISIONS,
  PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES,
  PaciumContextObservationSchema,
  PaciumContextSourceObservationSchema,
  PaciumRecentDecisionSummarySchema,
} from "./pacium-context.js";

describe("Pacium control context contracts", () => {
  it("accepts independent ready, empty, and unconfigured source evidence", () => {
    const observedAt = "2026-07-27T12:00:00.000Z";
    expect(
      PaciumContextSourceObservationSchema.parse({
        kind: "objective",
        status: "ready",
        path: "/work/context/OBJECTIVE",
        format: "plain_text",
        observedAt,
        byteLength: 5,
        modifiedAt: observedAt,
        contentHash: "a".repeat(64),
        contentBase64: btoa("Build"),
        error: null,
      }).status,
    ).toBe("ready");
    expect(
      PaciumContextSourceObservationSchema.parse({
        kind: "plan",
        status: "empty",
        path: "/work/context/PLAN",
        format: "plain_text",
        observedAt,
        byteLength: 0,
        modifiedAt: observedAt,
        contentHash: "b".repeat(64),
        contentBase64: null,
        error: null,
      }).status,
    ).toBe("empty");
    expect(
      PaciumContextSourceObservationSchema.parse({
        kind: "plan",
        status: "unconfigured",
        path: null,
        format: null,
        observedAt,
        byteLength: null,
        modifiedAt: null,
        contentHash: null,
        contentBase64: null,
        error: null,
      }).status,
    ).toBe("unconfigured");
  });

  it("requires fixed safe degraded-source copy and matching status", () => {
    const source = {
      kind: "objective",
      status: "missing",
      path: "/work/context/OBJECTIVE",
      format: "plain_text",
      observedAt: "2026-07-27T12:00:00.000Z",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      contentBase64: null,
      error: {
        code: "missing",
        message: PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES.missing,
      },
    };
    expect(PaciumContextSourceObservationSchema.parse(source).status).toBe(
      "missing",
    );
    expect(() =>
      PaciumContextSourceObservationSchema.parse({
        ...source,
        error: { ...source.error, code: "unreadable" },
      }),
    ).toThrow();
    expect(() =>
      PaciumContextSourceObservationSchema.parse({
        ...source,
        error: { ...source.error, message: "read failed: private/path" },
      }),
    ).toThrow();
  });

  it("bounds raw context and encoded content", () => {
    const observedAt = "2026-07-27T12:00:00.000Z";
    const content = "x".repeat(MAX_PACIUM_CONTEXT_SOURCE_BYTES);
    const source = {
      kind: "objective",
      status: "ready",
      path: "/work/context/OBJECTIVE",
      format: "plain_text",
      observedAt,
      byteLength: content.length,
      modifiedAt: observedAt,
      contentHash: "c".repeat(64),
      contentBase64: btoa(content),
      error: null,
    };
    expect(PaciumContextSourceObservationSchema.parse(source).status).toBe(
      "ready",
    );
    expect(() =>
      PaciumContextSourceObservationSchema.parse({
        ...source,
        byteLength: MAX_PACIUM_CONTEXT_SOURCE_BYTES + 1,
      }),
    ).toThrow();
    expect(() =>
      PaciumContextSourceObservationSchema.parse({
        ...source,
        contentBase64: "not base64!",
      }),
    ).toThrow();
  });

  it("bounds question previews by UTF-8 bytes", () => {
    expect(
      recentDecision({
        response: {
          kind: "question_answer",
          preview: "é".repeat(MAX_PACIUM_DECISION_PREVIEW_BYTES / 2),
          truncated: true,
        },
      }).response.kind,
    ).toBe("question_answer");
    expect(() =>
      recentDecision({
        response: {
          kind: "question_answer",
          preview: "é".repeat(MAX_PACIUM_DECISION_PREVIEW_BYTES / 2 + 1),
          truncated: true,
        },
      }),
    ).toThrow();
  });

  it("keeps recent decision, transport, and human lifecycle evidence distinct", () => {
    const decision = recentDecision({
      delivery: {
        attemptCount: 2,
        deliveryId: "20000000-0000-4000-8000-000000000001",
        deliveryHash: "d".repeat(64),
        status: "delivered",
        requestedAt: "2026-07-27T12:01:00.000Z",
        completedAt: "2026-07-27T12:01:01.000Z",
        evidenceKind: "terminal_transport_accepted",
      },
      lifecycle: {
        resolutionId: "30000000-0000-4000-8000-000000000001",
        resolutionHash: "e".repeat(64),
        action: "applied",
        source: "human_labelled",
        actorLabel: "Local operator",
        recordedAt: "2026-07-27T12:02:00.000Z",
      },
    });
    expect(decision.delivery?.status).toBe("delivered");
    expect(decision.lifecycle).toMatchObject({
      action: "applied",
      source: "human_labelled",
    });
    expect(JSON.stringify(decision)).not.toMatch(
      /target|path|note|terminalBytes|provider/i,
    );
  });

  it("requires current source labels and valid delivery completion evidence", () => {
    expect(() =>
      recentDecision({ sourceCurrent: true, sourceLabel: null }),
    ).toThrow();
    expect(() =>
      recentDecision({
        delivery: {
          attemptCount: 1,
          deliveryId: "20000000-0000-4000-8000-000000000001",
          deliveryHash: "d".repeat(64),
          status: "failed",
          requestedAt: "2026-07-27T12:01:00.000Z",
          completedAt: null,
          evidenceKind: null,
        },
      }),
    ).toThrow();
    expect(
      recentDecision({
        delivery: {
          attemptCount: 1,
          deliveryId: "20000000-0000-4000-8000-000000000001",
          deliveryHash: "d".repeat(64),
          status: "unknown",
          requestedAt: "2026-07-27T12:01:00.000Z",
          completedAt: null,
          evidenceKind: null,
        },
      }).delivery?.status,
    ).toBe("unknown");
  });

  it("enforces source kinds, availability status, and the decision ceiling", () => {
    const observedAt = "2026-07-27T12:00:00.000Z";
    const observation = {
      status: "ready",
      workspaceId: "primary",
      workspaceRevision: 7,
      objective: unconfiguredSource("objective", observedAt),
      plan: unconfiguredSource("plan", observedAt),
      recentDecisions: {
        status: "ready",
        decisions: [],
        truncated: false,
        error: null,
      },
      observedAt,
      error: null,
    };
    expect(PaciumContextObservationSchema.parse(observation).status).toBe(
      "ready",
    );
    expect(() =>
      PaciumContextObservationSchema.parse({
        ...observation,
        objective: unconfiguredSource("plan", observedAt),
      }),
    ).toThrow();
    expect(() =>
      PaciumContextObservationSchema.parse({
        ...observation,
        status: "partial",
      }),
    ).toThrow();
    expect(() =>
      PaciumContextObservationSchema.parse({
        ...observation,
        recentDecisions: {
          ...observation.recentDecisions,
          decisions: Array.from(
            { length: MAX_PACIUM_RECENT_DECISIONS + 1 },
            (_, index) =>
              recentDecision({
                decisionId: `10000000-0000-4000-8000-${String(index).padStart(
                  12,
                  "0",
                )}`,
              }),
          ),
        },
      }),
    ).toThrow();
  });

  it("defines content-free unavailable workspace evidence", () => {
    const unavailable = PaciumContextObservationSchema.parse({
      status: "unavailable",
      workspaceId: null,
      workspaceRevision: null,
      objective: null,
      plan: null,
      recentDecisions: null,
      observedAt: "2026-07-27T12:00:00.000Z",
      error: {
        code: "config_unavailable",
        message: "Pacium configuration is unavailable.",
      },
    });
    expect(unavailable.workspaceId).toBeNull();
  });
});

function unconfiguredSource(kind: "objective" | "plan", observedAt: string) {
  return {
    kind,
    status: "unconfigured",
    path: null,
    format: null,
    observedAt,
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    contentBase64: null,
    error: null,
  };
}

function recentDecision(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof PaciumRecentDecisionSummarySchema.parse> {
  return PaciumRecentDecisionSummarySchema.parse({
    decisionId: "10000000-0000-4000-8000-000000000001",
    decisionHash: "a".repeat(64),
    workspaceId: "primary",
    sourceId: "needs-owner",
    sourceLabel: "Needs owner",
    sourceCurrent: true,
    itemId: "b".repeat(64),
    contentHash: "c".repeat(64),
    decidedAt: "2026-07-27T12:00:00.000Z",
    actorLabel: "Local operator",
    response: {
      kind: "approval_decision",
      outcome: "approved",
    },
    delivery: null,
    lifecycle: null,
    ...overrides,
  });
}
