import { describe, expect, it } from "vitest";
import type {
  LaunchPresetCapability,
  QueueSourcesObservation,
  SessionSummary,
  TmuxCapability,
} from "@pacium/contracts";

import { buildDiagnosticsSnapshot } from "./diagnostics.js";

const launchPresets: LaunchPresetCapability[] = [
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
    unavailableReason: "not installed",
  },
];

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "15e10fe9-3037-472c-b2f4-6c1270e2b618",
    epoch: 1,
    displayName: "SECRET terminal marker",
    cwd: "/Users/operator/private/repository",
    shell: "/bin/zsh",
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt: "2026-07-28T07:00:00.000Z",
    },
    providerObservation: {
      contractVersion: 1,
      provider: "codex",
      adapterVersion: "1",
      providerVersion: "0.114.0",
      health: {
        state: "degraded",
        source: "native",
        confidence: "confirmed",
        detail: "provider prompt must not escape",
      },
      capabilities: [],
      attention: null,
      activities: [],
      diagnostics: [
        {
          code: "codex.bridge_failed",
          severity: "error",
          message: "TOKEN=secret queue question git diff terminal marker",
          observedAt: "2026-07-28T07:00:00.000Z",
          fields: [{ name: "attempt", value: 7 }],
        },
      ],
      observedAt: "2026-07-28T07:00:00.000Z",
      staleAfter: "2026-07-28T07:05:00.000Z",
    },
    relaunchManifest: {
      schemaVersion: 1,
      id: "715e56ab-782a-4f2b-8869-6aecbb447260",
      sessionId: "15e10fe9-3037-472c-b2f4-6c1270e2b618",
      predecessorSessionId: null,
      displayName: "SECRET terminal marker",
      launchPreset: "codex",
      provider: "codex",
      command: {
        executable: "/secret/codex",
        args: ["--token", "secret"],
      },
      cwd: "/Users/operator/private/repository",
      repository: null,
      environmentKeys: ["SECRET_TOKEN"],
      runtime: "pty",
      tmuxTarget: null,
      tmuxMode: null,
      resumeReference: null,
      createdAt: "2026-07-28T07:00:00.000Z",
      updatedAt: "2026-07-28T07:00:00.000Z",
    },
    repository: {
      status: "ready",
      root: "/Users/operator/private/repository",
      name: "private-repository",
      branch: "secret-branch",
      headCommit: "a".repeat(40),
      headState: "branch",
      worktreeKind: "main",
      observedAt: "2026-07-28T07:00:00.000Z",
      error: null,
    },
    runtime: "pty",
    tmuxTarget: null,
    tmuxMode: null,
    processState: "live",
    pid: 42_424,
    cols: 100,
    rows: 30,
    createdAt: "2026-07-28T07:00:00.000Z",
    exitedAt: null,
    exitCode: null,
    exitSignal: null,
    ...overrides,
  };
}

function queue(): QueueSourcesObservation {
  return {
    status: "ready",
    workspaceRevision: 1,
    observedAt: "2026-07-28T07:00:00.000Z",
    sources: [
      {
        sourceId: "secret-queue-source",
        observationRevision: 1,
        status: "stable",
        observedAt: "2026-07-28T07:00:00.000Z",
        byteLength: 42,
        modifiedAt: "2026-07-28T07:00:00.000Z",
        contentHash: "b".repeat(64),
        classification: {
          status: "candidate",
          boundary: "whole_source_v1",
          candidate: {
            itemId: "c".repeat(64),
            type: "approval",
            confidence: "confirmed",
          },
          diagnostics: [
            {
              code: "legacy_marker",
              message: "A supported plain-text legacy marker was used.",
            },
          ],
        },
        candidateFirstObservedAt: "2026-07-28T07:00:00.000Z",
        conflicts: [],
        error: null,
      },
    ],
    error: null,
  };
}

const tmux: TmuxCapability = {
  state: "ready",
  serverId: "secret-host",
  executable: "/opt/secret/tmux",
  version: "tmux 3.7b",
  detail: "secret socket detail",
};

