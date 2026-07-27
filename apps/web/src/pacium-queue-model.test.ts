import { describe, expect, it } from "vitest";

import {
  IDLE_PACIUM_QUEUE,
  acceptPaciumQueueResponse,
  acceptPaciumQueueUpdate,
  beginPaciumQueueRequest,
  buildPaciumQueueProjection,
  interruptPaciumQueueRequest,
  queueClassificationPresentation,
  queueWaitingLabel,
} from "./pacium-queue-model.js";
import type { PaciumConfigViewState } from "./pacium-config-model.js";

const observedAt = "2026-07-27T12:00:00.000Z";

describe("Pacium queue request state", () => {
  it("accepts only the correlated response and preserves evidence on interrupt", () => {
    const loading = beginPaciumQueueRequest(IDLE_PACIUM_QUEUE, "request-1");
    expect(
      acceptPaciumQueueResponse(loading, "unrelated", observation(2)),
    ).toBe(loading);
    const accepted = acceptPaciumQueueResponse(
      loading,
      "request-1",
      observation(2),
    );
    expect(accepted.requestId).toBeNull();
    expect(accepted.observation?.workspaceRevision).toBe(2);

    const refreshing = beginPaciumQueueRequest(accepted, "request-2");
    expect(interruptPaciumQueueRequest(refreshing, "unrelated")).toBe(
      refreshing,
    );
    expect(interruptPaciumQueueRequest(refreshing, "request-2")).toEqual({
      requestId: null,
      observation: accepted.observation,
    });
  });

  it("rejects pushed observations older than accepted queue evidence", () => {
    const state = {
      requestId: null,
      observation: observation(4),
    };
    expect(acceptPaciumQueueUpdate(state, observation(3))).toBe(state);
    expect(
      acceptPaciumQueueUpdate(state, observation(5)).observation
        ?.workspaceRevision,
    ).toBe(5);
  });
});

describe("Pacium queue source projection", () => {
  it("joins metadata only by exact config revision and source identity", () => {
    const projection = buildPaciumQueueProjection({
      config: config(4),
      queue: { requestId: null, observation: observation(4) },
      connection: "connected",
    });

    expect(projection.status).toBe("ready");
    expect(projection.sources).toHaveLength(2);
    expect(projection.workspaceRevision).toBe(4);
    expect(projection.itemCount).toBe(1);
    expect(projection.sources[0]).toMatchObject({
      source: { id: "needs-felix", label: "Needs Felix" },
      observation: { sourceId: "needs-felix", status: "stable" },
    });
    expect(projection.sources[1]).toMatchObject({
      source: { id: "review", label: "<Review>" },
      observation: null,
    });
  });

  it("never attaches stale-revision evidence to current config", () => {
    const projection = buildPaciumQueueProjection({
      config: config(5),
      queue: { requestId: null, observation: observation(4) },
      connection: "connected",
    });
    expect(
      projection.sources.every(({ observation }) => observation === null),
    ).toBe(true);
    expect(projection.message).toContain("this config revision");
    expect(projection.workspaceRevision).toBeNull();
    expect(projection.itemCount).toBe(0);
  });

  it("retains accepted evidence but labels disconnect and disables refresh", () => {
    const projection = buildPaciumQueueProjection({
      config: config(4),
      queue: { requestId: null, observation: observation(4) },
      connection: "reconnecting",
    });
    expect(projection.disconnected).toBe(true);
    expect(projection.canRefresh).toBe(false);
    expect(projection.message).toContain("disconnected");
  });

  it("projects loading, unconfigured, and config error honestly", () => {
    expect(
      buildPaciumQueueProjection({
        config: { status: "idle" },
        queue: IDLE_PACIUM_QUEUE,
        connection: "connected",
      }).status,
    ).toBe("loading");
    expect(
      buildPaciumQueueProjection({
        config: {
          status: "loaded",
          requestId: "config-request",
          observation: {
            status: "unconfigured",
            revision: null,
            workspace: null,
            error: null,
          },
        },
        queue: IDLE_PACIUM_QUEUE,
        connection: "connected",
      }).status,
    ).toBe("unconfigured");
  });
});

describe("Pacium queue waiting evidence", () => {
  it("labels process-local age without claiming durable queue time", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z");
    expect(queueWaitingLabel("2026-07-27T11:59:40.000Z", now)).toBe(
      "Seen <1m this run",
    );
    expect(queueWaitingLabel("2026-07-27T11:42:00.000Z", now)).toBe(
      "Seen 18m this run",
    );
    expect(queueWaitingLabel("2026-07-27T09:00:00.000Z", now)).toBe(
      "Seen 3h this run",
    );
    expect(queueWaitingLabel("invalid", now)).toBe(
      "First seen this server run",
    );
  });
});

describe("Pacium queue classification presentation", () => {
  it("presents current candidate type, confidence, and fixed diagnostics", () => {
    expect(
      queueClassificationPresentation(observation(4).sources[0] ?? null),
    ).toEqual({
      kind: "question",
      label: "Question · High confidence",
      diagnostic: "A supported plain-text legacy marker was used.",
    });
  });

  it("distinguishes empty, blank, and degraded sources from candidates", () => {
    const source = observation(4).sources[0]!;
    expect(
      queueClassificationPresentation({
        ...source,
        status: "empty",
        byteLength: 0,
        classification: null,
        candidateFirstObservedAt: null,
      }),
    ).toEqual({
      kind: "none",
      label: "No item · Empty source",
      diagnostic: null,
    });
    expect(
      queueClassificationPresentation({
        ...source,
        classification: {
          status: "none",
          boundary: "whole_source_v1",
          candidate: null,
          diagnostics: [
            {
              code: "blank_content",
              message: "The stable source contains only whitespace.",
            },
          ],
        },
        candidateFirstObservedAt: null,
      }),
    ).toEqual({
      kind: "none",
      label: "No item · Blank source",
      diagnostic: "The stable source contains only whitespace.",
    });
    expect(
      queueClassificationPresentation({
        ...source,
        status: "missing",
        byteLength: null,
        modifiedAt: null,
        contentHash: null,
        classification: null,
        candidateFirstObservedAt: null,
      }),
    ).toBeNull();
  });
});

function config(revision: number): PaciumConfigViewState {
  return {
    status: "loaded",
    requestId: "config-request",
    observation: {
      status: "ready",
      revision,
      workspace: {
        id: "primary",
        label: "Pacium",
        repositories: [],
        roles: { meta: null, orchestrator: null },
        workers: [],
        queueSources: [
          {
            id: "needs-felix",
            label: "Needs Felix",
            path: "/queue/NEEDS-FELIX",
            format: "plain_text",
            requestingRole: "meta",
            deliveryMethodId: null,
          },
          {
            id: "review",
            label: "<Review>",
            path: "/queue/REVIEW",
            format: "plain_text",
            requestingRole: "orchestrator",
            deliveryMethodId: null,
          },
        ],
        deliveryMethods: [],
        context: { objective: null, plan: null },
      },
      error: null,
    },
  };
}

function observation(workspaceRevision: number) {
  return {
    status: "ready" as const,
    workspaceRevision,
    observedAt,
    sources: [
      {
        sourceId: "needs-felix",
        observationRevision: 2,
        status: "stable" as const,
        observedAt,
        byteLength: 42,
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
        candidateFirstObservedAt: observedAt,
        conflicts: [],
        error: null,
      },
    ],
    error: null,
  };
}
