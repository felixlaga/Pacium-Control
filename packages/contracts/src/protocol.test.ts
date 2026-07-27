import { describe, expect, it } from "vitest";

import {
  AgentClassificationSchema,
  ClientMessageSchema,
  decodeTerminalDataFrame,
  encodeTerminalDataFrame,
  GitChangedFileSchema,
  GitChangesObservationSchema,
  GitCommitRecordSchema,
  GitDiffObservationSchema,
  GitDiffSectionSchema,
  GitHistoryObservationSchema,
  MAX_GIT_DIFF_BYTES,
  MAX_GIT_DIFF_LINE_CHARS,
  MAX_GIT_HISTORY_COMMITS,
  MAX_TERMINAL_INPUT_CHARS,
  MAX_VERIFICATION_OUTPUT_BYTES,
  PROTOCOL_VERSION,
  RepositoryRelativePathSchema,
  RepositoryObservationSchema,
  ServerMessageSchema,
  SessionSummarySchema,
  VerificationObservationSchema,
  VerificationPresetSchema,
  VerificationRunSchema,
} from "./protocol.js";

describe("terminal binary frames", () => {
  it("round-trips UTF-8 terminal output", () => {
    const sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";
    const frame = encodeTerminalDataFrame(sessionId, 1, 42, "ready λ 🚀");

    expect(decodeTerminalDataFrame(frame)).toEqual({
      sessionId,
      epoch: 1,
      sequence: 42,
      data: "ready λ 🚀",
    });
  });

  it("rejects an invalid session identifier", () => {
    expect(() =>
      encodeTerminalDataFrame("not-a-session", 1, 1, "data"),
    ).toThrow("session ID");
  });
});

