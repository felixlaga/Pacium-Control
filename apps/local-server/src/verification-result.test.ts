import { describe, expect, it } from "vitest";

import { completeVerificationRun } from "./verification-result.js";

describe("verification result classification", () => {
  const activeRun = {
    runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    presetId: "verify",
    status: "running" as const,
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
  const base = {
    activeRun,
    completedAt: "2026-07-27T10:00:02.000Z",
    headCommitAtEnd: "a".repeat(40),
    stdout: { text: "passed\n", truncated: false },
    stderr: { text: "", truncated: false },
  };

  it("classifies zero and nonzero exits", () => {
    expect(
      completeVerificationRun({
        ...base,
        completion: {
          kind: "closed",
          exitCode: 0,
          signal: null,
          terminationReason: null,
          terminationForced: false,
        },
      }),
    ).toMatchObject({
      status: "passed",
      durationMs: 2_000,
      headComparison: "same",
      exitCode: 0,
    });
    expect(
      completeVerificationRun({
        ...base,
        completion: {
          kind: "closed",
          exitCode: 2,
          signal: null,
          terminationReason: null,
          terminationForced: false,
        },
      }),
    ).toMatchObject({ status: "failed", exitCode: 2 });
  });

  it("preserves cancellation, timeout, and forced termination", () => {
    expect(
      completeVerificationRun({
        ...base,
        completion: {
          kind: "closed",
          exitCode: null,
          signal: "SIGTERM",
          terminationReason: "cancelled",
          terminationForced: false,
        },
      }),
    ).toMatchObject({
      status: "cancelled",
      signal: "SIGTERM",
      terminationForced: false,
    });
    expect(
      completeVerificationRun({
        ...base,
        completion: {
          kind: "closed",
          exitCode: null,
          signal: "SIGKILL",
          terminationReason: "timed_out",
          terminationForced: true,
        },
      }),
    ).toMatchObject({
      status: "timed_out",
      signal: "SIGKILL",
      terminationForced: true,
    });
  });

  it("labels changed and unavailable HEAD evidence", () => {
    expect(
      completeVerificationRun({
        ...base,
        headCommitAtEnd: "b".repeat(40),
        completion: {
          kind: "closed",
          exitCode: 0,
          signal: null,
          terminationReason: null,
          terminationForced: false,
        },
      }),
    ).toMatchObject({ headComparison: "changed" });
    expect(
      completeVerificationRun({
        ...base,
        headCommitAtEnd: null,
        completion: {
          kind: "closed",
          exitCode: 0,
          signal: null,
          terminationReason: null,
          terminationForced: false,
        },
      }),
    ).toMatchObject({ headComparison: "unavailable" });
  });

  it("keeps bounded execution errors distinct", () => {
    expect(
      completeVerificationRun({
        ...base,
        completion: {
          kind: "error",
          code: "spawn_failed",
          message: "The configured process could not be started.",
        },
      }),
    ).toMatchObject({
      status: "error",
      exitCode: null,
      error: { code: "spawn_failed" },
    });
  });
});
