import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

import type {
  RepositoryErrorCodeSchema,
  RepositoryObservation,
} from "@pacium/contracts";
import type { z } from "zod";

const GIT_TIMEOUT_MILLISECONDS = 750;
const GIT_MAX_OUTPUT_BYTES = 32 * 1024;

type RepositoryErrorCode = z.infer<typeof RepositoryErrorCodeSchema>;

export interface GitCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type GitCommandRunner = (
  cwd: string,
  args: readonly string[],
) => Promise<GitCommandResult>;

export type RepositoryInspector = (
  canonicalCwd: string,
  observedAt?: string,
) => Promise<RepositoryObservation>;

export class GitCommandFailure extends Error {
  public constructor(
    public readonly code: Extract<
      RepositoryErrorCode,
      "git_unavailable" | "timeout" | "invalid_output"
    >,
  ) {
    super(code);
  }
}

export interface RepositoryContext {
  root: string;
  name: string;
}

export async function discoverRepositoryContext(
  canonicalCwd: string,
): Promise<RepositoryContext | null> {
  let candidate = canonicalCwd;
  while (true) {
    try {
      await lstat(join(candidate, ".git"));
      return {
        root: candidate,
        name: basename(candidate) || candidate,
      };
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) {
        return null;
      }
      candidate = parent;
    }
  }
}

export async function inspectRepositoryContext(
  canonicalCwd: string,
  options: {
    observedAt?: string;
    runGit?: GitCommandRunner;
  } = {},
): Promise<RepositoryObservation> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  const runGit = options.runGit ?? runGitCommand;

  let identity: GitCommandResult;
  try {
    identity = await runGit(canonicalCwd, [
      "-c",
      "core.fsmonitor=false",
      "-C",
      canonicalCwd,
      "rev-parse",
      "--path-format=absolute",
      "--show-toplevel",
      "--absolute-git-dir",
      "--git-common-dir",
    ]);
  } catch (error) {
    return errorObservation(
      observedAt,
      null,
      null,
      "unknown",
      failureCode(error),
    );
  }

  if (identity.exitCode !== 0) {
    if (identity.stderr.toLocaleLowerCase().includes("not a git repository")) {
      return notRepositoryObservation(observedAt);
    }
    return errorObservation(
      observedAt,
      null,
      null,
      "unknown",
      "inspection_failed",
    );
  }

  const identityLines = boundedLines(identity.stdout, 3);
  if (identityLines === null) {
    return errorObservation(
      observedAt,
      null,
      null,
      "unknown",
      "invalid_output",
    );
  }

  let root: string;
  let gitDirectory: string;
  let commonDirectory: string;
  try {
    const canonicalIdentity = await Promise.all(
      identityLines.map((path) => canonicalGitPath(path)),
    );
    root = canonicalIdentity[0]!;
    gitDirectory = canonicalIdentity[1]!;
    commonDirectory = canonicalIdentity[2]!;
  } catch {
    return errorObservation(
      observedAt,
      null,
      null,
      "unknown",
      "invalid_output",
    );
  }

  if (!containsPath(root, canonicalCwd)) {
    return errorObservation(
      observedAt,
      null,
      null,
      "unknown",
      "invalid_output",
    );
  }

  const name = basename(root) || root;
  const worktreeKind = gitDirectory === commonDirectory ? "main" : "linked";

  let branchResult: GitCommandResult;
  let headResult: GitCommandResult;
  try {
    [branchResult, headResult] = await Promise.all([
      runGit(root, [
        "-c",
        "core.fsmonitor=false",
        "-C",
        root,
        "symbolic-ref",
        "--quiet",
        "--short",
        "HEAD",
      ]),
      runGit(root, [
        "-c",
        "core.fsmonitor=false",
        "-C",
        root,
        "rev-parse",
        "--verify",
        "HEAD",
      ]),
    ]);
  } catch (error) {
    return errorObservation(
      observedAt,
      root,
      name,
      worktreeKind,
      failureCode(error),
    );
  }

  const branch =
    branchResult.exitCode === 0
      ? boundedSingleLine(branchResult.stdout, 512)
      : null;
  const headCommit =
    headResult.exitCode === 0 ? boundedSingleLine(headResult.stdout, 64) : null;
  if (
    (branchResult.exitCode === 0 && branch === null) ||
    (headResult.exitCode === 0 &&
      (headCommit === null || !/^[0-9a-f]{40,64}$/.test(headCommit)))
  ) {
    return errorObservation(
      observedAt,
      root,
      name,
      worktreeKind,
      "invalid_output",
    );
  }

  if (branch !== null && headCommit !== null) {
    return readyObservation(
      observedAt,
      root,
      name,
      branch,
      headCommit,
      "branch",
      worktreeKind,
    );
  }
  if (branch === null && headCommit !== null && branchResult.exitCode === 1) {
    return readyObservation(
      observedAt,
      root,
      name,
      null,
      headCommit,
      "detached",
      worktreeKind,
    );
  }
  if (branch !== null && headCommit === null && headResult.exitCode !== 0) {
    return readyObservation(
      observedAt,
      root,
      name,
      branch,
      null,
      "unborn",
      worktreeKind,
    );
  }
  return errorObservation(
    observedAt,
    root,
    name,
    worktreeKind,
    "inspection_failed",
  );
}

