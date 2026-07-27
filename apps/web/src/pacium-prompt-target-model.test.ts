import type {
  PaciumConfigObservation,
  PaciumWorkspace,
  SessionSummary,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_PACIUM_CONFIG,
  beginPaciumConfigRequest,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import {
  availablePaciumPromptTarget,
  buildPaciumPromptTargets,
} from "./pacium-prompt-target-model.js";

describe("Pacium prompt target projection", () => {
  it("keeps loading, disconnected, unconfigured, and hostile error evidence explicit", () => {
    expect(
      buildPaciumPromptTargets({
        config: IDLE_PACIUM_CONFIG,
        connection: "connected",
        sessions: [],
      }),
    ).toMatchObject({ status: "loading", targets: [] });
    expect(
      buildPaciumPromptTargets({
        config: beginPaciumConfigRequest(
          IDLE_PACIUM_CONFIG,
          "request-1",
          "get",
        ),
        connection: "reconnecting",
        sessions: [],
      }).message,
    ).toContain("reconnect");
    expect(
      buildPaciumPromptTargets({
        config: loaded({
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        }),
        connection: "connected",
        sessions: [],
      }),
    ).toMatchObject({ status: "unconfigured", targets: [] });
    expect(
      buildPaciumPromptTargets({
        config: loaded({
          status: "error",
          revision: null,
          workspace: null,
          error: {
            code: "invalid_file",
            message: "<script>bad targets</script>",
          },
        }),
        connection: "connected",
        sessions: [],
      }).message,
    ).toBe("<script>bad targets</script>");
  });

  it("orders Meta, Orchestrator, then configured workers without sorting labels", () => {
    const projection = buildPaciumPromptTargets({
      config: ready(
        workspace({
          workers: [
            {
              id: "worker-z",
              label: "Zulu worker",
              binding: {
                type: "launch_preset",
                launchPreset: "codex",
                repositoryId: null,
              },
            },
            {
              id: "worker-a",
              label: "Alpha worker",
              binding: {
                type: "launch_preset",
                launchPreset: "shell",
                repositoryId: null,
              },
            },
          ],
        }),
      ),
      connection: "connected",
      sessions: [],
    });

    expect(projection.targets.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "role:meta", label: "Meta" },
      { id: "role:orchestrator", label: "Orchestrator" },
      { id: "worker:worker-z", label: "Zulu worker" },
      { id: "worker:worker-a", label: "Alpha worker" },
    ]);
  });

  it("never infers a target from a matching name, preset, or cwd", () => {
    const decoy = session({
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Meta",
    });
    const projection = buildPaciumPromptTargets({
      config: ready(
        workspace({
          meta: {
            type: "session",
            sessionId: "00000000-0000-4000-8000-000000000002",
          },
        }),
      ),
      connection: "connected",
      sessions: [decoy],
    });

    expect(projection.targets[0]).toMatchObject({
      id: "role:meta",
      status: "missing",
      sessionId: "00000000-0000-4000-8000-000000000002",
      available: false,
    });
  });

  it("enables only exact live session targets on a connected stable config", () => {
    const meta = session({
      id: "00000000-0000-4000-8000-000000000001",
    });
    const worker = session({
      id: "00000000-0000-4000-8000-000000000003",
      displayName: "Worker",
    });
    const projection = buildPaciumPromptTargets({
      config: ready(
        workspace({
          meta: { type: "session", sessionId: meta.id },
          orchestrator: {
            type: "launch_preset",
            launchPreset: "codex",
            repositoryId: null,
          },
          workers: [
            {
              id: "worker-one",
              label: "Worker one",
              binding: { type: "session", sessionId: worker.id },
            },
          ],
        }),
      ),
      connection: "connected",
      sessions: [meta, worker],
    });

    expect(projection.targets).toMatchObject([
      { status: "connected", sessionId: meta.id, available: true },
      { status: "preset", sessionId: null, available: false },
      { status: "connected", sessionId: worker.id, available: true },
    ]);
    expect(
      availablePaciumPromptTarget(projection, "worker:worker-one"),
    ).toMatchObject({ sessionId: worker.id });
  });

  it.each([
    ["creating", "starting"],
    ["closing", "ending"],
    ["exited", "ended"],
    ["failed", "failed"],
  ] as const)("disables %s process evidence as %s", (processState, status) => {
    const targetSession = session({ processState });
    const projection = buildPaciumPromptTargets({
      config: ready(
        workspace({
          meta: { type: "session", sessionId: targetSession.id },
        }),
      ),
      connection: "connected",
      sessions: [targetSession],
    });

    expect(projection.targets[0]).toMatchObject({
      status,
      available: false,
    });
  });

  it("retains exact targets but disables them during disconnect and replacement", () => {
    const targetSession = session({});
    const readyState = ready(
      workspace({
        meta: { type: "session", sessionId: targetSession.id },
      }),
    );
    const disconnected = buildPaciumPromptTargets({
      config: readyState,
      connection: "reconnecting",
      sessions: [targetSession],
    });
    expect(disconnected.targets[0]).toMatchObject({
      statusLabel: "Disconnected · Connected",
      available: false,
    });

    const replacing: PaciumConfigViewState = {
      status: "replacing",
      requestId: "request-2",
      previous: readyState.status === "loaded" ? readyState.observation : null,
    };
    expect(
      buildPaciumPromptTargets({
        config: replacing,
        connection: "connected",
        sessions: [targetSession],
      }).targets[0]?.available,
    ).toBe(false);
  });

  it("returns null for absent, disabled, or stale target selection", () => {
    const projection = buildPaciumPromptTargets({
      config: ready(workspace()),
      connection: "connected",
      sessions: [],
    });
    expect(availablePaciumPromptTarget(projection, null)).toBeNull();
    expect(availablePaciumPromptTarget(projection, "role:meta")).toBeNull();
    expect(
      availablePaciumPromptTarget(projection, "worker:removed"),
    ).toBeNull();
  });
});

function loaded(observation: PaciumConfigObservation): PaciumConfigViewState {
  return { status: "loaded", requestId: "request-0", observation };
}

function ready(workspaceValue: PaciumWorkspace): PaciumConfigViewState {
  return loaded({
    status: "ready",
    revision: 4,
    workspace: workspaceValue,
    error: null,
  });
}

function workspace(
  overrides: {
    meta?: PaciumWorkspace["roles"]["meta"];
    orchestrator?: PaciumWorkspace["roles"]["orchestrator"];
    workers?: PaciumWorkspace["workers"];
  } = {},
): PaciumWorkspace {
  return {
    id: "primary",
    label: "Pacium",
    repositories: [],
    roles: {
      meta: overrides.meta ?? null,
      orchestrator: overrides.orchestrator ?? null,
    },
    workers: overrides.workers ?? [],
    queueSources: [],
    deliveryMethods: [],
    context: { objective: null, plan: null },
  };
}

function session(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    epoch: 1,
    displayName: "Target",
    cwd: "/work/pacium",
    shell: "/bin/zsh",
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt: "2026-07-27T08:00:00.000Z",
    },
    repository: {
      status: "ready",
      root: "/work/pacium",
      name: "pacium",
      branch: "dev",
      headCommit: "a".repeat(40),
      headState: "branch",
      worktreeKind: "main",
      observedAt: "2026-07-27T08:00:00.000Z",
      error: null,
    },
    runtime: "pty",
    processState: "live",
    pid: 123,
    cols: 100,
    rows: 30,
    createdAt: "2026-07-27T08:00:00.000Z",
    exitedAt: null,
    exitCode: null,
    exitSignal: null,
    ...overrides,
  };
}
