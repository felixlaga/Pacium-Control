import type {
  LaunchPresetCapability,
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
  buildPaciumRoleModel,
  buildPaciumRoleModels,
} from "./pacium-role-model.js";

const capabilities: LaunchPresetCapability[] = [
  {
    id: "shell",
    label: "Shell",
    available: true,
    unavailableReason: null,
  },
  {
    id: "codex",
    label: "Codex",
    available: true,
    unavailableReason: null,
  },
  {
    id: "claude",
    label: "Claude Code",
    available: false,
    unavailableReason: "Claude is not installed.",
  },
];

describe("Pacium role projection", () => {
  it("orders stable Meta and Orchestrator loading states", () => {
    const [meta, orchestrator] = buildPaciumRoleModels({
      config: IDLE_PACIUM_CONFIG,
      connection: "connected",
      sessions: [],
      launchPresets: capabilities,
      defaultCwd: "/work",
    });

    expect([meta.label, orchestrator.label]).toEqual(["Meta", "Orchestrator"]);
    expect(meta).toMatchObject({
      role: "meta",
      status: "loading",
      canRetry: true,
      canConfigure: false,
    });
  });

  it("keeps disconnected loading and retained config errors honest", () => {
    expect(
      buildPaciumRoleModel("meta", {
        config: beginPaciumConfigRequest(
          IDLE_PACIUM_CONFIG,
          "request-1",
          "get",
        ),
        connection: "reconnecting",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/work",
      }),
    ).toMatchObject({
      status: "loading",
      statusLabel: "Disconnected",
      canRetry: false,
    });

    expect(
      buildPaciumRoleModel("orchestrator", {
        config: loaded({
          status: "error",
          revision: null,
          workspace: null,
          error: {
            code: "invalid_file",
            message: "<script>invalid role state</script>",
          },
        }),
        connection: "connected",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/work",
      }),
    ).toMatchObject({
      status: "error",
      detail: "<script>invalid role state</script>",
      canRetry: true,
      canConfigure: false,
    });
  });

  it("distinguishes unconfigured and null role bindings", () => {
    expect(
      buildPaciumRoleModel("meta", {
        config: loaded({
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        }),
        connection: "connected",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/work",
      }),
    ).toMatchObject({
      status: "unconfigured",
      statusLabel: "Setup needed",
      canConfigure: true,
    });

    expect(
      buildPaciumRoleModel("meta", {
        config: ready(workspace()),
        connection: "connected",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/work",
      }),
    ).toMatchObject({
      status: "unassigned",
      statusLabel: "Not assigned",
      canConfigure: true,
    });
  });

  it("resolves only the exact immutable session ID", () => {
    const session = sessionSummary({
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Meta",
      processState: "live",
    });
    const configured = workspace({
      meta: {
        type: "session",
        sessionId: "00000000-0000-4000-8000-000000000002",
      },
    });

    const missing = buildPaciumRoleModel("meta", {
      config: ready(configured),
      connection: "connected",
      sessions: [session],
      launchPresets: capabilities,
      defaultCwd: "/work",
    });
    expect(missing).toMatchObject({
      status: "missing",
      sessionId: "00000000-0000-4000-8000-000000000002",
      canOpen: false,
      canConfigure: true,
    });

    const connected = buildPaciumRoleModel("meta", {
      config: ready(
        workspace({
          meta: { type: "session", sessionId: session.id },
        }),
      ),
      connection: "connected",
      sessions: [session],
      launchPresets: capabilities,
      defaultCwd: "/work",
    });
    expect(connected).toMatchObject({
      status: "connected",
      statusLabel: "Connected",
      sessionId: session.id,
      canOpen: true,
    });
  });

  it.each([
    ["creating", "starting", "Starting"],
    ["closing", "ending", "Ending"],
    ["exited", "ended", "Ended"],
    ["failed", "failed", "Failed"],
  ] as const)(
    "projects %s process evidence as %s",
    (processState, status, statusLabel) => {
      const session = sessionSummary({ processState });
      expect(
        buildPaciumRoleModel("orchestrator", {
          config: ready(
            workspace({
              orchestrator: {
                type: "session",
                sessionId: session.id,
              },
            }),
          ),
          connection: "connected",
          sessions: [session],
          launchPresets: capabilities,
          defaultCwd: "/work",
        }),
      ).toMatchObject({
        status,
        statusLabel,
        canOpen: true,
      });
    },
  );

  it("projects fixed preset availability and configured repository cwd", () => {
    const configured = workspace({
      meta: {
        type: "launch_preset",
        launchPreset: "codex",
        repositoryId: "pacium",
      },
      orchestrator: {
        type: "launch_preset",
        launchPreset: "claude",
        repositoryId: null,
      },
    });

    expect(
      buildPaciumRoleModel("meta", {
        config: ready(configured),
        connection: "connected",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/default",
      }),
    ).toMatchObject({
      status: "ready",
      detail: "Codex",
      context: "Pacium Control · /work/pacium",
      launchPreset: "codex",
      launchCwd: "/work/pacium",
      canLaunch: true,
    });
    expect(
      buildPaciumRoleModel("orchestrator", {
        config: ready(configured),
        connection: "connected",
        sessions: [],
        launchPresets: capabilities,
        defaultCwd: "/default",
      }),
    ).toMatchObject({
      status: "unavailable",
      detail: "Claude Code",
      context: "Server default · /default",
      canLaunch: false,
      canConfigure: true,
    });
  });

  it("retains role evidence while disabling mutation after disconnect", () => {
    const session = sessionSummary({});
    const model = buildPaciumRoleModel("meta", {
      config: ready(
        workspace({
          meta: { type: "session", sessionId: session.id },
        }),
      ),
      connection: "reconnecting",
      sessions: [session],
      launchPresets: capabilities,
      defaultCwd: "/work",
    });

    expect(model).toMatchObject({
      status: "connected",
      statusLabel: "Disconnected · Connected",
      connectionLabel: "Server disconnected",
      canOpen: true,
      canConfigure: false,
    });
  });

  it("overrides only the matching role with launch correlation state", () => {
    const input = {
      config: ready(
        workspace({
          meta: {
            type: "launch_preset" as const,
            launchPreset: "codex" as const,
            repositoryId: "pacium",
          },
        }),
      ),
      connection: "connected" as const,
      sessions: [],
      launchPresets: capabilities,
      defaultCwd: "/work",
      pendingLaunch: {
        role: "meta" as const,
        requestId: "request-1",
        sourceRevision: 3,
        stage: "binding" as const,
      },
    };

    expect(buildPaciumRoleModel("meta", input)).toMatchObject({
      status: "binding",
      canLaunch: false,
      canConfigure: false,
    });
    expect(buildPaciumRoleModel("orchestrator", input).status).toBe(
      "unassigned",
    );
  });
});

function loaded(observation: PaciumConfigObservation): PaciumConfigViewState {
  return { status: "loaded", requestId: "request-0", observation };
}

function ready(workspaceValue: PaciumWorkspace): PaciumConfigViewState {
  return loaded({
    status: "ready",
    revision: 3,
    workspace: workspaceValue,
    error: null,
  });
}

function workspace(
  roles: Partial<PaciumWorkspace["roles"]> = {},
): PaciumWorkspace {
  return {
    id: "primary",
    label: "Pacium",
    repositories: [
      {
        id: "pacium",
        label: "Pacium Control",
        root: "/work/pacium",
        verificationPresetIds: [],
      },
    ],
    roles: {
      meta: roles.meta ?? null,
      orchestrator: roles.orchestrator ?? null,
    },
    workers: [],
    queueSources: [],
    deliveryMethods: [],
    context: { objective: null, plan: null },
  };
}

function sessionSummary(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    epoch: 1,
    displayName: "Role terminal",
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
      headCommit: "1234567890abcdef1234567890abcdef12345678",
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
