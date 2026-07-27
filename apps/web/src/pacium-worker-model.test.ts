import type {
  LaunchPresetCapability,
  PaciumWorker,
  SessionSummary,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import type { AttentionResult } from "./attention-model.js";
import type { PaciumConfigViewState } from "./pacium-config-model.js";
import type { RepositoryChangesViewState } from "./repository-changes-model.js";
import { buildPaciumWorkersProjection } from "./pacium-worker-model.js";

describe("Pacium configured worker projection", () => {
  it("preserves configured order and resolves only exact session IDs", () => {
    const exact = session({
      id: "10000000-0000-4000-8000-000000000001",
      displayName: "Not the worker label",
    });
    const sameNameWrongId = session({
      id: "10000000-0000-4000-8000-000000000099",
      displayName: "Missing worker",
    });
    const projection = buildPaciumWorkersProjection({
      ...baseInput(),
      config: readyConfig([
        {
          id: "worker-b",
          label: "Exact worker",
          binding: { type: "session", sessionId: exact.id },
        },
        {
          id: "worker-a",
          label: "Missing worker",
          binding: {
            type: "session",
            sessionId: "10000000-0000-4000-8000-000000000002",
          },
        },
      ]),
      sessions: [sameNameWrongId, exact],
    });

    expect(projection.workers.map(({ id }) => id)).toEqual([
      "worker-b",
      "worker-a",
    ]);
    expect(projection.workers[0]).toMatchObject({
      status: "live",
      sessionId: exact.id,
      canOpen: true,
    });
    expect(projection.workers[1]).toMatchObject({
      status: "missing",
      canOpen: false,
      commandLabel: "Exact session unavailable",
    });
  });

  it("keeps launch presets capability-labelled and never openable", () => {
    const projection = buildPaciumWorkersProjection({
      ...baseInput(),
      config: readyConfig([
        {
          id: "planned-codex",
          label: "Planned Codex",
          binding: {
            type: "launch_preset",
            launchPreset: "codex",
            repositoryId: "pacium",
          },
        },
        {
          id: "missing-claude",
          label: "Missing Claude",
          binding: {
            type: "launch_preset",
            launchPreset: "claude",
            repositoryId: null,
          },
        },
      ]),
      launchPresets: [
        {
          id: "shell",
          label: "Shell",
          available: true,
          unavailableReason: null,
        },
        {
          id: "codex",
          label: "Codex CLI",
          available: true,
          unavailableReason: null,
        },
        {
          id: "claude",
          label: "Claude Code",
          available: false,
          unavailableReason: "Not installed",
        },
      ],
    });

    expect(projection.workers[0]).toMatchObject({
      status: "preset_ready",
      statusLabel: "Configured · not started",
      commandLabel: "Codex CLI",
      repositoryLabel: "Pacium Control",
      canOpen: false,
    });
    expect(projection.workers[1]).toMatchObject({
      status: "preset_unavailable",
      statusLabel: "Preset unavailable",
      canOpen: false,
    });
  });

  it("shows source-labelled process attention without claiming work", () => {
    const workerSession = session();
    const attention: AttentionResult = {
      state: "unknown",
      source: "process",
      confidence: "low",
      observedAt: "2026-07-27T12:00:00.000Z",
      staleAfter: "2026-07-27T12:05:00.000Z",
      reason:
        "Process is live; no provider activity observer is connected yet.",
    };
    const projection = buildPaciumWorkersProjection({
      ...baseInput(),
      config: readyConfig([
        {
          id: "worker-1",
          label: "Implementation",
          binding: { type: "session", sessionId: workerSession.id },
        },
      ]),
      sessions: [workerSession],
      attentionBySession: new Map([[workerSession.id, attention]]),
    });

    expect(projection.workers[0]).toMatchObject({
      attentionLabel: "Unknown",
      attentionObservedAt: attention.observedAt,
      commandLabel: "Codex · Codex CLI",
      repositoryLabel: "Pacium Control",
      repositoryEvidence: "codex/worker · linked worktree",
    });
    expect(projection.workers[0]?.attentionEvidence).toContain(
      "Process observed · Low confidence",
    );
    expect(JSON.stringify(projection)).not.toMatch(
      /task complete|progress \d|working$/i,
    );
  });

  it("shows only already accepted selected-session Git changes", () => {
    const first = session({
      id: "10000000-0000-4000-8000-000000000001",
    });
    const second = session({
      id: "10000000-0000-4000-8000-000000000002",
    });
    const projection = buildPaciumWorkersProjection({
      ...baseInput(),
      config: readyConfig([
        {
          id: "first",
          label: "First",
          binding: { type: "session", sessionId: first.id },
        },
        {
          id: "second",
          label: "Second",
          binding: { type: "session", sessionId: second.id },
        },
      ]),
      sessions: [first, second],
      selectedChanges: {
        sessionId: first.id,
        state: changesState(),
      },
    });

    expect(projection.workers[0]).toMatchObject({
      changesLabel: "1 changed",
    });
    expect(projection.workers[0]?.changesEvidence).toContain(
      "+3 −1 known lines · authorship unverified",
    );
    expect(projection.workers[1]).toMatchObject({
      changesLabel: "Not inspected",
      changesEvidence:
        "Open this worker and use Changes or Activity; no background Git read ran.",
    });
  });

  it("keeps configuration and connection degradation explicit", () => {
    expect(
      buildPaciumWorkersProjection({
        ...baseInput(),
        config: { status: "idle" },
        connection: "reconnecting",
      }),
    ).toMatchObject({
      status: "loading",
      workers: [],
    });
    expect(
      buildPaciumWorkersProjection({
        ...baseInput(),
        config: {
          status: "loaded",
          requestId: "config",
          observation: {
            status: "error",
            revision: null,
            workspace: null,
            error: {
              code: "invalid_file",
              message: "Pacium config is invalid.",
            },
          },
        },
      }),
    ).toEqual({
      status: "error",
      detail: "Pacium config is invalid.",
      workers: [],
    });
  });

  it("labels a disconnected exact worker without discarding its identity", () => {
    const workerSession = session();
    const projection = buildPaciumWorkersProjection({
      ...baseInput(),
      connection: "disconnected",
      config: readyConfig([
        {
          id: "worker-1",
          label: "Worker",
          binding: { type: "session", sessionId: workerSession.id },
        },
      ]),
      sessions: [workerSession],
    });
    expect(projection.workers[0]).toMatchObject({
      statusLabel: "Disconnected · Live process",
      sessionId: workerSession.id,
    });
  });
});

function baseInput() {
  return {
    config: readyConfig([]),
    connection: "connected" as const,
    sessions: [] as SessionSummary[],
    launchPresets: launchPresets(),
    attentionBySession: new Map<string, AttentionResult>(),
    selectedChanges: null,
  };
}

function readyConfig(workers: PaciumWorker[]): PaciumConfigViewState {
  return {
    status: "loaded",
    requestId: "config",
    observation: {
      status: "ready",
      revision: 7,
      workspace: {
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
        workers,
        queueSources: [],
        deliveryMethods: [],
        context: { objective: null, plan: null },
      },
      error: null,
    },
  };
}

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    epoch: 1,
    displayName: "Worker",
    cwd: "/work/pacium",
    shell: "/opt/codex",
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt: "2026-07-27T12:00:00.000Z",
    },
    providerObservation: null,
    repository: {
      status: "ready",
      root: "/work/pacium",
      name: "Pacium Control",
      branch: "codex/worker",
      headCommit: "a".repeat(40),
      headState: "branch",
      worktreeKind: "linked",
      observedAt: "2026-07-27T12:00:00.000Z",
      error: null,
    },
    runtime: "pty",
    processState: "live",
    pid: 123,
    cols: 100,
    rows: 30,
    createdAt: "2026-07-27T11:00:00.000Z",
    exitedAt: null,
    exitCode: null,
    exitSignal: null,
    ...overrides,
  };
}

function launchPresets(): LaunchPresetCapability[] {
  return [
    {
      id: "shell",
      label: "Shell",
      available: true,
      unavailableReason: null,
    },
    {
      id: "codex",
      label: "Codex CLI",
      available: true,
      unavailableReason: null,
    },
    {
      id: "claude",
      label: "Claude Code",
      available: true,
      unavailableReason: null,
    },
  ];
}

function changesState(): RepositoryChangesViewState {
  return {
    status: "loaded",
    requestId: "changes",
    observation: {
      status: "ready",
      root: "/work/pacium",
      headCommit: "a".repeat(40),
      observedAt: "2026-07-27T12:00:00.000Z",
      files: [
        {
          path: "src/app.ts",
          previousPath: null,
          kind: "modified",
          staged: false,
          unstaged: true,
          untracked: false,
          conflicted: false,
          binary: false,
          large: false,
          sizeBytes: 120,
          additions: 3,
          deletions: 1,
        },
      ],
      totals: {
        fileCount: 1,
        additions: 3,
        deletions: 1,
        unavailableLineCount: 0,
        conflictCount: 0,
      },
      truncated: false,
      error: null,
    },
  };
}
