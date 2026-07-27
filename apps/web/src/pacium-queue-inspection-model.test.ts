import { describe, expect, it } from "vitest";

import {
  CLOSED_QUEUE_INSPECTION,
  acceptQueueDecision,
  acceptQueueDelivery,
  acceptQueueItemInspection,
  beginQueueDecision,
  beginQueueDelivery,
  beginQueueItemInspection,
  closeQueueItemInspection,
  decodeQueueItemText,
  interruptQueueItemInspection,
  interruptQueueDecision,
  interruptQueueDelivery,
  queueItemSelection,
  reconcileQueueItemInspection,
  reconcileQueueItemInspectionConfig,
  sameQueueIdentity,
} from "./pacium-queue-inspection-model.js";

const observedAt = "2026-07-27T12:00:00.000Z";
const firstObservedAt = "2026-07-27T11:50:00.000Z";

describe("queue item inspection state", () => {
  it("selects only a complete current candidate", () => {
    expect(queueItemSelection(source(), observation(), 4)).toMatchObject({
      identity: {
        workspaceRevision: 4,
        sourceId: "needs-felix",
        observationRevision: 7,
        contentHash: "a".repeat(64),
        itemId: "b".repeat(64),
      },
      sourceLabel: "Needs Felix",
      requestingRole: "meta",
      type: "question",
      confidence: "high",
      firstObservedAt,
    });
    expect(
      queueItemSelection(
        source(),
        { ...observation(), status: "missing", contentHash: null },
        4,
      ),
    ).toBeNull();
    expect(queueItemSelection(source(), observation(), null)).toBeNull();
  });

  it("accepts only the correlated exact ready response and decodes UTF-8", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const loading = beginQueueItemInspection(selection, "request-1");
    const ready = detail();
    expect(acceptQueueItemInspection(loading, "unrelated", ready, open())).toBe(
      loading,
    );
    expect(
      acceptQueueItemInspection(
        loading,
        "request-1",
        {
          ...ready,
          itemId: "c".repeat(64),
        },
        open(),
      ),
    ).toBe(loading);
    expect(
      acceptQueueItemInspection(loading, "request-1", ready, open()),
    ).toMatchObject({
      requestId: null,
      status: "ready",
      originalText: "Question: Choose λ\n",
      errorMessage: null,
      decisionState: { status: "open" },
    });
  });

  it("fails closed on invalid decoded bytes or length", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const loading = beginQueueItemInspection(selection, "request-1");
    expect(
      acceptQueueItemInspection(
        loading,
        "request-1",
        {
          ...detail(),
          originalTextBase64: "/w==",
          byteLength: 1,
        },
        open(),
      ),
    ).toMatchObject({
      status: "error",
      originalText: null,
    });
    expect(decodeQueueItemText("UQ==", 2)).toBeNull();
  });

  it("clears text as soon as current queue identity drifts", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "request-1"),
      "request-1",
      detail(),
      open(),
    );
    expect(reconcileQueueItemInspection(ready, aggregate(observation()))).toBe(
      ready,
    );
    expect(
      reconcileQueueItemInspection(
        ready,
        aggregate({ ...observation(), observationRevision: 8 }),
      ),
    ).toMatchObject({
      status: "stale",
      requestId: null,
      originalText: null,
      inspection: null,
    });
    expect(
      reconcileQueueItemInspection(ready, {
        ...aggregate(observation()),
        status: "config_error",
        workspaceRevision: null,
        sources: [],
        error: {
          code: "CONFIG_UNAVAILABLE",
          message: "Queue config unavailable.",
        },
      }),
    ).toMatchObject({
      status: "unavailable",
      originalText: null,
    });
  });

  it("interrupts only the matching request and closes without retention", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const loading = beginQueueItemInspection(selection, "request-1");
    expect(interruptQueueItemInspection(loading, "unrelated", "failed")).toBe(
      loading,
    );
    expect(
      interruptQueueItemInspection(loading, "request-1", "Read failed"),
    ).toMatchObject({
      status: "error",
      originalText: null,
      errorMessage: "Read failed",
    });
    expect(closeQueueItemInspection()).toEqual(CLOSED_QUEUE_INSPECTION);
  });

  it("clears accepted text on config revision drift", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "request-1"),
      "request-1",
      detail(),
      open(),
    );
    expect(
      reconcileQueueItemInspectionConfig(ready, {
        status: "ready",
        revision: 4,
        workspace: {
          id: "primary",
          label: "Pacium",
          repositories: [],
          roles: { meta: null, orchestrator: null },
          workers: [],
          queueSources: [source()],
          deliveryMethods: [],
          context: { objective: null, plan: null },
        },
        error: null,
      }),
    ).toBe(ready);
    expect(
      reconcileQueueItemInspectionConfig(ready, {
        status: "ready",
        revision: 5,
        workspace: {
          id: "primary",
          label: "Pacium",
          repositories: [],
          roles: { meta: null, orchestrator: null },
          workers: [],
          queueSources: [source()],
          deliveryMethods: [],
          context: { objective: null, plan: null },
        },
        error: null,
      }),
    ).toMatchObject({
      status: "stale",
      originalText: null,
      inspection: null,
    });
  });

  it("compares every current identity component", () => {
    const identity = detail();
    expect(sameQueueIdentity(identity, { ...identity })).toBe(true);
    expect(
      sameQueueIdentity(identity, { ...identity, contentHash: "c".repeat(64) }),
    ).toBe(false);
  });

  it("accepts only a correlated exact immutable decision", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "inspect-1"),
      "inspect-1",
      detail(),
      open(),
    );
    const submitting = beginQueueDecision(ready, "decision-1");
    expect(submitting).toMatchObject({
      decisionRequestId: "decision-1",
      decisionStatus: "submitting",
    });
    expect(acceptQueueDecision(submitting, "unrelated", decisionResult())).toBe(
      submitting,
    );
    expect(
      acceptQueueDecision(submitting, "decision-1", {
        ...decisionResult(),
        itemId: "c".repeat(64),
      }),
    ).toBe(submitting);
    expect(
      acceptQueueDecision(submitting, "decision-1", decisionResult()),
    ).toMatchObject({
      status: "ready",
      originalText: "Question: Choose λ\n",
      decisionRequestId: null,
      decisionStatus: "idle",
      decisionState: {
        status: "decided",
        decision: {
          kind: "question_answer",
          payload: { answer: "Use the verified slice." },
        },
      },
    });
  });

  it("fails closed on stale decisions and does not retry interrupted writes", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "inspect-1"),
      "inspect-1",
      detail(),
      open(),
    );
    const submitting = beginQueueDecision(ready, "decision-1");
    expect(interruptQueueDecision(submitting, "unrelated", "failed")).toBe(
      submitting,
    );
    expect(
      interruptQueueDecision(
        submitting,
        "decision-1",
        "Decision outcome is unknown.",
      ),
    ).toMatchObject({
      status: "ready",
      originalText: "Question: Choose λ\n",
      decisionRequestId: null,
      decisionStatus: "error",
      decisionErrorMessage: "Decision outcome is unknown.",
    });

    expect(
      acceptQueueDecision(submitting, "decision-1", {
        status: "stale",
        ...detailIdentity(),
        decision: null,
        error: {
          code: "ITEM_STALE",
          message:
            "This queue item is no longer current. No decision was recorded or delivered.",
        },
      }),
    ).toMatchObject({
      status: "stale",
      originalText: null,
      decisionState: null,
      decisionStatus: "error",
    });
  });

  it("accepts only one correlated explicit delivery outcome", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "inspect-1"),
      "inspect-1",
      detail(),
      decided(),
      readyDelivery(),
    );
    const submitting = beginQueueDelivery(ready, "delivery-1");
    expect(submitting).toMatchObject({
      deliveryRequestId: "delivery-1",
      deliveryStatus: "submitting",
    });
    expect(
      acceptQueueDelivery(submitting, "unrelated", deliveredResult()),
    ).toBe(submitting);
    expect(
      acceptQueueDelivery(submitting, "delivery-1", {
        ...deliveredResult(),
        decisionHash: "f".repeat(64),
      }),
    ).toBe(submitting);
    expect(
      acceptQueueDelivery(submitting, "delivery-1", deliveredResult()),
    ).toMatchObject({
      deliveryRequestId: null,
      deliveryStatus: "idle",
      deliveryErrorMessage: null,
      deliveryState: {
        status: "delivered",
        delivery: {
          outcome: {
            status: "delivered",
            evidence: { kind: "answer_file_created" },
          },
        },
      },
    });
  });

  it("does not retry an interrupted delivery request", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const ready = acceptQueueItemInspection(
      beginQueueItemInspection(selection, "inspect-1"),
      "inspect-1",
      detail(),
      decided(),
      readyDelivery(),
    );
    const submitting = beginQueueDelivery(ready, "delivery-1");
    expect(interruptQueueDelivery(submitting, "unrelated", "failed")).toBe(
      submitting,
    );
    expect(
      interruptQueueDelivery(
        submitting,
        "delivery-1",
        "Delivery outcome requires inspection.",
      ),
    ).toMatchObject({
      deliveryRequestId: null,
      deliveryStatus: "error",
      deliveryErrorMessage: "Delivery outcome requires inspection.",
      deliveryState: { status: "ready" },
    });
  });
});

