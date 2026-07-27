import { describe, expect, it } from "vitest";

import {
  AgentClassificationSchema,
  ClientMessageSchema,
  decodeTerminalDataFrame,
  encodeTerminalDataFrame,
  MAX_TERMINAL_INPUT_CHARS,
  PROTOCOL_VERSION,
  RepositoryObservationSchema,
  SessionSummarySchema,
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
  it("advances the wire contract for required agent classification", () => {
    expect(PROTOCOL_VERSION).toBe(5);
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
