import type {
  PaciumConfigObservation,
  PaciumWorkspace,
  QueueDecisionRecord,
  QueueDeliveryRecord,
  QueueResolutionRecord,
  SessionSummary,
} from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import { AnswerFileDeliveryError } from "./answer-file-delivery.js";
import {
  serializeRolePromptDelivery,
  type QueueDeliveryPayload,
} from "./queue-delivery-payload.js";
import {
  QueueDeliveryService,
  type QueueDeliveryStateStore,
} from "./queue-delivery-service.js";
import { QueueDecisionStoreWriteError } from "./queue-decision-store.js";

const decision: QueueDecisionRecord = {
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  kind: "question_answer",
  source: {
    workspaceId: "primary",
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
    note: "Confirmed by focused tests.",
  },
  actor: {
    kind: "local_operator",
    label: "Local operator",
  },
  decidedAt: "2026-07-27T14:00:00.000Z",
  decisionHash: "c".repeat(64),
};

describe("queue delivery service", () => {
  it("reports configured readiness and rejects stale decisions", async () => {
    const ready = serviceFixture();
    await expect(
      ready.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "ready",
      target: {
        type: "answer_file",
        methodId: "delivery",
        path: "/work/queue/PACIUM-ANSWERS",
      },
      delivery: null,
      error: null,
    });

    const stale = serviceFixture({
      currentSource: null,
    });
    await expect(
      stale.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "unavailable",
      error: { code: "DELIVERY_ITEM_STALE" },
    });
    expect(stale.inspectAnswerTarget).not.toHaveBeenCalled();
  });

  it("distinguishes unconfigured and occupied delivery targets", async () => {
    const unconfigured = serviceFixture({
      workspace: workspace({ delivery: "none" }),
    });
    await expect(
      unconfigured.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "not_configured",
      target: null,
      error: { code: "DELIVERY_NOT_CONFIGURED" },
    });

    const occupied = serviceFixture({
      answerTargetStatus: "occupied",
    });
    await expect(
      occupied.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "unavailable",
      target: { type: "answer_file" },
      error: { code: "DELIVERY_TARGET_OCCUPIED" },
    });
  });

  it("persists intent before publishing one answer file", async () => {
    const fixture = serviceFixture();
    fixture.publishAnswer.mockImplementation((_path, payload) => {
      expect(fixture.deliveries).toHaveLength(1);
      expect(fixture.deliveries[0]?.outcome).toBeNull();
      expect(JSON.parse(payload.bytes)).toEqual({
        format: "pacium_decision_v1",
        decision,
      });
      return Promise.resolve({
        kind: "answer_file_created",
        byteLength: payload.byteLength,
        contentHash: payload.contentHash,
      });
    });

    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "delivered",
      state: {
        status: "delivered",
        delivery: {
          decisionId: decision.decisionId,
          outcome: {
            status: "delivered",
            evidence: { kind: "answer_file_created" },
          },
        },
      },
    });
    expect(fixture.store.beginDelivery).toHaveBeenCalledTimes(1);
    expect(fixture.publishAnswer).toHaveBeenCalledTimes(1);
    expect(fixture.store.finishDelivery).toHaveBeenCalledTimes(1);
  });

  it("joins the immutable existing attempt without invoking transport again", async () => {
    const fixture = serviceFixture();
    const first = await fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );
    const second = await fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );

    expect(first.status).toBe("delivered");
    expect(second).toMatchObject({
      status: "existing",
      state: { status: "delivered" },
    });
    expect(fixture.publishAnswer).toHaveBeenCalledTimes(1);
    expect(fixture.store.beginDelivery).toHaveBeenCalledTimes(1);
  });

  it("records an unknown answer-file outcome without retrying automatically", async () => {
    const fixture = serviceFixture();
    fixture.publishAnswer.mockRejectedValueOnce(
      new AnswerFileDeliveryError("unknown"),
    );

    const first = await fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );
    const second = await fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );

    expect(first).toMatchObject({
      status: "unknown",
      state: {
        status: "unknown",
        error: { code: "DELIVERY_OUTCOME_UNKNOWN" },
      },
    });
    expect(second.status).toBe("existing");
    expect(fixture.publishAnswer).toHaveBeenCalledTimes(1);
  });

  it("permits one explicit retry after exact non-delivery confirmation", async () => {
    const fixture = serviceFixture();
    fixture.publishAnswer.mockRejectedValueOnce(
      new AnswerFileDeliveryError("unknown"),
    );

    const first = await fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );
    if (first.state.delivery === null) {
      throw new Error("Expected a durable first delivery attempt.");
    }
    fixture.resolutions.push(confirmedNotDelivered(first.state.delivery));

    await expect(
      fixture.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "ready_retry",
      delivery: {
        deliveryId: first.state.delivery.deliveryId,
        outcome: { status: "unknown" },
      },
    });
    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "delivered",
      state: { status: "delivered" },
    });
    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "existing",
      state: { status: "delivered" },
    });

    expect(fixture.deliveries).toHaveLength(2);
    expect(fixture.publishAnswer).toHaveBeenCalledTimes(2);
    expect(fixture.store.beginDelivery).toHaveBeenCalledTimes(2);
  });

  it("sends one fixed role-prompt line to the exact live session", async () => {
    const fixture = serviceFixture({
      workspace: workspace({ delivery: "role_prompt" }),
      sessions: [liveSession()],
    });

    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "delivered",
      state: {
        delivery: {
          target: {
            type: "role_prompt",
            role: "orchestrator",
            sessionId: liveSession().id,
            sessionEpoch: 3,
          },
          outcome: {
            evidence: {
              kind: "terminal_transport_accepted",
              sessionId: liveSession().id,
              sessionEpoch: 3,
            },
          },
        },
      },
    });
    expect(fixture.input).toHaveBeenCalledOnce();
    expect(fixture.input).toHaveBeenCalledWith(
      liveSession().id,
      serializeRolePromptDelivery(decision).bytes,
    );
    expect(fixture.publishAnswer).not.toHaveBeenCalled();
  });

  it("revalidates the live session epoch before sending input", async () => {
    const first = liveSession();
    const replacement = { ...first, epoch: 4 };
    const list = vi
      .fn<() => SessionSummary[]>()
      .mockReturnValueOnce([first])
      .mockReturnValue([replacement]);
    const fixture = serviceFixture({
      workspace: workspace({ delivery: "role_prompt" }),
      sessionList: list,
    });

    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "failed",
      state: {
        error: { code: "DELIVERY_TARGET_UNAVAILABLE" },
      },
    });
    expect(fixture.input).not.toHaveBeenCalled();
  });

  it("does not invoke transport when intent durability is unknown", async () => {
    const fixture = serviceFixture();
    fixture.store.beginDelivery.mockRejectedValueOnce(
      new QueueDecisionStoreWriteError(
        "durability_unknown",
        "Synthetic durability uncertainty.",
      ),
    );

    await expect(
      fixture.service.deliver(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({
      status: "rejected",
      state: {
        status: "unavailable",
        error: { code: "DELIVERY_DURABILITY_UNKNOWN" },
      },
    });
    expect(fixture.publishAnswer).not.toHaveBeenCalled();
    expect(fixture.store.finishDelivery).not.toHaveBeenCalled();
  });

  it("keeps delivery active through outcome persistence and recovers unknown", async () => {
    let releasePublish: (() => void) | undefined;
    const publishPending = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const fixture = serviceFixture();
    fixture.publishAnswer.mockImplementation(async (_path, payload) => {
      await publishPending;
      return {
        kind: "answer_file_created",
        byteLength: payload.byteLength,
        contentHash: payload.contentHash,
      };
    });
    fixture.store.finishDelivery.mockRejectedValueOnce(
      new Error("Synthetic outcome persistence failure."),
    );

    const delivery = fixture.service.deliver(
      decision.decisionId,
      decision.decisionHash,
    );
    await vi.waitFor(() => expect(fixture.publishAnswer).toHaveBeenCalled());
    await expect(
      fixture.service.inspect(decision.decisionId, decision.decisionHash),
    ).resolves.toMatchObject({ status: "delivering" });
    releasePublish?.();

    await expect(delivery).resolves.toMatchObject({
      status: "unknown",
      state: {
        status: "unknown",
        error: { code: "DELIVERY_OUTCOME_UNKNOWN" },
      },
    });
  });
});

