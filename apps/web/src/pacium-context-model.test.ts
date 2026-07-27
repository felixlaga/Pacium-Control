import type {
  PaciumConfigObservation,
  PaciumContextObservation,
  PaciumContextSourceObservation,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import type { PaciumConfigViewState } from "./pacium-config-model.js";
import {
  acceptPaciumContextResponse,
  beginPaciumContextInspection,
  clearPaciumContext,
  initialPaciumContextState,
  reconcilePaciumContextConfig,
  rejectPaciumContextResponse,
} from "./pacium-context-model.js";

describe("Pacium control context request state", () => {
  it("starts only against one accepted workspace identity", () => {
    expect(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
    ).toMatchObject({
      status: "loading",
      pendingRequestId: "request-1",
      selection: {
        workspaceId: "primary",
        workspaceRevision: 7,
      },
    });
    expect(
      beginPaciumContextInspection(initialPaciumContextState(), "request-1", {
        status: "loaded",
        requestId: "config-1",
        observation: {
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        },
      }),
    ).toMatchObject({
      status: "error",
      selection: null,
      pendingRequestId: null,
    });
  });

  it("accepts only the matching request and exact current revision", () => {
    const loading = beginPaciumContextInspection(
      initialPaciumContextState(),
      "request-1",
      readyConfig(),
    );
    expect(
      acceptPaciumContextResponse(
        loading,
        "stale",
        readyObservation(),
        readyConfig(),
      ),
    ).toBe(loading);
    expect(
      acceptPaciumContextResponse(
        loading,
        "request-1",
        {
          ...readyObservation(),
          workspaceRevision: 8,
        },
        readyConfig(),
      ),
    ).toBe(loading);
    expect(
      acceptPaciumContextResponse(
        loading,
        "request-1",
        readyObservation(),
        readyConfig(8),
      ),
    ).toBe(loading);
  });

  it("decodes bounded UTF-8 text and preserves independent empty evidence", () => {
    const loading = beginPaciumContextInspection(
      initialPaciumContextState(),
      "request-1",
      readyConfig(),
    );
    const accepted = acceptPaciumContextResponse(
      loading,
      "request-1",
      readyObservation(),
      readyConfig(),
    );
    expect(accepted).toMatchObject({
      status: "ready",
      pendingRequestId: null,
      objectiveText: "Build λ",
      planText: null,
      error: null,
    });
  });

  it("retains accepted evidence while an explicit refresh loads", () => {
    const accepted = acceptPaciumContextResponse(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
      "request-1",
      readyObservation(),
      readyConfig(),
    );
    const refreshing = beginPaciumContextInspection(
      accepted,
      "request-2",
      readyConfig(),
    );
    expect(refreshing).toMatchObject({
      status: "loading",
      pendingRequestId: "request-2",
      observation: accepted.observation,
      objectiveText: "Build λ",
    });
  });

  it("accepts bounded unavailable evidence and clears text", () => {
    const accepted = acceptPaciumContextResponse(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
      "request-1",
      {
        status: "unavailable",
        workspaceId: null,
        workspaceRevision: null,
        objective: null,
        plan: null,
        recentDecisions: null,
        observedAt: "2026-07-27T12:00:00.000Z",
        error: {
          code: "config_drift",
          message: "Configuration changed.",
        },
      },
      readyConfig(),
    );
    expect(accepted).toMatchObject({
      status: "error",
      pendingRequestId: null,
      objectiveText: null,
      planText: null,
      error: "Configuration changed.",
    });
  });

  it("rejects only the matching failed request and clears prior text", () => {
    const accepted = acceptPaciumContextResponse(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
      "request-1",
      readyObservation(),
      readyConfig(),
    );
    const refreshing = beginPaciumContextInspection(
      accepted,
      "request-2",
      readyConfig(),
    );
    expect(
      rejectPaciumContextResponse(refreshing, "stale", "stale failure"),
    ).toBe(refreshing);
    expect(
      rejectPaciumContextResponse(
        refreshing,
        "request-2",
        "Context request failed.",
      ),
    ).toMatchObject({
      status: "error",
      pendingRequestId: null,
      observation: null,
      objectiveText: null,
      planText: null,
      error: "Context request failed.",
    });
  });

  it("fails closed on malformed base64 or byte length", () => {
    const malformed = {
      ...readyObservation(),
      objective: {
        ...readySource("objective", "Build λ"),
        byteLength: 999,
      },
    } as PaciumContextObservation;
    const accepted = acceptPaciumContextResponse(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
      "request-1",
      malformed,
      readyConfig(),
    );
    expect(accepted).toMatchObject({
      status: "error",
      observation: null,
      objectiveText: null,
      error:
        "Pacium rejected malformed context text. Terminals and source files remain unchanged.",
    });
  });

  it("clears decoded text on config drift, disconnect, mode exit, or Back", () => {
    const accepted = acceptPaciumContextResponse(
      beginPaciumContextInspection(
        initialPaciumContextState(),
        "request-1",
        readyConfig(),
      ),
      "request-1",
      readyObservation(),
      readyConfig(),
    );
    expect(reconcilePaciumContextConfig(accepted, readyConfig())).toBe(
      accepted,
    );
    expect(reconcilePaciumContextConfig(accepted, readyConfig(8))).toEqual(
      initialPaciumContextState(),
    );
    expect(clearPaciumContext()).toEqual(initialPaciumContextState());
  });
});

function readyConfig(revision = 7): PaciumConfigViewState {
  const observation: PaciumConfigObservation = {
    status: "ready",
    revision,
    workspace: {
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: { meta: null, orchestrator: null },
      workers: [],
      queueSources: [],
      deliveryMethods: [],
      context: {
        objective: {
          format: "plain_text",
          path: "/context/OBJECTIVE",
        },
        plan: null,
      },
    },
    error: null,
  };
  return {
    status: "loaded",
    requestId: "config-1",
    observation,
  };
}

function readyObservation(): Extract<
  PaciumContextObservation,
  { status: "ready" | "partial" }
> {
  return {
    status: "ready",
    workspaceId: "primary",
    workspaceRevision: 7,
    objective: readySource("objective", "Build λ"),
    plan: {
      kind: "plan",
      status: "empty",
      path: "/context/PLAN",
      format: "plain_text",
      observedAt: "2026-07-27T12:00:00.000Z",
      byteLength: 0,
      modifiedAt: "2026-07-27T11:59:00.000Z",
      contentHash: "b".repeat(64),
      contentBase64: null,
      error: null,
    },
    recentDecisions: {
      status: "ready",
      decisions: [],
      truncated: false,
      error: null,
    },
    observedAt: "2026-07-27T12:00:00.000Z",
    error: null,
  };
}

function readySource(
  kind: "objective" | "plan",
  text: string,
): PaciumContextSourceObservation {
  const bytes = new TextEncoder().encode(text);
  return {
    kind,
    status: "ready",
    path: `/context/${kind.toUpperCase()}`,
    format: "plain_text",
    observedAt: "2026-07-27T12:00:00.000Z",
    byteLength: bytes.byteLength,
    modifiedAt: "2026-07-27T11:59:00.000Z",
    contentHash: "a".repeat(64),
    contentBase64: bytesToBase64(bytes),
    error: null,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
