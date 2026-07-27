import { describe, expect, it } from "vitest";

import {
  CLOSED_QUEUE_INSPECTION,
  acceptQueueItemInspection,
  beginQueueItemInspection,
  closeQueueItemInspection,
  decodeQueueItemText,
  interruptQueueItemInspection,
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
    expect(acceptQueueItemInspection(loading, "unrelated", ready)).toBe(
      loading,
    );
    expect(
      acceptQueueItemInspection(loading, "request-1", {
        ...ready,
        itemId: "c".repeat(64),
      }),
    ).toBe(loading);
    expect(
      acceptQueueItemInspection(loading, "request-1", ready),
    ).toMatchObject({
      requestId: null,
      status: "ready",
      originalText: "Question: Choose λ\n",
      errorMessage: null,
    });
  });

  it("fails closed on invalid decoded bytes or length", () => {
    const selection = queueItemSelection(source(), observation(), 4)!;
    const loading = beginQueueItemInspection(selection, "request-1");
    expect(
      acceptQueueItemInspection(loading, "request-1", {
        ...detail(),
        originalTextBase64: "/w==",
        byteLength: 1,
      }),
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

function aggregate(sourceObservation: ReturnType<typeof observation>) {
  return {
    status: "ready" as const,
    workspaceRevision: 4,
    observedAt,
    sources: [sourceObservation],
    error: null,
  };
}