interface FixtureOptions {
  answerTargetStatus?: "ready" | "occupied" | "unavailable";
  currentSource?: QueueDecisionRecord["source"] | null;
  sessionList?: () => SessionSummary[];
  sessions?: SessionSummary[];
  workspace?: PaciumWorkspace;
}

function serviceFixture(options: FixtureOptions = {}) {
  const deliveries: QueueDeliveryRecord[] = [];
  const resolutions: QueueResolutionRecord[] = [];
  const deliveryIds = [
    "7d0f22b4-1a28-42a4-88bf-f712b8e4abcb",
    "8d0f22b4-1a28-42a4-88bf-f712b8e4abcb",
  ];
  const inspect = vi.fn<QueueDeliveryStateStore["inspect"]>(() =>
    Promise.resolve({
      status: "ready",
      revision: 1 + deliveries.length,
      decisions: [decision],
      deliveries,
      resolutions,
      error: null,
    }),
  );
  const beginDelivery = vi.fn<QueueDeliveryStateStore["beginDelivery"]>(
    (delivery) => {
      const attempts = deliveries.filter(
        (candidate) => candidate.decisionId === delivery.decisionId,
      );
      const duplicate = attempts.find(
        (candidate) =>
          candidate.deliveryId === delivery.deliveryId ||
          candidate.deliveryHash === delivery.deliveryHash,
      );
      if (duplicate !== undefined) {
        return Promise.resolve({
          status: "existing",
          revision: 1,
          delivery: duplicate,
        });
      }
      const first = attempts[0];
      const retryUnlocked =
        first !== undefined &&
        resolutions.some(
          (resolution) =>
            resolution.action === "confirmed_not_delivered" &&
            resolution.delivery?.deliveryId === first.deliveryId &&
            resolution.delivery.deliveryHash === first.deliveryHash,
        );
      if (attempts.length >= 2 || (attempts.length === 1 && !retryUnlocked)) {
        return Promise.resolve({
          status: "existing",
          revision: 1,
          delivery: attempts.at(-1) ?? delivery,
        });
      }
      deliveries.push(delivery);
      return Promise.resolve({ status: "recorded", revision: 2, delivery });
    },
  );
  const finishDelivery = vi.fn<QueueDeliveryStateStore["finishDelivery"]>(
    (deliveryId, outcome) => {
      const index = deliveries.findIndex(
        (candidate) => candidate.deliveryId === deliveryId,
      );
      const current = deliveries[index];
      if (current === undefined) {
        throw new Error("Missing delivery fixture");
      }
      const finished = { ...current, outcome };
      deliveries[index] = finished;
      return Promise.resolve({
        status: "recorded",
        revision: 3,
        delivery: finished,
      });
    },
  );
  const store = { inspect, beginDelivery, finishDelivery };
  const inspectAnswerTarget = vi.fn(() =>
    Promise.resolve(options.answerTargetStatus ?? "ready"),
  );
  const publishAnswer = vi.fn((_path: string, payload: QueueDeliveryPayload) =>
    Promise.resolve({
      kind: "answer_file_created" as const,
      byteLength: payload.byteLength,
      contentHash: payload.contentHash,
    }),
  );
  const input = vi.fn<(sessionId: string, data: string) => void>();
  const sessions = options.sessions ?? [];
  const list = options.sessionList ?? (() => sessions);
  const configObservation: PaciumConfigObservation = {
    status: "ready",
    revision: 4,
    workspace: options.workspace ?? workspace(),
    error: null,
  };
  const service = new QueueDeliveryService(
    { inspect: () => Promise.resolve(configObservation) },
    {
      decisionSourceIdentity: () =>
        options.currentSource === undefined
          ? decision.source
          : options.currentSource,
    },
    store,
    { list, input },
    {
      inspectAnswerTarget,
      now: () => "2026-07-27T14:30:00.000Z",
      publishAnswer,
      randomId: () =>
        deliveryIds.shift() ?? "9d0f22b4-1a28-42a4-88bf-f712b8e4abcb",
    },
  );
  return {
    deliveries,
    input,
    inspectAnswerTarget,
    publishAnswer,
    resolutions,
    service,
    store,
  };
}

