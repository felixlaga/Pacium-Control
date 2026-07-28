import { describe, expect, it } from "vitest";

import {
  DiagnosticsSnapshotSchema,
  MAX_DIAGNOSTIC_CODES,
  MAX_DIAGNOSTICS_COMPONENTS,
  MAX_DIAGNOSTICS_SESSIONS,
  type DiagnosticsSnapshot,
} from "./diagnostics.js";

function snapshot(): DiagnosticsSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-28T07:00:00.000Z",
    application: {
      paciumVersion: "0.0.0",
      protocolVersion: 25,
      nodeVersion: "24.18.0",
      platform: "darwin",
      architecture: "arm64",
      dependencyVersions: {
        nodePty: "1.1.0-pacium.1",
        xtermHeadless: "6.0.0",
        xtermBrowser: "6.0.0",
        react: "19.2.8",
        ws: "8.21.1",
        zod: "4.4.3",
      },
    },
    overview: {
      state: "healthy",
      sessions: {
        total: 1,
        creating: 0,
        live: 1,
        closing: 0,
        exited: 0,
        failed: 0,
        directPty: 1,
        tmux: 0,
      },
      queueStatus: "unconfigured",
      queueSources: 0,
      queueItems: {
        question: 0,
        approval: 0,
        failure: 0,
        review: 0,
        unknown: 0,
      },
      queueConflicts: 0,
      tmuxStatus: "unconfigured",
      tmuxVersion: null,
    },
    components: [
      {
        id: "local_server",
        state: "healthy",
        summary: "The local server is responding.",
        operatorAction: null,
      },
    ],
    sessions: [
      {
        label: "Terminal 1",
        launchPreset: "codex",
        runtime: "pty",
        tmuxMode: null,
        processState: "live",
        cols: 100,
        rows: 30,
        exitCode: null,
        exitSignal: null,
        repositoryPresent: true,
        provider: {
          id: "codex",
          health: "ready",
          adapterVersion: "1",
          providerVersion: "0.114.0",
          diagnosticCount: 0,
        },
      },
    ],
    sessionsTruncated: false,
    diagnostics: [],
    diagnosticsTruncated: false,
    redactionManifest: {
      included: [
        "application_versions",
        "runtime_platform",
        "component_health",
        "session_state",
        "provider_health",
        "queue_status",
        "tmux_status",
        "diagnostic_codes",
      ],
      omitted: [
        "terminal_content",
        "terminal_input",
        "terminal_titles",
        "session_identifiers",
        "process_identifiers",
        "commands_and_arguments",
        "paths_and_repositories",
        "git_content",
        "queue_content_and_decisions",
        "provider_content_and_fields",
        "environment_and_credentials",
        "host_and_operator_identity",
        "relaunch_metadata",
      ],
    },
  };
}

describe("diagnostics contract", () => {
  it("accepts a strict bounded structurally redacted snapshot", () => {
    expect(DiagnosticsSnapshotSchema.parse(snapshot())).toEqual(snapshot());
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...snapshot(),
        sessions: [{ ...snapshot().sessions[0], provider: null }],
      }).success,
    ).toBe(true);
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...snapshot(),
        accessToken: "secret",
      }).success,
    ).toBe(false);
  });

  it("requires sanitized session fields to agree", () => {
    const base = snapshot();
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        sessions: [{ ...base.sessions[0], label: "real-session-id" }],
      }).success,
    ).toBe(false);
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        sessions: [
          {
            ...base.sessions[0],
            launchPreset: "shell",
            provider: base.sessions[0]?.provider,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        sessions: [
          {
            ...base.sessions[0],
            runtime: "tmux",
            tmuxMode: null,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects inconsistent totals, duplicates, controls, and excessive rows", () => {
    const base = snapshot();
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        overview: {
          ...base.overview,
          sessions: { ...base.overview.sessions, total: 2 },
        },
      }).success,
    ).toBe(false);
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        components: [...base.components, ...base.components],
      }).success,
    ).toBe(false);
    expect(
      DiagnosticsSnapshotSchema.safeParse({
        ...base,
        components: [
          {
            ...base.components[0],
            summary: "unsafe\u0000text",
          },
        ],
      }).success,
    ).toBe(false);
    expect(MAX_DIAGNOSTICS_COMPONENTS).toBe(12);
    expect(MAX_DIAGNOSTICS_SESSIONS).toBe(100);
    expect(MAX_DIAGNOSTIC_CODES).toBe(24);
  });

  it("contains only the explicit redaction vocabulary", () => {
    const serialized = JSON.stringify(snapshot());
    for (const prohibited of [
      "/Users/operator/private",
      "session-uuid",
      "pid",
      "accessToken",
      "terminal marker",
      "queue question",
      "provider prompt",
      "git diff",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });
});