function source() {
  return {
    id: "needs-felix",
    label: "Needs Felix",
    path: "/queue/NEEDS-FELIX",
    format: "plain_text" as const,
    requestingRole: "meta" as const,
    deliveryMethodId: null,
  };
}

function observation() {
  return {
    sourceId: "needs-felix",
    observationRevision: 7,
    status: "stable" as const,
    observedAt,
    byteLength: 20,
    modifiedAt: observedAt,
    contentHash: "a".repeat(64),
    classification: {
      status: "candidate" as const,
      boundary: "whole_source_v1" as const,
      candidate: {
        itemId: "b".repeat(64),
        type: "question" as const,
        confidence: "high" as const,
      },
      diagnostics: [
        {
          code: "legacy_marker" as const,
          message: "A supported plain-text legacy marker was used.",
        },
      ],
    },
    candidateFirstObservedAt: firstObservedAt,
    conflicts: [],
    error: null,
  };
}

function detail() {
  return {
    status: "ready" as const,
    workspaceRevision: 4,
    sourceId: "needs-felix",
    observationRevision: 7,
    contentHash: "a".repeat(64),
    itemId: "b".repeat(64),
    sourceObservedAt: observedAt,
    firstObservedAt,
    byteLength: 20,
    encoding: "utf8_base64" as const,
    originalTextBase64: "UXVlc3Rpb246IENob29zZSDOuwo=",
    error: null,
  };
}

