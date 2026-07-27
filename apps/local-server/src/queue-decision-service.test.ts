import {
  queueDecisionError,
  type QueueDecisionRecord,
  type QueueDecisionRequestIdentity,
  type QueueDecisionSourceIdentity,
} from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  QueueDecisionService,
  type QueueDecisionSourceReader,
  type QueueDecisionStateStore,
} from "./queue-decision-service.js";
import { QueueDecisionStoreWriteError } from "./queue-decision-store.js";

const identity: QueueDecisionRequestIdentity = {
  workspaceRevision: 4,
  sourceId: "needs-felix",
  observationRevision: 7,
  contentHash: "a".repeat(64),
  itemId: "b".repeat(64),
};

const questionSource: QueueDecisionSourceIdentity = {
  workspaceId: "primary",
  ...identity,
  boundary: "whole_source_v1",
  itemType: "question",
};

describe("queue decision service", () => {
  it("records a server-attributed hashed question answer", async () => {
    const fixture = serviceFixture(questionSource);

    const result = await fixture.service.recordQuestionAnswer(identity, {
      answer: "Use the smaller verified slice.",
      note: "Confirmed by focused tests.",
    });

    expect(result).toMatchObject({
      status: "recorded",
      ...identity,
      decision: {
        decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
        kind: "question_answer",
        source: questionSource,
        payload: {
          answer: "Use the smaller verified slice.",
          note: "Confirmed by focused tests.",
        },
        actor: {
          kind: "local_operator",
          label: "Local operator",
        },
        decidedAt: "2026-07-27T14:00:00.000Z",
      },
      error: null,
    });
    expect(result.decision?.decisionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fixture.store.append).toHaveBeenCalledTimes(1);
  });

  it("records only explicit approval outcomes for approval sources", async () => {
    const approvalSource: QueueDecisionSourceIdentity = {
      ...questionSource,
      itemType: "approval",
    };
    const fixture = serviceFixture(approvalSource);

    const result = await fixture.service.recordApprovalDecision(identity, {
      outcome: "denied",
      note: null,
    });

    expect(result).toMatchObject({
      status: "recorded",
      decision: {
        kind: "approval_decision",
        source: approvalSource,
        payload: { outcome: "denied", note: null },
      },
    });
  });

  it("rejects question and approval type confusion before persistence", async () => {
    const question = serviceFixture(questionSource);
    await expect(
      question.service.recordApprovalDecision(identity, {
        outcome: "approved",
        note: null,
      }),
    ).resolves.toEqual({
      status: "rejected",
      ...identity,
      decision: null,
      error: queueDecisionError("ITEM_TYPE_MISMATCH"),
    });
    expect(question.store.append).not.toHaveBeenCalled();

    const approval = serviceFixture({
      ...questionSource,
      itemType: "approval",
    });
    await expect(
      approval.service.recordQuestionAnswer(identity, {
        answer: "Yes.",
        note: null,
      }),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "ITEM_TYPE_MISMATCH" },
    });
    expect(approval.store.append).not.toHaveBeenCalled();
  });

  it("revalidates the exact current identity immediately before append", async () => {
    const sourceReader: QueueDecisionSourceReader = {
      decisionSourceIdentity: vi
        .fn()
        .mockReturnValueOnce(questionSource)
        .mockReturnValueOnce(null),
    };
    const fixture = serviceFixture(questionSource, sourceReader);

    await expect(
      fixture.service.recordQuestionAnswer(identity, {
        answer: "Proceed.",
        note: null,
      }),
    ).resolves.toEqual({
      status: "stale",
      ...identity,
      decision: null,
      error: queueDecisionError("ITEM_STALE"),
    });
    expect(fixture.store.append).not.toHaveBeenCalled();
  });

  it("joins an existing exact decision and reports unavailable state honestly", async () => {
    const fixture = serviceFixture(questionSource);
    const recorded = await fixture.service.recordQuestionAnswer(identity, {
      answer: "Proceed.",
      note: null,
    });
    if (recorded.decision === null) {
      throw new Error("Expected recorded decision");
    }
    fixture.decisions.push(recorded.decision);

    await expect(fixture.service.inspect(identity)).resolves.toEqual({
      status: "decided",
      decision: recorded.decision,
      error: null,
    });

    fixture.store.inspect.mockResolvedValueOnce({
      status: "error",
      revision: null,
      decisions: [],
      deliveries: [],
      error: {
        code: "invalid_file",
        message: "Synthetic invalid state.",
      },
    });
    await expect(fixture.service.inspect(identity)).resolves.toEqual({
      status: "unavailable",
      decision: null,
      error: queueDecisionError("DECISION_STATE_UNAVAILABLE"),
    });
  });

  it("maps immutable replay and durability errors without retrying", async () => {
    const fixture = serviceFixture(questionSource);
    fixture.store.append.mockRejectedValueOnce(
      new QueueDecisionStoreWriteError(
        "already_decided",
        "Synthetic competing decision.",
      ),
    );
    await expect(
      fixture.service.recordQuestionAnswer(identity, {
        answer: "Competing answer.",
        note: null,
      }),
    ).resolves.toMatchObject({
      status: "rejected",
      error: { code: "ITEM_ALREADY_DECIDED" },
    });

    fixture.store.append.mockRejectedValueOnce(
      new QueueDecisionStoreWriteError(
        "durability_unknown",
        "Synthetic unknown durability.",
      ),
    );
    await expect(
      fixture.service.recordQuestionAnswer(identity, {
        answer: "Unknown outcome.",
        note: null,
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      error: { code: "DECISION_DURABILITY_UNKNOWN" },
    });
    expect(fixture.store.append).toHaveBeenCalledTimes(2);
  });
});

function serviceFixture(
  source: QueueDecisionSourceIdentity,
  sourceReader: QueueDecisionSourceReader = {
    decisionSourceIdentity: () => source,
  },
): {
  service: QueueDecisionService;
  store: {
    inspect: ReturnType<typeof vi.fn<QueueDecisionStateStore["inspect"]>>;
    append: ReturnType<typeof vi.fn<QueueDecisionStateStore["append"]>>;
  };
  decisions: QueueDecisionRecord[];
} {
  const decisions: QueueDecisionRecord[] = [];
  const store = {
    inspect: vi.fn<QueueDecisionStateStore["inspect"]>(() =>
      Promise.resolve(
        decisions.length === 0
          ? {
              status: "empty",
              revision: 0,
              decisions: [],
              deliveries: [],
              error: null,
            }
          : {
              status: "ready",
              revision: decisions.length,
              decisions,
              deliveries: [],
              error: null,
            },
      ),
    ),
    append: vi.fn<QueueDecisionStateStore["append"]>((decision) =>
      Promise.resolve({
        status: "recorded",
        revision: decisions.length + 1,
        decision,
      }),
    ),
  };
  return {
    service: new QueueDecisionService(sourceReader, store, {
      now: () => "2026-07-27T14:00:00.000Z",
      randomId: () => "28c9142a-8986-43c7-9451-445fd8c13c3e",
    }),
    store,
    decisions,
  };
}