function confirmedNotDelivered(
  delivery: QueueDeliveryRecord,
): QueueResolutionRecord {
  return {
    resolutionId: "253a4e0e-d606-4438-9e7e-c27b0021994c",
    decisionId: delivery.decisionId,
    decisionHash: delivery.decisionHash,
    action: "confirmed_not_delivered",
    delivery: {
      deliveryId: delivery.deliveryId,
      deliveryHash: delivery.deliveryHash,
    },
    relatedDecision: null,
    actor: {
      kind: "local_operator",
      label: "Local operator",
    },
    source: "human_labelled",
    recordedAt: "2026-07-27T14:31:00.000Z",
    note: "The operator verified that the first attempt did not arrive.",
    resolutionHash: "9".repeat(64),
  };
}

function workspace(
  options: { delivery?: "answer_file" | "role_prompt" | "none" } = {},
): PaciumWorkspace {
  const delivery = options.delivery ?? "answer_file";
  return {
    id: "primary",
    label: "Pacium",
    repositories: [],
    roles: {
      meta: null,
      orchestrator: {
        type: "session",
        sessionId: liveSession().id,
      },
    },
    workers: [],
    queueSources: [
      {
        id: "needs-felix",
        label: "Needs Felix",
        path: "/work/queue/NEEDS-FELIX",
        format: "plain_text",
        requestingRole: "orchestrator",
        deliveryMethodId: delivery === "none" ? null : "delivery",
      },
    ],
    deliveryMethods:
      delivery === "none"
        ? []
        : delivery === "answer_file"
          ? [
              {
                id: "delivery",
                label: "Answers",
                type: "answer_file",
                path: "/work/queue/PACIUM-ANSWERS",
              },
            ]
          : [
              {
                id: "delivery",
                label: "Orchestrator prompt",
                type: "role_prompt",
                role: "orchestrator",
              },
            ],
    context: { objective: null, plan: null },
  };
}

function liveSession(): SessionSummary {
  const observedAt = "2026-07-27T14:00:00.000Z";
  return {
    id: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    epoch: 3,
    displayName: "Orchestrator",
    cwd: "/work/pacium",
    shell: "/usr/local/bin/codex",
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt,
    },
    providerObservation: null,
    repository: {
      status: "not_repository",
      root: null,
      name: null,
      branch: null,
      headCommit: null,
      headState: "unknown",
      worktreeKind: "unknown",
      observedAt,
      error: null,
    },
    runtime: "pty",
    processState: "live",
    pid: 42,
    cols: 80,
    rows: 24,
    createdAt: observedAt,
    exitedAt: null,
    exitCode: null,
    exitSignal: null,
  };
}