describe("client protocol", () => {
  it("advances the wire contract for queue observation", () => {
    expect(PROTOCOL_VERSION).toBe(12);
  });

  it("accepts only server-owned launch preset identifiers", () => {
    const baseMessage = {
      type: "session.create",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      payload: {
        cwd: "/tmp",
        cols: 80,
        rows: 24,
      },
    };

    expect(
      ClientMessageSchema.safeParse({
        ...baseMessage,
        payload: { ...baseMessage.payload, launchPreset: "codex" },
      }).success,
    ).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...baseMessage,
        payload: {
          ...baseMessage.payload,
          launchPreset: "/bin/zsh -lc dangerous",
          command: "/bin/zsh",
          args: ["-lc", "dangerous"],
        },
      }).success,
    ).toBe(false);

    const fixedPreset = ClientMessageSchema.safeParse({
      ...baseMessage,
      payload: {
        ...baseMessage.payload,
        launchPreset: "shell",
        command: "/bin/zsh",
        args: ["-lc", "dangerous"],
      },
    });
    expect(fixedPreset.success).toBe(false);
  });

  it("accepts only complete revisioned Pacium config requests", () => {
    const workspace = {
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: {
        meta: null,
        orchestrator: null,
      },
      workers: [],
      queueSources: [],
      deliveryMethods: [],
      context: {
        objective: null,
        plan: null,
      },
    };
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";

    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.config.get",
        requestId,
      }).success,
    ).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.config.replace",
        requestId,
        expectedRevision: 0,
        workspace,
      }).success,
    ).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.config.replace",
        requestId,
        expectedRevision: 0,
        workspace,
        command: "/bin/zsh",
        queueContent: "approve everything",
      }).success,
    ).toBe(false);
    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.config.replace",
        requestId,
        expectedRevision: -1,
        workspace,
      }).success,
    ).toBe(false);
  });

  it("accepts strict Pacium config observations", () => {
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";
    expect(
      ServerMessageSchema.safeParse({
        type: "pacium.config",
        requestId,
        observation: {
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        },
      }).success,
    ).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "pacium.config",
        requestId,
        observation: {
          status: "unconfigured",
          revision: 0,
          workspace: null,
          error: null,
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only a content-free queue observation request", () => {
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";
    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.queue.observe",
        requestId,
      }).success,
    ).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        type: "pacium.queue.observe",
        requestId,
        path: "/tmp/queue",
        content: "approve",
      }).success,
    ).toBe(false);
  });

  it("accepts correlated and pushed queue source metadata without text", () => {
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";
    const observation = {
      status: "ready",
      workspaceRevision: 4,
      observedAt: "2026-07-27T12:00:00.000Z",
      sources: [
        {
          sourceId: "needs-felix",
          observationRevision: 1,
          status: "missing",
          observedAt: "2026-07-27T12:00:00.000Z",
          byteLength: null,
          modifiedAt: null,
          contentHash: null,
          classification: null,
          error: null,
        },
        {
          sourceId: "review",
          observationRevision: 2,
          status: "stable",
          observedAt: "2026-07-27T12:00:00.000Z",
          byteLength: 24,
          modifiedAt: "2026-07-27T11:59:00.000Z",
          contentHash: "a".repeat(64),
          classification: {
            status: "candidate",
            boundary: "whole_source_v1",
            candidate: {
              itemId: "b".repeat(64),
              type: "review",
              confidence: "confirmed",
            },
            diagnostics: [],
          },
          error: null,
        },
      ],
      error: null,
    };
    expect(
      ServerMessageSchema.safeParse({
        type: "pacium.queue.sources",
        requestId,
        observation,
      }).success,
    ).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "pacium.queue.sources.updated",
        observation,
      }).success,
    ).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "pacium.queue.sources.updated",
        observation: {
          ...observation,
          sources: [{ ...observation.sources[0], originalText: "approve" }],
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only a session identity for repository refresh", () => {
    const message = {
      type: "session.refreshRepository",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        command: "git status",
      }).success,
    ).toBe(false);
  });

  it("accepts only a session identity for changed-file inspection", () => {
    const message = {
      type: "repository.changes",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        root: "/tmp/browser-controlled",
        command: "git status",
      }).success,
    ).toBe(false);
  });

  it("accepts only a bounded changed-file selector for diff inspection", () => {
    const message = {
      type: "repository.diff",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      path: "apps/web/src/app.tsx",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    for (const path of [
      "/tmp/escape",
      "../escape",
      "nested\\..\\escape",
      "C:\\escape",
      "\\\\server\\share",
      "x".repeat(4097),
    ]) {
      expect(ClientMessageSchema.safeParse({ ...message, path }).success).toBe(
        false,
      );
    }
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        root: "/tmp/browser-controlled",
        revision: "main",
        command: "git diff",
      }).success,
    ).toBe(false);
  });

  it("accepts only a session identity for commit-history inspection", () => {
    const message = {
      type: "repository.history",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        root: "/tmp/browser-controlled",
        revision: "origin/main..HEAD",
        count: 5_000,
        command: "git log",
      }).success,
    ).toBe(false);
  });

  it("accepts only server-owned verification and run identities", () => {
    const inspect = {
      type: "repository.verification.inspect",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    const run = {
      type: "repository.verification.run",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      presetId: "verify",
    };
    const cancel = {
      type: "repository.verification.cancel",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    };

    expect(ClientMessageSchema.safeParse(inspect).success).toBe(true);
    expect(ClientMessageSchema.safeParse(run).success).toBe(true);
    expect(ClientMessageSchema.safeParse(cancel).success).toBe(true);
    for (const unsafe of [
      { ...inspect, root: "/tmp/browser-root" },
      { ...run, executable: "/bin/zsh" },
      { ...run, args: ["-lc", "dangerous"] },
      { ...run, timeoutMs: 600_000 },
      { ...cancel, signal: "SIGKILL" },
    ]) {
      expect(ClientMessageSchema.safeParse(unsafe).success).toBe(false);
    }
  });

  it("accepts a bounded terminal input command", () => {
    const result = ClientMessageSchema.safeParse({
      type: "terminal.input",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      data: "pwd\r",
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized terminal input", () => {
    const result = ClientMessageSchema.safeParse({
      type: "terminal.input",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      data: "x".repeat(MAX_TERMINAL_INPUT_CHARS + 1),
    });

    expect(result.success).toBe(false);
  });

  it("accepts bounded rename metadata and rejects blank names", () => {
    const message = {
      type: "session.rename",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    const renamed = ClientMessageSchema.safeParse({
      ...message,
      displayName: "  Meta  ",
    });
    expect(renamed.success).toBe(true);
    if (renamed.success && renamed.data.type === "session.rename") {
      expect(renamed.data.displayName).toBe("Meta");
    }
    expect(
      ClientMessageSchema.safeParse({ ...message, displayName: "   " }).success,
    ).toBe(false);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        displayName: "x".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("never accepts a browser-supplied reveal path", () => {
    const message = {
      type: "session.revealRepository",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        path: "/tmp/browser-controlled",
      }).success,
    ).toBe(false);
  });

  it("never accepts browser-supplied classification on create", () => {
    expect(
      ClientMessageSchema.safeParse({
        type: "session.create",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
        payload: {
          cwd: "/tmp",
          cols: 80,
          rows: 24,
          launchPreset: "codex",
          agentClassification: {
            type: "claude",
            label: "Fake",
            source: "human_labelled",
            confidence: "confirmed",
            observedAt: "2026-07-27T10:00:00.000Z",
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("agent classification contract", () => {
  const classification = {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-07-27T10:00:00.000Z",
  };

  it("accepts bounded launch evidence and rejects unknown fields", () => {
    expect(AgentClassificationSchema.safeParse(classification).success).toBe(
      true,
    );
    expect(
      AgentClassificationSchema.safeParse({
        ...classification,
        terminalOutput: "Working...",
      }).success,
    ).toBe(false);
    expect(
      AgentClassificationSchema.safeParse({
        ...classification,
        confidence: "certain",
      }).success,
    ).toBe(false);
  });

  it("requires classification on every session summary", () => {
    const session = {
      id: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      epoch: 1,
      displayName: "Meta",
      cwd: "/tmp",
      shell: "/usr/local/bin/codex",
      launchPreset: "codex",
      commandLabel: "Codex",
      agentClassification: classification,
      repository: {
        status: "not_repository",
        root: null,
        name: null,
        branch: null,
        headCommit: null,
        headState: "unknown",
        worktreeKind: "unknown",
        observedAt: "2026-07-27T10:00:00.000Z",
        error: null,
      },
      runtime: "pty",
      processState: "live",
      pid: 42,
      cols: 80,
      rows: 24,
      createdAt: "2026-07-27T10:00:00.000Z",
      exitedAt: null,
      exitCode: null,
      exitSignal: null,
    };

    expect(SessionSummarySchema.safeParse(session).success).toBe(true);
    expect(
      SessionSummarySchema.safeParse({
        ...session,
        agentClassification: undefined,
      }).success,
    ).toBe(false);
  });
});

describe("repository observation contract", () => {
  const observedAt = "2026-07-27T10:00:00.000Z";
  const ready = {
    status: "ready",
    root: "/work/pacium",
    name: "pacium",
    branch: "codex/repository-context",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "linked",
    observedAt,
    error: null,
  };

  it("accepts complete branch, detached, unborn, and non-repository states", () => {
    expect(RepositoryObservationSchema.safeParse(ready).success).toBe(true);
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        branch: null,
        headState: "detached",
      }).success,
    ).toBe(true);
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        headCommit: null,
        headState: "unborn",
      }).success,
    ).toBe(true);
    expect(
      RepositoryObservationSchema.safeParse({
        status: "not_repository",
        root: null,
        name: null,
        branch: null,
        headCommit: null,
        headState: "unknown",
        worktreeKind: "unknown",
        observedAt,
        error: null,
      }).success,
    ).toBe(true);
  });

  it("requires evidence combinations to match status and head state", () => {
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        headState: "detached",
      }).success,
    ).toBe(false);
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        headState: "unborn",
      }).success,
    ).toBe(false);
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        status: "error",
        branch: null,
        headCommit: null,
        headState: "unknown",
        error: null,
      }).success,
    ).toBe(false);
    expect(
      RepositoryObservationSchema.safeParse({
        ...ready,
        terminalOutput: "secret",
      }).success,
    ).toBe(false);
  });

  it("accepts bounded degraded evidence with or without a known root", () => {
    const error = {
      status: "error",
      root: "/work/pacium",
      name: "pacium",
      branch: null,
      headCommit: null,
      headState: "unknown",
      worktreeKind: "linked",
      observedAt,
      error: {
        code: "timeout",
        message: "Git inspection timed out.",
      },
    };
    expect(RepositoryObservationSchema.safeParse(error).success).toBe(true);
    expect(
      RepositoryObservationSchema.safeParse({
        ...error,
        root: null,
        name: null,
        worktreeKind: "unknown",
      }).success,
    ).toBe(true);
    expect(
      RepositoryObservationSchema.safeParse({
        ...error,
        error: { ...error.error, message: "x".repeat(201) },
      }).success,
    ).toBe(false);
  });
});