function detailIdentity() {
  const {
    workspaceRevision,
    sourceId,
    observationRevision,
    contentHash,
    itemId,
  } = detail();
  return {
    workspaceRevision,
    sourceId,
    observationRevision,
    contentHash,
    itemId,
  };
}

function open() {
  return {
    status: "open" as const,
    decision: null,
    error: null,
  };
}

function decisionResult() {
  return {
    status: "recorded" as const,
    ...detailIdentity(),
    decision: {
      decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
      kind: "question_answer" as const,
      source: {
        workspaceId: "primary",
        ...detailIdentity(),
        boundary: "whole_source_v1" as const,
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
    },
    error: null,
  };
}

function decided() {
  return {
    status: "decided" as const,
    decision: decisionResult().decision,
    error: null,
  };
}

function readyDelivery() {
  return {
    status: "ready" as const,
    decisionId: decisionResult().decision.decisionId,
    decisionHash: decisionResult().decision.decisionHash,
    target: answerTarget(),
    delivery: null,
    error: null,
  };
}

function deliveredResult() {
  const target = answerTarget();
  const payloadHash = "d".repeat(64);
  return {
    status: "delivered" as const,
    decisionId: decisionResult().decision.decisionId,
    decisionHash: decisionResult().decision.decisionHash,
    state: {
      status: "delivered" as const,
      decisionId: decisionResult().decision.decisionId,
      decisionHash: decisionResult().decision.decisionHash,
      target,
      delivery: {
        deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
        decisionId: decisionResult().decision.decisionId,
        decisionHash: decisionResult().decision.decisionHash,
        target,
        payloadHash,
        payloadByteLength: 512,
        requestedAt: "2026-07-27T12:06:00.000Z",
        outcome: {
          status: "delivered" as const,
          recordedAt: "2026-07-27T12:06:01.000Z",
          evidence: {
            kind: "answer_file_created" as const,
            byteLength: 512,
            contentHash: payloadHash,
          },
          error: null,
        },
        deliveryHash: "e".repeat(64),
      },
      error: null,
    },
  };
}

function answerTarget() {
  return {
    type: "answer_file" as const,
    methodId: "answers",
    methodLabel: "Pacium answers",
    path: "/queue/PACIUM-ANSWERS",
  };
}

function aggregate(sourceObservation: ReturnType<typeof observation>) {
  return {
    status: "ready" as const,
    workspaceRevision: 4,
    observedAt,
    sources: [sourceObservation],
    error: null,
  };
}