describe("diagnostics projection", () => {
  it("projects bounded current health without content-bearing source fields", () => {
    const result = buildDiagnosticsSnapshot({
      sessions: [session()],
      queue: queue(),
      tmux,
      launchPresets,
      generatedAt: "2026-07-28T07:30:00.000Z",
      runtime: {
        nodeVersion: "24.18.0",
        platform: "darwin",
        architecture: "arm64",
      },
    });

    expect(result).toMatchObject({
      overview: {
        state: "degraded",
        sessions: {
          total: 1,
          live: 1,
          directPty: 1,
          tmux: 0,
        },
        queueSources: 1,
        queueItems: { approval: 1 },
        tmuxStatus: "ready",
        tmuxVersion: "tmux 3.7b",
      },
      sessions: [
        {
          label: "Terminal 1",
          repositoryPresent: true,
          provider: {
            health: "degraded",
            diagnosticCount: 1,
          },
        },
      ],
    });
    expect(result.diagnostics).toEqual([
      {
        component: "codex_observer",
        code: "codex.bridge_failed",
        severity: "error",
        count: 1,
      },
      {
        component: "queue_observer",
        code: "legacy_marker",
        severity: "info",
        count: 1,
      },
    ]);

    const serialized = JSON.stringify(result);
    for (const prohibited of [
      "SECRET",
      "secret",
      "/Users/",
      "/opt/",
      "--token",
      "42_424",
      "42424",
      "15e10fe9",
      "715e56ab",
      "secret-queue-source",
      "provider prompt",
      "queue question",
      "git diff",
      "terminal marker",
      "private-repository",
      "secret-branch",
      "secret-host",
      "socket detail",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });

  it("aggregates fixed codes and caps export-local session rows", () => {
    const sessions = Array.from({ length: 101 }, (_, index) =>
      session({
        id: `${String(index).padStart(8, "0")}-3037-472c-b2f4-6c1270e2b618`,
        processState: "exited",
        pid: null,
        exitedAt: "2026-07-28T07:10:00.000Z",
        exitCode: 1,
        exitSignal: 0,
      }),
    );
    const result = buildDiagnosticsSnapshot({
      sessions,
      queue: {
        status: "unconfigured",
        workspaceRevision: null,
        observedAt: "2026-07-28T07:00:00.000Z",
        sources: [],
        error: null,
      },
      tmux: {
        state: "unconfigured",
        serverId: null,
        executable: null,
        version: null,
        detail: "not configured",
      },
      launchPresets,
      generatedAt: "2026-07-28T07:30:00.000Z",
    });

    expect(result.sessions).toHaveLength(100);
    expect(result.sessions.at(-1)?.label).toBe("Terminal 100");
    expect(result.sessionsTruncated).toBe(true);
    expect(result.diagnostics).toContainEqual({
      component: "pty_runtime",
      code: "PTY_NONZERO_EXIT",
      severity: "warning",
      count: 101,
    });
  });

  it("sanitizes hostile version and runtime labels", () => {
    const result = buildDiagnosticsSnapshot({
      sessions: [
        session({
          providerObservation: {
            ...session().providerObservation!,
            adapterVersion: "TOKEN=/secret",
            providerVersion: "/Users/operator/.token",
          },
        }),
      ],
      queue: queue(),
      tmux: { ...tmux, version: "/secret/tmux" },
      launchPresets,
      generatedAt: "2026-07-28T07:30:00.000Z",
      runtime: {
        nodeVersion: "24.18.0\nTOKEN",
        platform: "darwin/secret",
        architecture: "arm64",
      },
    });

    expect(result.application.nodeVersion).toBe("unknown");
    expect(result.application.platform).toBe("unknown");
    expect(result.overview.tmuxVersion).toBeNull();
    expect(result.sessions[0]?.provider).toMatchObject({
      adapterVersion: "unknown",
      providerVersion: null,
    });
  });

  it("reports failed sessions separately from normal process exits", () => {
    const result = buildDiagnosticsSnapshot({
      sessions: [
        session({
          processState: "failed",
          pid: null,
          providerObservation: null,
        }),
      ],
      queue: queue(),
      tmux,
      launchPresets,
      generatedAt: "2026-07-28T07:30:00.000Z",
    });

    expect(result.overview.sessions).toMatchObject({
      total: 1,
      failed: 1,
      exited: 0,
    });
    expect(result.components).toContainEqual(
      expect.objectContaining({
        id: "pty_runtime",
        state: "degraded",
      }),
    );
    expect(result.diagnostics).toContainEqual({
      component: "pty_runtime",
      code: "PTY_SESSION_FAILED",
      severity: "error",
      count: 1,
    });
  });
});