describe("changed-file observation contract", () => {
  const file = {
    path: "apps/web/src/app.tsx",
    previousPath: null,
    kind: "modified",
    staged: true,
    unstaged: true,
    untracked: false,
    conflicted: false,
    additions: 12,
    deletions: 3,
    binary: false,
    large: false,
    sizeBytes: 42_000,
  };
  const ready = {
    status: "ready",
    root: "/work/pacium",
    headCommit: "a".repeat(40),
    observedAt: "2026-07-27T10:00:00.000Z",
    files: [file],
    totals: {
      fileCount: 1,
      additions: 12,
      deletions: 3,
      unavailableLineCount: 0,
      conflictCount: 0,
    },
    truncated: false,
    error: null,
  };

  it("accepts bounded mixed tracked evidence and exact totals", () => {
    expect(GitChangesObservationSchema.safeParse(ready).success).toBe(true);
    expect(
      GitChangesObservationSchema.safeParse({
        ...ready,
        totals: { ...ready.totals, additions: 13 },
      }).success,
    ).toBe(false);
  });

  it("requires previous paths and binary/count invariants", () => {
    expect(
      GitChangedFileSchema.safeParse({
        ...file,
        kind: "renamed",
      }).success,
    ).toBe(false);
    expect(
      GitChangedFileSchema.safeParse({
        ...file,
        binary: true,
      }).success,
    ).toBe(false);
    expect(
      GitChangedFileSchema.safeParse({
        ...file,
        path: "unsafe\0path",
      }).success,
    ).toBe(false);
  });

  it("accepts non-repository and bounded error states without files", () => {
    const empty = {
      status: "not_repository",
      root: null,
      headCommit: null,
      observedAt: ready.observedAt,
      files: [],
      totals: {
        fileCount: 0,
        additions: 0,
        deletions: 0,
        unavailableLineCount: 0,
        conflictCount: 0,
      },
      truncated: false,
      error: null,
    };
    expect(GitChangesObservationSchema.safeParse(empty).success).toBe(true);
    expect(
      GitChangesObservationSchema.safeParse({
        ...empty,
        status: "error",
        root: "/work/pacium",
        error: {
          code: "timeout",
          message: "Git changes inspection timed out.",
        },
      }).success,
    ).toBe(true);
    expect(
      GitChangesObservationSchema.safeParse({
        ...empty,
        status: "error",
        error: null,
      }).success,
    ).toBe(false);

    expect(
      ServerMessageSchema.safeParse({
        type: "repository.changes",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
        sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        observation: empty,
      }).success,
    ).toBe(true);
  });
});

