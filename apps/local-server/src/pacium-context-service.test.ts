import type {
  PaciumContextSourceObservation,
  PaciumWorkspace,
  QueueDecisionRecord,
  QueueDeliveryRecord,
  QueueResolutionRecord,
} from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import type { PaciumConfigStore } from "./pacium-config-store.js";
import {
  PaciumContextService,
  projectRecentDecisions,
} from "./pacium-context-service.js";
import type {
  QueueDecisionStore,
  QueueDecisionStoreObservation,
} from "./queue-decision-store.js";

const observedAt = "2026-07-27T12:30:00.000Z";

describe("Pacium context service", () => {
  it("joins current source labels, latest attempt, and latest human lifecycle", () => {
    const first = decision({
      decisionId: "10000000-0000-4000-8000-000000000001",
      decidedAt: "2026-07-27T12:00:00.000Z",
    });
    const newer = decision({
      decisionId: "10000000-0000-4000-8000-000000000002",
      decidedAt: "2026-07-27T12:05:00.000Z",
      source: {
        ...decision().source,
        itemId: "f".repeat(64),
        contentHash: "e".repeat(64),
      },
    });
    const state = readyState({
      decisions: [first, newer],
      deliveries: [
        delivery(first, {
          deliveryId: "20000000-0000-4000-8000-000000000001",
          requestedAt: "2026-07-27T12:01:00.000Z",
          outcome: {
            status: "failed",
            recordedAt: "2026-07-27T12:01:01.000Z",
            evidence: null,
            error: {
              code: "DELIVERY_WRITE_FAILED",
              message:
                "The configured transport failed before delivery could be confirmed.",
            },
          },
        }),
        delivery(first, {
          deliveryId: "20000000-0000-4000-8000-000000000002",
          requestedAt: "2026-07-27T12:03:00.000Z",
          outcome: {
            status: "delivered",
            recordedAt: "2026-07-27T12:03:01.000Z",
            evidence: {
              kind: "terminal_transport_accepted",
              sessionId: "90000000-0000-4000-8000-000000000001",
              sessionEpoch: 1,
              byteLength: 50,
              contentHash: "9".repeat(64),
            },
            error: null,
          },
        }),
      ],
      resolutions: [
        resolution(first, {
          resolutionId: "30000000-0000-4000-8000-000000000001",
          action: "acknowledged",
          recordedAt: "2026-07-27T12:02:00.000Z",
        }),
        resolution(first, {
          resolutionId: "30000000-0000-4000-8000-000000000002",
          action: "applied",
          recordedAt: "2026-07-27T12:04:00.000Z",
        }),
      ],
    });

    const projected = projectRecentDecisions(workspace(), state);
    expect(projected.status).toBe("ready");
    if (projected.status !== "ready") {
      throw new Error("expected recent decision evidence");
    }
    expect(projected.decisions.map(({ decisionId }) => decisionId)).toEqual([
      newer.decisionId,
      first.decisionId,
    ]);
    expect(projected.decisions[1]).toMatchObject({
      sourceLabel: "Needs owner",
      sourceCurrent: true,
      delivery: {
        attemptCount: 2,
        status: "delivered",
        evidenceKind: "terminal_transport_accepted",
      },
      lifecycle: {
        action: "applied",
        source: "human_labelled",
      },
    });
  });

  it("marks removed sources former and preserves unfinished intent as unknown", () => {
    const item = decision({
      source: {
        ...decision().source,
        sourceId: "former-source",
      },
    });
    const projected = projectRecentDecisions(
      workspace(),
      readyState({
        decisions: [item],
        deliveries: [
          delivery(item, {
            outcome: null,
          }),
        ],
      }),
    );
    if (projected.status !== "ready") {
      throw new Error("expected recent decision evidence");
    }
    expect(projected.decisions[0]).toMatchObject({
      sourceCurrent: false,
      sourceLabel: null,
      delivery: {
        status: "unknown",
        completedAt: null,
      },
    });
  });

  it("labels only process-local active unfinished intent as delivering", () => {
    const item = decision();
    const attempt = delivery(item, { outcome: null });
    const projected = projectRecentDecisions(
      workspace(),
      readyState({ decisions: [item], deliveries: [attempt] }),
      (deliveryId) => deliveryId === attempt.deliveryId,
    );
    if (projected.status !== "ready") {
      throw new Error("expected recent decision evidence");
    }
    expect(projected.decisions[0]?.delivery?.status).toBe("delivering");
  });

  it("truncates question previews on a UTF-8 boundary and caps recent records", () => {
    const decisions = Array.from({ length: 14 }, (_, index) =>
      decision({
        decisionId: `10000000-0000-4000-8000-${String(index).padStart(
          12,
          "0",
        )}`,
        decidedAt: `2026-07-27T12:${String(index).padStart(2, "0")}:00.000Z`,
        source: {
          ...decision().source,
          itemId: index.toString(16).padStart(64, "0"),
          contentHash: (index + 20).toString(16).padStart(64, "0"),
        },
        payload: {
          answer: "é".repeat(300),
          note: "excluded note",
        },
      }),
    );
    const projected = projectRecentDecisions(
      workspace(),
      readyState({ decisions }),
    );
    if (projected.status !== "ready") {
      throw new Error("expected recent decision evidence");
    }
    expect(projected.decisions).toHaveLength(12);
    expect(projected.truncated).toBe(true);
    expect(projected.decisions[0]?.response).toEqual({
      kind: "question_answer",
      preview: "é".repeat(160),
      truncated: true,
    });
    expect(JSON.stringify(projected)).not.toContain("excluded note");
  });

  it("degrades only the recent-decision section for invalid state", () => {
    const projected = projectRecentDecisions(workspace(), {
      status: "error",
      revision: null,
      decisions: [],
      deliveries: [],
      resolutions: [],
      error: {
        code: "invalid_file",
        message: "private path leaked only inside store",
      },
    });
    expect(projected).toEqual({
      status: "unavailable",
      decisions: [],
      truncated: false,
      error: {
        code: "decision_state_unavailable",
        message:
          "Recent decision state is unavailable. Context files and terminals remain available.",
      },
    });
  });

  it("reads both configured sources against one accepted revision", async () => {
    const currentWorkspace = workspace();
    const inspectConfig = vi
      .fn()
      .mockResolvedValueOnce({
        status: "ready",
        revision: 7,
        workspace: currentWorkspace,
        error: null,
      })
      .mockResolvedValueOnce({
        status: "ready",
        revision: 7,
        workspace: currentWorkspace,
        error: null,
      });
    const inspectState = vi.fn().mockResolvedValue(readyState());
    const readSource = vi
      .fn()
      .mockImplementation(
        (
          kind: "objective" | "plan",
          source: PaciumWorkspace["context"]["objective"],
        ) =>
          Promise.resolve(
            source === null
              ? unconfiguredSource(kind)
              : readySource(kind, source.path),
          ),
      );
    const service = new PaciumContextService(
      { inspect: inspectConfig } as unknown as PaciumConfigStore,
      { inspect: inspectState } as unknown as QueueDecisionStore,
      { now: () => observedAt, readSource },
    );

    await expect(service.inspect()).resolves.toMatchObject({
      status: "ready",
      workspaceId: "primary",
      workspaceRevision: 7,
      objective: { status: "ready" },
      plan: { status: "unconfigured" },
      recentDecisions: { status: "ready" },
    });
    expect(readSource).toHaveBeenNthCalledWith(
      1,
      "objective",
      currentWorkspace.context.objective,
      expect.objectContaining({ now: expect.any(Function) }),
    );
    expect(readSource).toHaveBeenNthCalledWith(
      2,
      "plan",
      null,
      expect.objectContaining({ now: expect.any(Function) }),
    );
    expect(inspectConfig).toHaveBeenCalledTimes(2);
  });

  it("returns partial evidence when one source or decision state degrades", async () => {
    const currentWorkspace = workspace();
    const config = {
      inspect: vi.fn().mockResolvedValue({
        status: "ready",
        revision: 7,
        workspace: currentWorkspace,
        error: null,
      }),
    } as unknown as PaciumConfigStore;
    const state = {
      inspect: vi.fn().mockResolvedValue({
        status: "error",
        revision: null,
        decisions: [],
        deliveries: [],
        resolutions: [],
        error: { code: "invalid_file", message: "invalid" },
      }),
    } as unknown as QueueDecisionStore;
    const service = new PaciumContextService(config, state, {
      now: () => observedAt,
      readSource: (kind, source) =>
        Promise.resolve(
          kind === "objective"
            ? degradedSource(kind, source?.path ?? "/context/OBJECTIVE")
            : unconfiguredSource(kind),
        ),
    });

    await expect(service.inspect()).resolves.toMatchObject({
      status: "partial",
      objective: { status: "missing" },
      plan: { status: "unconfigured" },
      recentDecisions: { status: "unavailable" },
    });
  });

  it("fails closed when configuration changes during inspection", async () => {
    const currentWorkspace = workspace();
    const config = {
      inspect: vi
        .fn()
        .mockResolvedValueOnce({
          status: "ready",
          revision: 7,
          workspace: currentWorkspace,
          error: null,
        })
        .mockResolvedValueOnce({
          status: "ready",
          revision: 8,
          workspace: currentWorkspace,
          error: null,
        }),
    } as unknown as PaciumConfigStore;
    const state = {
      inspect: vi.fn().mockResolvedValue(readyState()),
    } as unknown as QueueDecisionStore;
    const service = new PaciumContextService(config, state, {
      now: () => observedAt,
      readSource: (kind) => Promise.resolve(unconfiguredSource(kind)),
    });

    await expect(service.inspect()).resolves.toEqual({
      status: "unavailable",
      workspaceId: null,
      workspaceRevision: null,
      objective: null,
      plan: null,
      recentDecisions: null,
      observedAt,
      error: {
        code: "config_drift",
        message:
          "Pacium configuration changed during context inspection. Refresh the accepted definition.",
      },
    });
  });
});

