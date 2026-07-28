import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FIXED_GIT_MAX_OUTPUT_BYTES,
  FIXED_GIT_TIMEOUT_MILLISECONDS,
  GitCommandFailure,
  inspectRepositoryContext,
  type GitCommandResult,
  type GitCommandRunner,
} from "./repository-context.js";

const observedAt = "2026-07-27T10:00:00.000Z";
const commit = "a".repeat(40);

function runner(results: GitCommandResult[]): GitCommandRunner {
  const queue = [...results];
  return vi.fn(() => {
    const result = queue.shift();
    if (result === undefined) {
      return Promise.reject(new Error("Unexpected Git command."));
    }
    return Promise.resolve(result);
  });
}

function result(stdout: string, exitCode = 0, stderr = ""): GitCommandResult {
  return { exitCode, stdout, stderr };
}

describe("repository context inspection", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("derives branch and main-worktree evidence from fixed commands", async () => {
    const cwd = await fixtureRoot();
    const gitDirectory = `${cwd}/.git`;
    const runGit = runner([
      result(`${cwd}\n${gitDirectory}\n${gitDirectory}\n`),
      result("codex/repository-context\n"),
      result(`${commit}\n`),
    ]);

    await expect(
      inspectRepositoryContext(cwd, { observedAt, runGit }),
    ).resolves.toEqual({
      status: "ready",
      root: cwd,
      name: cwd.split("/").at(-1),
      branch: "codex/repository-context",
      headCommit: commit,
      headState: "branch",
      worktreeKind: "main",
      observedAt,
      error: null,
    });
    expect(runGit).toHaveBeenCalledTimes(3);
    expect(runGit).toHaveBeenNthCalledWith(
      1,
      cwd,
      expect.arrayContaining([
        "rev-parse",
        "--show-toplevel",
        "--absolute-git-dir",
      ]),
    );
    expect(runGit).toHaveBeenNthCalledWith(
      2,
      cwd,
      expect.arrayContaining(["symbolic-ref", "--short", "HEAD"]),
    );
  });

  it("distinguishes detached, unborn, and linked worktrees", async () => {
    const cwd = await fixtureRoot();
    const linkedGitDirectory = `${cwd}/apps`;
    const commonDirectory = `${cwd}/.git`;
    await mkdir(linkedGitDirectory);
    const detached = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([
        result(`${cwd}\n${linkedGitDirectory}\n${commonDirectory}\n`),
        result("", 1),
        result(`${commit}\n`),
      ]),
    });
    expect(detached).toMatchObject({
      headState: "detached",
      branch: null,
      headCommit: commit,
      worktreeKind: "linked",
    });

    const unborn = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([
        result(`${cwd}\n${commonDirectory}\n${commonDirectory}\n`),
        result("main\n"),
        result("", 128),
      ]),
    });
    expect(unborn).toMatchObject({
      headState: "unborn",
      branch: "main",
      headCommit: null,
    });
  });

  it("keeps an ordinary folder distinct from Git inspection failure", async () => {
    const cwd = await fixtureRoot({ includeGitDirectory: false });
    const notRepository = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([
        result("", 128, "fatal: not a git repository (or any parent)"),
      ]),
    });
    expect(notRepository).toMatchObject({
      status: "not_repository",
      root: null,
      error: null,
    });

    const unavailable = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: () => Promise.reject(new GitCommandFailure("git_unavailable")),
    });
    expect(unavailable).toMatchObject({
      status: "error",
      root: null,
      error: { code: "git_unavailable" },
    });
  });

  it("bounds malformed identity, branch, commit, and command failure", async () => {
    const cwd = await fixtureRoot();
    const gitDirectory = `${cwd}/.git`;
    const malformedIdentity = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([result(`${cwd}\n${gitDirectory}\n`)]),
    });
    expect(malformedIdentity.error?.code).toBe("invalid_output");

    const malformedCommit = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([
        result(`${cwd}\n${gitDirectory}\n${gitDirectory}\n`),
        result("main\n"),
        result("not-a-commit\n"),
      ]),
    });
    expect(malformedCommit).toMatchObject({
      status: "error",
      root: cwd,
      error: { code: "invalid_output" },
    });

    const timedOut = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: () => Promise.reject(new GitCommandFailure("timeout")),
    });
    expect(timedOut.error).toEqual({
      code: "timeout",
      message: "Git inspection timed out.",
    });
    expect(FIXED_GIT_TIMEOUT_MILLISECONDS).toBeLessThanOrEqual(750);
    expect(FIXED_GIT_MAX_OUTPUT_BYTES).toBeLessThanOrEqual(32 * 1024);
  });

  it("rejects a reported root that does not contain the session cwd", async () => {
    const cwd = await fixtureRoot({ includeGitDirectory: false });
    const temporaryRoot = await fixtureRoot();
    const context = await inspectRepositoryContext(cwd, {
      observedAt,
      runGit: runner([
        result(
          `${temporaryRoot}\n${temporaryRoot}/.git\n${temporaryRoot}/.git\n`,
        ),
      ]),
    });
    expect(context).toMatchObject({
      status: "error",
      root: null,
      error: { code: "invalid_output" },
    });
  });

  async function fixtureRoot(
    options: { includeGitDirectory?: boolean } = {},
  ): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "pacium-repository-context-"));
    temporaryDirectories.push(root);
    if (options.includeGitDirectory !== false) {
      await mkdir(join(root, ".git"));
    }
    return realpath(root);
  }
});