describe("bounded diff observation contract", () => {
  const patch = [
    "diff --git a/file.ts b/file.ts",
    "--- a/file.ts",
    "+++ b/file.ts",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");
  const byteCount = new TextEncoder().encode(patch).byteLength;
  const section = {
    source: "combined",
    patch,
    byteCount,
    lineCount: 6,
  };
  const ready = {
    status: "ready",
    root: "/work/pacium",
    headCommit: "a".repeat(40),
    path: "file.ts",
    previousPath: null,
    observedAt: "2026-07-27T10:00:00.000Z",
    sections: [section],
    patchBytes: byteCount,
    patchLines: 6,
    error: null,
  };

  it("accepts exact bounded patch sections and wire responses", () => {
    expect(GitDiffSectionSchema.safeParse(section).success).toBe(true);
    expect(GitDiffObservationSchema.safeParse(ready).success).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "repository.diff",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
        sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        observation: ready,
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched counts, unsafe paths, lines, and section sources", () => {
    expect(
      GitDiffObservationSchema.safeParse({
        ...ready,
        patchBytes: byteCount + 1,
      }).success,
    ).toBe(false);
    expect(
      GitDiffObservationSchema.safeParse({
        ...ready,
        path: "../../secret",
      }).success,
    ).toBe(false);
    expect(
      GitDiffSectionSchema.safeParse({
        ...section,
        patch: "x".repeat(MAX_GIT_DIFF_BYTES + 1),
        byteCount: MAX_GIT_DIFF_BYTES + 1,
        lineCount: 1,
      }).success,
    ).toBe(false);
    const longLine = "x".repeat(MAX_GIT_DIFF_LINE_CHARS + 1);
    expect(
      GitDiffSectionSchema.safeParse({
        source: "combined",
        patch: longLine,
        byteCount: longLine.length,
        lineCount: 1,
      }).success,
    ).toBe(false);
    expect(
      GitDiffObservationSchema.safeParse({
        ...ready,
        sections: [
          { ...section, source: "combined" },
          { ...section, source: "unstaged" },
        ],
        patchBytes: byteCount * 2,
        patchLines: 12,
      }).success,
    ).toBe(false);
  });

  it("accepts honest empty, binary, large, missing, absent, and error states", () => {
    const unavailable = {
      ...ready,
      status: "empty",
      sections: [],
      patchBytes: 0,
      patchLines: 0,
    };
    for (const status of ["empty", "binary", "too_large", "not_found"]) {
      expect(
        GitDiffObservationSchema.safeParse({
          ...unavailable,
          status,
        }).success,
      ).toBe(true);
    }
    expect(
      GitDiffObservationSchema.safeParse({
        ...unavailable,
        status: "not_repository",
        root: null,
        headCommit: null,
      }).success,
    ).toBe(true);
    expect(
      GitDiffObservationSchema.safeParse({
        ...unavailable,
        status: "error",
        error: {
          code: "timeout",
          message: "Git diff inspection timed out.",
        },
      }).success,
    ).toBe(true);
    expect(
      GitDiffObservationSchema.safeParse({
        ...unavailable,
        status: "error",
        root: null,
        headCommit: "a".repeat(40),
        error: {
          code: "repository_unavailable",
          message: "Repository evidence is unavailable.",
        },
      }).success,
    ).toBe(false);
    expect(
      GitDiffObservationSchema.safeParse({
        ...unavailable,
        status: "binary",
        error: {
          code: "inspection_failed",
          message: "Unexpected error.",
        },
      }).success,
    ).toBe(false);
  });

  it("shares one strict safe repository path contract", () => {
    expect(
      RepositoryRelativePathSchema.safeParse("src/new\nline.ts").success,
    ).toBe(true);
    expect(
      RepositoryRelativePathSchema.safeParse("nested/../escape").success,
    ).toBe(false);
    expect(
      RepositoryRelativePathSchema.safeParse("\\\\server\\share").success,
    ).toBe(false);
  });
});

describe("bounded commit-history observation contract", () => {
  const record = {
    id: "a".repeat(40),
    parents: ["b".repeat(40), "c".repeat(40)],
    authorName: "Pacium Agent",
    authoredAt: "2026-07-27T10:00:00.000+02:00",
    subject: "Keep history bounded",
  };
  const ready = {
    status: "ready",
    root: "/work/pacium",
    headCommit: record.id,
    observedAt: "2026-07-27T10:05:00.000Z",
    commits: [record],
    truncated: false,
    error: null,
  };

  it("accepts bounded merge evidence and the strict wire response", () => {
    expect(GitCommitRecordSchema.safeParse(record).success).toBe(true);
    expect(GitHistoryObservationSchema.safeParse(ready).success).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "repository.history",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
        sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        observation: ready,
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe text, invalid parent evidence, and extra fields", () => {
    for (const field of ["authorName", "subject"] as const) {
      expect(
        GitCommitRecordSchema.safeParse({
          ...record,
          [field]: `safe\nforged row`,
        }).success,
      ).toBe(false);
    }
    expect(
      GitCommitRecordSchema.safeParse({
        ...record,
        parents: [record.id],
      }).success,
    ).toBe(false);
    expect(
      GitCommitRecordSchema.safeParse({
        ...record,
        parents: Array.from({ length: 17 }, (_, index) =>
          index.toString(16).padStart(40, "0"),
        ),
      }).success,
    ).toBe(false);
    expect(
      GitCommitRecordSchema.safeParse({
        ...record,
        authorEmail: "not-requested@example.test",
      }).success,
    ).toBe(false);
  });

  it("requires unique newest-first evidence beginning at HEAD", () => {
    expect(
      GitHistoryObservationSchema.safeParse({
        ...ready,
        headCommit: "d".repeat(40),
      }).success,
    ).toBe(false);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...ready,
        commits: [record, record],
      }).success,
    ).toBe(false);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...ready,
        truncated: true,
      }).success,
    ).toBe(false);

    const commits = [
      record,
      ...Array.from({ length: MAX_GIT_HISTORY_COMMITS - 1 }, (_, index) => ({
        ...record,
        id: (index + 1).toString(16).padStart(40, "0"),
        parents: [],
      })),
    ];
    expect(
      GitHistoryObservationSchema.safeParse({
        ...ready,
        commits,
        truncated: true,
      }).success,
    ).toBe(true);
  });

  it("accepts honest unborn, non-repository, and degraded states", () => {
    const empty = {
      status: "empty",
      root: "/work/pacium",
      headCommit: null,
      observedAt: ready.observedAt,
      commits: [],
      truncated: false,
      error: null,
    };
    expect(GitHistoryObservationSchema.safeParse(empty).success).toBe(true);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...empty,
        status: "not_repository",
        root: null,
      }).success,
    ).toBe(true);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...empty,
        status: "error",
        headCommit: record.id,
        error: {
          code: "timeout",
          message: "Git history inspection timed out.",
        },
      }).success,
    ).toBe(true);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...empty,
        status: "error",
        error: null,
      }).success,
    ).toBe(false);
    expect(
      GitHistoryObservationSchema.safeParse({
        ...empty,
        status: "not_repository",
        headCommit: record.id,
      }).success,
    ).toBe(false);
  });
});