function workspace(): PaciumWorkspace {
  return {
    id: "primary",
    label: "Pacium",
    repositories: [],
    roles: { meta: null, orchestrator: null },
    workers: [],
    queueSources: [
      {
        id: "needs-owner",
        label: "Needs owner",
        path: "/queue/NEEDS-OWNER",
        format: "plain_text",
        requestingRole: "orchestrator",
        deliveryMethodId: null,
      },
    ],
    deliveryMethods: [],
    context: {
      objective: {
        path: "/context/OBJECTIVE",
        format: "plain_text",
      },
      plan: null,
    },
  };
}

function decision(
  overrides: Partial<QueueDecisionRecord> = {},
): QueueDecisionRecord {
  return {
    decisionId: "10000000-0000-4000-8000-000000000001",
    decisionHash: "a".repeat(64),
    kind: "question_answer",
    source: {
      workspaceId: "primary",
      workspaceRevision: 7,
      sourceId: "needs-owner",
      observationRevision: 3,
      boundary: "whole_source_v1",
      contentHash: "b".repeat(64),
      itemId: "c".repeat(64),
      itemType: "question",
    },
    actor: { kind: "local_operator", label: "Local operator" },
    decidedAt: "2026-07-27T12:00:00.000Z",
    payload: { answer: "Proceed", note: null },
    ...overrides,
  } as QueueDecisionRecord;
}

