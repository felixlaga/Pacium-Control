import { describe, expect, it } from "vitest";

import {
  IDLE_PACIUM_QUEUE,
  acceptPaciumQueueResponse,
  acceptPaciumQueueUpdate,
  beginPaciumQueueRequest,
  buildPaciumQueueProjection,
  interruptPaciumQueueRequest,
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
        error: null,
      },
    ],
    error: null,
  };
}