describe("verification preset contract", () => {
  const preset = {
    id: "verify",
    label: "Project verification",
    description: "Run the local verification gate",
    executable: "/opt/pacium/bin/pnpm",
    args: ["verify", "--reporter=dot"],
    timeoutMs: 600_000,
  };
  const activeRun = {
    runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    presetId: "verify",
    status: "running",
    startedAt: "2026-07-27T10:00:00.000Z",
    completedAt: null,
    durationMs: null,
    headCommitAtStart: "a".repeat(40),
    headCommitAtEnd: null,
    headComparison: null,
    exitCode: null,
    signal: null,
    terminationForced: false,
    stdout: "",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    error: null,
  };
  const passedRun = {
    ...activeRun,
    status: "passed",
    completedAt: "2026-07-27T10:00:02.000Z",
    durationMs: 2_000,
    headCommitAtEnd: "a".repeat(40),
    headComparison: "same",
    exitCode: 0,
    stdout: "51 files passed\n",
  };
  const ready = {
    status: "ready",
    configured: true,
    root: "/work/pacium",
    observedAt: "2026-07-27T10:00:02.000Z",
    presets: [preset],
    run: passedRun,
    error: null,
  };

  it("accepts bounded public presets and rejects executable controls", () => {
    expect(VerificationPresetSchema.safeParse(preset).success).toBe(true);
    for (const invalid of [
      { ...preset, executable: "pnpm" },
      { ...preset, id: "Verify now" },
      { ...preset, args: ["safe", "unsafe\nargument"] },
      { ...preset, shell: true },
    ]) {
      expect(VerificationPresetSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("keeps active runs free of invented result evidence", () => {
    expect(VerificationRunSchema.safeParse(activeRun).success).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...activeRun,
        status: "cancelling",
      }).success,
    ).toBe(true);
    for (const invalid of [
      { ...activeRun, stdout: "partial output" },
      { ...activeRun, completedAt: "2026-07-27T10:00:01.000Z" },
      { ...activeRun, signal: "SIGTERM" },
      { ...activeRun, terminationForced: true },
    ]) {
      expect(VerificationRunSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("distinguishes terminal outcomes and exact HEAD relationships", () => {
    expect(VerificationRunSchema.safeParse(passedRun).success).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        status: "failed",
        exitCode: 1,
      }).success,
    ).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        status: "timed_out",
        exitCode: null,
        signal: "SIGTERM",
      }).success,
    ).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        status: "cancelled",
        exitCode: null,
        signal: "SIGKILL",
        terminationForced: true,
      }).success,
    ).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        status: "error",
        exitCode: null,
        error: {
          code: "spawn_failed",
          message: "The configured process could not be started.",
        },
      }).success,
    ).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        headCommitAtEnd: "b".repeat(40),
        headComparison: "same",
      }).success,
    ).toBe(false);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        headCommitAtEnd: null,
        headComparison: "same",
      }).success,
    ).toBe(false);
  });

  it("bounds UTF-8 output and rejects terminal control sequences", () => {
    const maximumEmojiOutput = "🚀".repeat(MAX_VERIFICATION_OUTPUT_BYTES / 4);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        stdout: maximumEmojiOutput,
      }).success,
    ).toBe(true);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        stdout: `${maximumEmojiOutput}x`,
      }).success,
    ).toBe(false);
    expect(
      VerificationRunSchema.safeParse({
        ...passedRun,
        stdout: "\u001b]52;c;secret\u0007",
      }).success,
    ).toBe(false);
  });

  it("accepts only internally consistent observation states", () => {
    expect(VerificationObservationSchema.safeParse(ready).success).toBe(true);
    expect(
      VerificationObservationSchema.safeParse({
        status: "unconfigured",
        configured: false,
        root: null,
        observedAt: ready.observedAt,
        presets: [],
        run: null,
        error: null,
      }).success,
    ).toBe(true);
    expect(
      VerificationObservationSchema.safeParse({
        ...ready,
        status: "no_presets",
        presets: [],
        run: null,
      }).success,
    ).toBe(true);
    expect(
      VerificationObservationSchema.safeParse({
        ...ready,
        run: { ...passedRun, presetId: "other" },
      }).success,
    ).toBe(false);
    expect(
      VerificationObservationSchema.safeParse({
        ...ready,
        status: "error",
        presets: [],
        run: null,
        error: null,
      }).success,
    ).toBe(false);
  });

  it("accepts bounded verification responses and server updates", () => {
    const response = {
      type: "repository.verification",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      observation: ready,
    };
    expect(ServerMessageSchema.safeParse(response).success).toBe(true);
    expect(
      ServerMessageSchema.safeParse({
        type: "repository.verification.updated",
        sessionId: response.sessionId,
        observation: ready,
      }).success,
    ).toBe(true);
  });
});