function delivery(
  item: QueueDecisionRecord,
  overrides: Partial<QueueDeliveryRecord> = {},
): QueueDeliveryRecord {
  return {
    deliveryId: "20000000-0000-4000-8000-000000000001",
    decisionId: item.decisionId,
    decisionHash: item.decisionHash,
    target: {
      type: "role_prompt",
      methodId: "orchestrator-prompt",
      methodLabel: "Orchestrator prompt",
      role: "orchestrator",
      sessionId: "90000000-0000-4000-8000-000000000001",
      sessionEpoch: 1,
    },
    payloadHash: "d".repeat(64),
    payloadByteLength: 50,
    requestedAt: "2026-07-27T12:01:00.000Z",
    outcome: null,
    deliveryHash: "e".repeat(64),
    ...overrides,
  };
}

function resolution(
  item: QueueDecisionRecord,
  overrides: Partial<QueueResolutionRecord> = {},
): QueueResolutionRecord {
  return {
    resolutionId: "30000000-0000-4000-8000-000000000001",
    decisionId: item.decisionId,
    decisionHash: item.decisionHash,
    action: "acknowledged",
    delivery: {
      deliveryId: "20000000-0000-4000-8000-000000000001",
      deliveryHash: "e".repeat(64),
    },
    relatedDecision: null,
    actor: { kind: "local_operator", label: "Local operator" },
    source: "human_labelled",
    recordedAt: "2026-07-27T12:02:00.000Z",
    note: null,
    resolutionHash: "f".repeat(64),
    ...overrides,
  };
}

function readyState(
  overrides: Partial<QueueDecisionStoreObservation> = {},
): QueueDecisionStoreObservation {
  return {
    status: "ready",
    revision: 1,
    decisions: [],
    deliveries: [],
    resolutions: [],
    error: null,
    ...overrides,
  } as QueueDecisionStoreObservation;
}

function unconfiguredSource(
  kind: "objective" | "plan",
): PaciumContextSourceObservation {
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

function readySource(
  kind: "objective" | "plan",
  path: string,
): PaciumContextSourceObservation {
  return {
    kind,
    status: "ready",
    path,
    format: "plain_text",
    observedAt,
    byteLength: 5,
    modifiedAt: observedAt,
    contentHash: "1".repeat(64),
    contentBase64: btoa("Build"),
    error: null,
  };
}

function degradedSource(
  kind: "objective" | "plan",
  path: string,
): PaciumContextSourceObservation {
  return {
    kind,
    status: "missing",
    path,
    format: "plain_text",
    observedAt,
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    contentBase64: null,
    error: {
      code: "missing",
      message: "The configured context file is missing.",
    },
  };
}
