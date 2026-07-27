import type {
  LaunchPresetCapability,
  PaciumWorkspace,
  SessionSummary,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  bindingFromDraft,
  buildPaciumRoleBindingOptions,
  createMinimalPaciumWorkspace,
  initialPaciumRoleBindingDraft,
  replacePaciumRoleBinding,
} from "./pacium-role-binding-model.js";

describe("Pacium role binding model", () => {
  it("offers only live sessions not occupied by another role or worker", () => {
    const sessions = [
      session("00000000-0000-4000-8000-000000000001", "Meta candidate"),
      session("00000000-0000-4000-8000-000000000002", "Orchestrator"),
      session("00000000-0000-4000-8000-000000000003", "Worker"),
      session("00000000-0000-4000-8000-000000000004", "Ended", "exited"),
    ];
    const workspaceValue = workspace();
    workspaceValue.roles.orchestrator = {
      type: "session",
      sessionId: sessions[1]!.id,
    };
    workspaceValue.workers = [
      {
        id: "worker",
        label: "Worker",
        binding: { type: "session", sessionId: sessions[2]!.id },
      },
    ];

    expect(
      buildPaciumRoleBindingOptions({
        role: "meta",
        workspace: workspaceValue,
        sessions,
        launchPresets: capabilities(),
      }).sessions,
    ).toEqual([
      {
        id: sessions[0]!.id,
        label: "Meta candidate",
        detail: "Codex · /work/pacium",
      },
    ]);
  });

  it("keeps the currently edited role session eligible", () => {
    const current = session("00000000-0000-4000-8000-000000000001", "Meta");
    const workspaceValue = workspace();
    workspaceValue.roles.meta = {
      type: "session",
      sessionId: current.id,
    };

    expect(
      buildPaciumRoleBindingOptions({
        role: "meta",
        workspace: workspaceValue,
        sessions: [current],
        launchPresets: capabilities(),
      }).sessions.map(({ id }) => id),
    ).toEqual([current.id]);
  });

  it("projects fixed presets and configured repositories without commands", () => {
    const options = buildPaciumRoleBindingOptions({
      role: "meta",
      workspace: workspace(),
      sessions: [],
      launchPresets: capabilities(),
    });

    expect(options.presets).toEqual(capabilities());
    expect(options.repositories).toEqual([
      {
        id: "pacium",
        label: "Pacium Control",
        root: "/work/pacium",
      },
    ]);
    expect(JSON.stringify(options)).not.toContain("executable");
  });

  it("chooses a valid current binding then safe eligible fallbacks", () => {
    const current = session("00000000-0000-4000-8000-000000000001", "Meta");
    const options = buildPaciumRoleBindingOptions({
      role: "meta",
      workspace: workspace(),
      sessions: [current],
      launchPresets: capabilities(),
    });

    expect(
      initialPaciumRoleBindingDraft(
        { type: "session", sessionId: current.id },
        options,
      ),
    ).toEqual({ type: "session", sessionId: current.id });
    expect(initialPaciumRoleBindingDraft(null, options)).toEqual({
      type: "session",
      sessionId: current.id,
    });

    const presetOnly = { ...options, sessions: [] };
    expect(initialPaciumRoleBindingDraft(null, presetOnly)).toEqual({
      type: "launch_preset",
      launchPreset: "shell",
      repositoryId: null,
    });
  });

  it("rejects stale, unavailable, and unknown draft references", () => {
    const options = buildPaciumRoleBindingOptions({
      role: "meta",
      workspace: workspace(),
      sessions: [],
      launchPresets: capabilities(),
    });

    expect(
      bindingFromDraft(
        {
          type: "session",
          sessionId: "00000000-0000-4000-8000-000000000099",
        },
        options,
      ),
    ).toBeNull();
    expect(
      bindingFromDraft(
        {
          type: "launch_preset",
          launchPreset: "claude",
          repositoryId: null,
        },
        options,
      ),
    ).toBeNull();
    expect(
      bindingFromDraft(
        {
          type: "launch_preset",
          launchPreset: "codex",
          repositoryId: "unknown",
        },
        options,
      ),
    ).toBeNull();
  });

  it("creates only a minimal strict first workspace", () => {
    expect(
      createMinimalPaciumWorkspace("orchestrator", {
        type: "launch_preset",
        launchPreset: "codex",
        repositoryId: null,
      }),
    ).toEqual({
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: {
        meta: null,
        orchestrator: {
          type: "launch_preset",
          launchPreset: "codex",
          repositoryId: null,
        },
      },
      workers: [],
      queueSources: [],
      deliveryMethods: [],
      context: { objective: null, plan: null },
    });
  });

  it("replaces exactly one role while preserving all other workspace fields", () => {
    const original = workspace();
    const replacement = replacePaciumRoleBinding(original, "meta", {
      type: "launch_preset",
      launchPreset: "codex",
      repositoryId: "pacium",
    });

    expect(replacement).not.toBe(original);
    expect(replacement.roles).not.toBe(original.roles);
    expect(replacement.roles.orchestrator).toBe(original.roles.orchestrator);
    expect(replacement.repositories).toBe(original.repositories);
    expect(replacement.workers).toBe(original.workers);
    expect(replacement.queueSources).toBe(original.queueSources);
    expect(replacement.deliveryMethods).toBe(original.deliveryMethods);
    expect(replacement.context).toBe(original.context);
  });
});

function capabilities(): LaunchPresetCapability[] {
  return [
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
      unavailableReason: "Not installed.",
    },
  ];
}

function workspace(): PaciumWorkspace {
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
    roles: { meta: null, orchestrator: null },
    workers: [],
    queueSources: [],
    deliveryMethods: [],
    context: { objective: null, plan: null },
  };
}

function session(
  id: string,
  displayName: string,
  processState: SessionSummary["processState"] = "live",
): SessionSummary {
  return {
    id,
    epoch: 1,
    displayName,
    cwd: "/work/pacium",
    shell: "/opt/bin/codex",
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
    processState,
    pid: processState === "live" ? 123 : null,
    cols: 100,
    rows: 30,
    createdAt: "2026-07-27T08:00:00.000Z",
    exitedAt: processState === "live" ? null : "2026-07-27T08:05:00.000Z",
    exitCode: processState === "exited" ? 0 : null,
    exitSignal: null,
  };
}
