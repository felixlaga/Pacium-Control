import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  duplicateSessionInput,
  relaunchSessionInput,
  sessionActionAvailability,
} from "./session-actions-model.js";

const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Meta",
  cwd: "/work/pacium",
  shell: "/bin/zsh",
  launchPreset: "codex",
  commandLabel: "Codex",
  agentClassification: {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-07-27T10:00:00.000Z",
  },
  providerObservation: null,
  repository: {
    status: "ready",
    root: "/work/pacium",
    name: "pacium",
    branch: "dev",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt: "2026-07-27T10:00:00.000Z",
    error: null,
  },
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 100,
  rows: 30,
  createdAt: "2026-07-27T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

describe("session actions", () => {
  it("distinguishes live signals from ended-session relaunch", () => {
    expect(sessionActionAvailability(session)).toMatchObject({
      canInterrupt: true,
      canRelaunch: false,
      canTerminate: true,
    });
    expect(
      sessionActionAvailability({
        ...session,
        processState: "exited",
        pid: null,
      }),
    ).toMatchObject({
      canInterrupt: false,
      canRelaunch: true,
      canTerminate: true,
    });
  });

  it("disables repository reveal without server-detected context", () => {
    expect(
      sessionActionAvailability({
        ...session,
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
      }),
    ).toMatchObject({ canRevealRepository: false });
  });

  it("duplicates only typed launch fields with a bounded distinct name", () => {
    expect(duplicateSessionInput(session)).toEqual({
      cwd: "/work/pacium",
      displayName: "Meta copy",
      launchPreset: "codex",
      cols: 100,
      rows: 30,
    });
    expect(
      duplicateSessionInput({
        ...session,
        displayName: "x".repeat(120),
      }).displayName,
    ).toHaveLength(120);
  });

  it("builds relaunch input only for an ended session", () => {
    expect(relaunchSessionInput(session)).toBeNull();
    expect(
      relaunchSessionInput({
        ...session,
        processState: "exited",
        pid: null,
      }),
    ).toEqual({
      cwd: "/work/pacium",
      displayName: "Meta",
      launchPreset: "codex",
      cols: 100,
      rows: 30,
    });
  });
});
