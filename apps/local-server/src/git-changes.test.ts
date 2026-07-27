import { describe, expect, it, vi } from "vitest";

import {
  FIXED_GIT_CHANGES_TIMEOUT_MILLISECONDS,
  inspectGitChanges,
} from "./git-changes.js";
import {
  GitCommandFailure,
  type GitCommandResult,
  type GitCommandRunner,
} from "./repository-context.js";

const observedAt = "2026-07-27T10:00:00.000Z";
const head = "a".repeat(40);
const repository = {
  status: "ready" as const,
  root: "/work/pacium",
  name: "pacium",
  branch: "dev",
  headCommit: head,
  headState: "branch" as const,
  worktreeKind: "main" as const,
  observedAt,
  error: null,
};

function result(stdout: string, exitCode = 0): GitCommandResult {
  return { exitCode, stdout, stderr: "" };
}

function queueRunner(results: GitCommandResult[]): GitCommandRunner {
  const queue = [...results];
  return vi.fn(() => {
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error("Unexpected Git command"))
      : Promise.resolve(next);
  });
}

function ordinary(xy: string, path: string): string {
  return `1 ${xy} N... 100644 100644 100644 ${head} ${head} ${path}\0`;
}

describe("bounded Git changes inspection", () => {
  it("reads status, HEAD, numstat, and size from fixed repository arguments", async () => {
    const runGit = queueRunner([
      result(`${ordinary("M.", "tracked.ts")}? new.txt\0`),
      result(`${head}\n`),
      result("4\t2\ttracked.ts\0"),
    ]);
    const readSize = vi.fn(() => Promise.resolve(1_024));

    const observation = await inspectGitChanges(repository, {
      observedAt,
      runGit,
      readSize,
    });
    expect(observation).toMatchObject({
      status: "ready",
      root: repository.root,
      headCommit: head,
      totals: {
        fileCount: 2,
        additions: 4,
        deletions: 2,
        unavailableLineCount: 1,
      },
    });
    expect(runGit).toHaveBeenNthCalledWith(
      1,
      repository.root,
      expect.arrayContaining([
        "-C",
        repository.root,
        "status",
        "--porcelain=v2",
        "-z",
      ]),
    );
    expect(runGit).toHaveBeenNthCalledWith(
      3,
      repository.root,
      expect.arrayContaining(["diff", "--numstat", "--no-renames", head]),
    );
    expect(readSize).toHaveBeenCalledWith(repository.root, "tracked.ts");
  });

  it("handles an unborn repository by combining cached and unstaged numstat", async () => {
    const runGit = queueRunner([
      result(ordinary("AM", "new.ts")),
      result("", 128),
      result("3\t0\tnew.ts\0"),
      result("2\t1\tnew.ts\0"),
    ]);
    const observation = await inspectGitChanges(
      {
        ...repository,
        branch: "main",
        headCommit: null,
        headState: "unborn",
      },
      {
        observedAt,
        runGit,
        readSize: () => Promise.resolve(500),
      },
    );
    expect(observation).toMatchObject({
      headCommit: null,
      files: [{ path: "new.ts", additions: 5, deletions: 1 }],
    });
  });

  it("returns honest non-repository and degraded states without running Git", async () => {
    const runGit = vi.fn<GitCommandRunner>();
    const absent = await inspectGitChanges(
      {
        status: "not_repository",
        root: null,
        name: null,
        branch: null,
        headCommit: null,
        headState: "unknown",
        worktreeKind: "unknown",
        observedAt,
        error: null,
      },
      { observedAt, runGit },
    );
    expect(absent.status).toBe("not_repository");
    expect(runGit).not.toHaveBeenCalled();

    const degraded = await inspectGitChanges(
      {
        ...repository,
        status: "error",
        branch: null,
        headCommit: null,
        headState: "unknown",
        error: {
          code: "inspection_failed",
          message: "Git failed.",
        },
      },
      { observedAt, runGit },
    );
    expect(degraded).toMatchObject({
      status: "error",
      error: { code: "repository_unavailable" },
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it("contains timeout and malformed status as bounded errors", async () => {
    const timedOut = await inspectGitChanges(repository, {
      observedAt,
      runGit: () => Promise.reject(new GitCommandFailure("timeout")),
    });
    expect(timedOut.error).toEqual({
      code: "timeout",
      message: "Git changes inspection timed out.",
    });

    const malformed = await inspectGitChanges(repository, {
      observedAt,
      runGit: queueRunner([result("unsupported\0"), result(`${head}\n`)]),
    });
    expect(malformed).toMatchObject({
      status: "error",
      files: [],
      error: { code: "invalid_output" },
    });
    expect(FIXED_GIT_CHANGES_TIMEOUT_MILLISECONDS).toBeLessThanOrEqual(1_500);
  });
});