export const FIXED_GIT_TIMEOUT_MILLISECONDS = GIT_TIMEOUT_MILLISECONDS;
export const FIXED_GIT_MAX_OUTPUT_BYTES = GIT_MAX_OUTPUT_BYTES;

function runGitCommand(
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...args],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
        },
        maxBuffer: GIT_MAX_OUTPUT_BYTES,
        timeout: GIT_TIMEOUT_MILLISECONDS,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stdout, stderr });
          return;
        }
        if ("code" in error && error.code === "ENOENT") {
          reject(new GitCommandFailure("git_unavailable"));
          return;
        }
        if (error.killed || error.signal !== null) {
          reject(new GitCommandFailure("timeout"));
          return;
        }
        if (
          "code" in error &&
          error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
        ) {
          reject(new GitCommandFailure("invalid_output"));
          return;
        }
        resolve({
          exitCode: typeof error.code === "number" ? error.code : 1,
          stdout,
          stderr,
        });
      },
    );
  });
}

async function canonicalGitPath(path: string): Promise<string> {
  if (!isAbsolute(path) || path.length > 4096) {
    throw new Error("Git returned a non-canonical path.");
  }
  return realpath(path);
}

function containsPath(root: string, path: string): boolean {
  const child = relative(root, path);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function boundedLines(value: string, count: number): string[] | null {
  const lines = value.trimEnd().split(/\r?\n/);
  if (
    lines.length !== count ||
    lines.some((line) => line.length === 0 || line.length > 4096)
  ) {
    return null;
  }
  return lines;
}

function boundedSingleLine(value: string, maximum: number): string | null {
  const line = value.trimEnd();
  return line.length > 0 &&
    line.length <= maximum &&
    !line.includes("\n") &&
    !line.includes("\r")
    ? line
    : null;
}

function readyObservation(
  observedAt: string,
  root: string,
  name: string,
  branch: string | null,
  headCommit: string | null,
  headState: "branch" | "detached" | "unborn",
  worktreeKind: "main" | "linked",
): RepositoryObservation {
  return {
    status: "ready",
    root,
    name,
    branch,
    headCommit,
    headState,
    worktreeKind,
    observedAt,
    error: null,
  };
}

function notRepositoryObservation(observedAt: string): RepositoryObservation {
  return {
    status: "not_repository",
    root: null,
    name: null,
    branch: null,
    headCommit: null,
    headState: "unknown",
    worktreeKind: "unknown",
    observedAt,
    error: null,
  };
}

function errorObservation(
  observedAt: string,
  root: string | null,
  name: string | null,
  worktreeKind: "main" | "linked" | "unknown",
  code: RepositoryErrorCode,
): RepositoryObservation {
  return {
    status: "error",
    root,
    name,
    branch: null,
    headCommit: null,
    headState: "unknown",
    worktreeKind,
    observedAt,
    error: {
      code,
      message: errorMessage(code),
    },
  };
}

function failureCode(error: unknown): RepositoryErrorCode {
  return error instanceof GitCommandFailure ? error.code : "inspection_failed";
}

function errorMessage(code: RepositoryErrorCode): string {
  switch (code) {
    case "git_unavailable":
      return "Git is unavailable on the Pacium host.";
    case "timeout":
      return "Git inspection timed out.";
    case "invalid_output":
      return "Git returned invalid or excessive repository evidence.";
    case "inspection_failed":
      return "Git could not inspect this working directory.";
  }
}
