import { VerificationRunSchema, type VerificationRun } from "@pacium/contracts";

import type { CapturedVerificationOutput } from "./verification-output.js";

export type VerificationTerminationReason = "cancelled" | "timed_out";

export type VerificationProcessCompletion =
  | {
      kind: "closed";
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      terminationReason: VerificationTerminationReason | null;
      terminationForced: boolean;
    }
  | {
      kind: "error";
      code: "spawn_failed" | "process_error";
      message: string;
    };

export interface CompleteVerificationRunInput {
  activeRun: VerificationRun;
  completion: VerificationProcessCompletion;
  completedAt: string;
  headCommitAtEnd: string | null;
  stdout: CapturedVerificationOutput;
  stderr: CapturedVerificationOutput;
}

export function completeVerificationRun(
  input: CompleteVerificationRunInput,
): VerificationRun {
  const { activeRun, completion } = input;
  const durationMs = Math.max(
    0,
    Date.parse(input.completedAt) - Date.parse(activeRun.startedAt),
  );
  const headComparison =
    activeRun.headCommitAtStart === null || input.headCommitAtEnd === null
      ? "unavailable"
      : activeRun.headCommitAtStart === input.headCommitAtEnd
        ? "same"
        : "changed";

  if (completion.kind === "error") {
    return VerificationRunSchema.parse({
      ...activeRun,
      status: "error",
      completedAt: input.completedAt,
      durationMs,
      headCommitAtEnd: input.headCommitAtEnd,
      headComparison,
      stdout: input.stdout.text,
      stderr: input.stderr.text,
      stdoutTruncated: input.stdout.truncated,
      stderrTruncated: input.stderr.truncated,
      error: {
        code: completion.code,
        message: completion.message,
      },
    });
  }

  const status =
    completion.terminationReason ??
    (completion.exitCode === 0 && completion.signal === null
      ? "passed"
      : completion.exitCode !== null || completion.signal !== null
        ? "failed"
        : "error");
  const invalidResult =
    status === "error"
      ? {
          code: "invalid_result" as const,
          message: "The verification process ended without exit evidence.",
        }
      : null;

  return VerificationRunSchema.parse({
    ...activeRun,
    status,
    completedAt: input.completedAt,
    durationMs,
    headCommitAtEnd: input.headCommitAtEnd,
    headComparison,
    exitCode: completion.exitCode,
    signal: completion.signal,
    terminationForced:
      completion.terminationReason === null
        ? false
        : completion.terminationForced,
    stdout: input.stdout.text,
    stderr: input.stderr.text,
    stdoutTruncated: input.stdout.truncated,
    stderrTruncated: input.stderr.truncated,
    error: invalidResult,
  });
}
