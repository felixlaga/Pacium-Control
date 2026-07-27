import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  GitChangesObservation,
  RepositoryObservation,
} from "@pacium/contracts";

import {
  aggregateChangedFiles,
  MAX_GIT_CHANGES_OUTPUT_BYTES,
  parseNumstat,
  parsePorcelainV2,
  type ParsedNumstat,
} from "./git-changes-model.js";
import {
  createGitCommandRunner,
  GitCommandFailure,
  type GitCommandResult,
  type GitCommandRunner,
} from "./repository-context.js";

const GIT_CHANGES_TIMEOUT_MILLISECONDS = 1_500;

class GitChangesReadFailure extends Error {
  public constructor(public readonly code: "inspection_failed") {
    super(code);
  }
}

export type GitChangesInspector = (
  repository: RepositoryObservation,
  observedAt?: string,
) => Promise<GitChangesObservation>;

export async function inspectGitChanges(
  repository: RepositoryObservation,
  options: {
    observedAt?: string;
    readSize?: (root: string, path: string) => Promise<number | null>;
    runGit?: GitCommandRunner;
  } = {},
): Promise<GitChangesObservation> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  if (repository.status === "not_repository") {
    return unavailableObservation("not_repository", null, observedAt, null);
  }
  if (repository.status !== "ready" || repository.root === null) {
    return unavailableObservation(
      "error",
      repository.root,
      observedAt,
      "repository_unavailable",
    );
  }

  const root = repository.root;
  const runGit =
    options.runGit ??
    createGitCommandRunner({
      maxOutputBytes: MAX_GIT_CHANGES_OUTPUT_BYTES,
      timeoutMilliseconds: GIT_CHANGES_TIMEOUT_MILLISECONDS,
    });
  const fixedPrefix = [
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-C",
    root,
  ] as const;

  let statusResult: GitCommandResult;
  let headResult: GitCommandResult;
  try {
    [statusResult, headResult] = await Promise.all([
      runGit(root, [
        ...fixedPrefix,
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
      ]),
      runGit(root, [...fixedPrefix, "rev-parse", "--verify", "HEAD"]),
    ]);
  } catch (error) {
    return unavailableObservation(
      "error",
      root,
      observedAt,
      failureCode(error),
    );
  }
  if (statusResult.exitCode !== 0) {
    return unavailableObservation(
      "error",
      root,
      observedAt,
      "inspection_failed",
    );
  }

  const headCommit =
    headResult.exitCode === 0 ? parseHead(headResult.stdout) : null;
  if (headResult.exitCode === 0 && headCommit === null) {
    return unavailableObservation("error", root, observedAt, "invalid_output");
  }

  let statusFiles;
  try {
    statusFiles = parsePorcelainV2(statusResult.stdout);
  } catch {
    return unavailableObservation("error", root, observedAt, "invalid_output");
  }

  let numstats: ParsedNumstat[];
  try {
    numstats =
      headCommit === null
        ? await readUnbornNumstat(runGit, root, fixedPrefix)
        : await readHeadNumstat(runGit, root, fixedPrefix, headCommit);
  } catch (error) {
    return unavailableObservation(
      "error",
      root,
      observedAt,
      failureCode(error),
    );
  }

  const withoutSizes = aggregateChangedFiles(statusFiles, numstats, new Map());
  const readSize = options.readSize ?? readPathSize;
  const sizeEntries = await Promise.all(
    withoutSizes.files.map(
      async ({ path }) => [path, await readSize(root, path)] as const,
    ),
  );
  const sizeByPath = new Map(
    sizeEntries.flatMap(([path, size]) =>
      size === null ? [] : [[path, size] as const],
    ),
  );
  const aggregation = aggregateChangedFiles(statusFiles, numstats, sizeByPath);
  return {
    status: "ready",
    root,
    headCommit,
    observedAt,
    ...aggregation,
    error: null,
  };
}

export const FIXED_GIT_CHANGES_TIMEOUT_MILLISECONDS =
  GIT_CHANGES_TIMEOUT_MILLISECONDS;

async function readHeadNumstat(
  runGit: GitCommandRunner,
  root: string,
  prefix: readonly string[],
  headCommit: string,
): Promise<ParsedNumstat[]> {
  const result = await runGit(root, [
    ...prefix,
    "diff",
    "--numstat",
    "-z",
    "--no-renames",
    headCommit,
    "--",
  ]);
  if (result.exitCode !== 0) {
    throw new GitChangesReadFailure("inspection_failed");
  }
  return parseNumstat(result.stdout);
}

async function readUnbornNumstat(
  runGit: GitCommandRunner,
  root: string,
  prefix: readonly string[],
): Promise<ParsedNumstat[]> {
  const [cached, unstaged] = await Promise.all([
    runGit(root, [
      ...prefix,
      "diff",
      "--cached",
      "--numstat",
      "-z",
      "--no-renames",
      "--",
    ]),
    runGit(root, [...prefix, "diff", "--numstat", "-z", "--no-renames", "--"]),
  ]);
  if (cached.exitCode !== 0 || unstaged.exitCode !== 0) {
    throw new GitChangesReadFailure("inspection_failed");
  }
  return mergeNumstats([
    ...parseNumstat(cached.stdout),
    ...parseNumstat(unstaged.stdout),
  ]);
}

function mergeNumstats(entries: readonly ParsedNumstat[]): ParsedNumstat[] {
  const merged = new Map<string, ParsedNumstat>();
  for (const entry of entries) {
    const current = merged.get(entry.path);
    if (current === undefined) {
      merged.set(entry.path, entry);
      continue;
    }
    const binary = current.binary || entry.binary;
    merged.set(entry.path, {
      path: entry.path,
      binary,
      additions:
        binary || current.additions === null || entry.additions === null
          ? null
          : current.additions + entry.additions,
      deletions:
        binary || current.deletions === null || entry.deletions === null
          ? null
          : current.deletions + entry.deletions,
    });
  }
  return [...merged.values()];
}

async function readPathSize(
  root: string,
  path: string,
): Promise<number | null> {
  if (isAbsolute(path)) {
    return null;
  }
  const target = resolve(root, path);
  const child = relative(root, target);
  if (child.startsWith("..") || isAbsolute(child)) {
    return null;
  }
  try {
    return (await lstat(target)).size;
  } catch {
    return null;
  }
}

function parseHead(value: string): string | null {
  const head = value.trimEnd();
  return /^[0-9a-f]{40,64}$/.test(head) ? head : null;
}

function unavailableObservation(
  status: "not_repository" | "error",
  root: string | null,
  observedAt: string,
  code:
    | "git_unavailable"
    | "timeout"
    | "inspection_failed"
    | "invalid_output"
    | "repository_unavailable"
    | null,
): GitChangesObservation {
  return {
    status,
    root,
    headCommit: null,
    observedAt,
    files: [],
    totals: {
      fileCount: 0,
      additions: 0,
      deletions: 0,
      unavailableLineCount: 0,
      conflictCount: 0,
    },
    truncated: false,
    error:
      code === null
        ? null
        : {
            code,
            message: errorMessage(code),
          },
  };
}

function failureCode(
  error: unknown,
): NonNullable<GitChangesObservation["error"]>["code"] {
  return error instanceof GitCommandFailure
    ? error.code
    : error instanceof GitChangesReadFailure
      ? error.code
      : "invalid_output";
}

function errorMessage(
  code: NonNullable<GitChangesObservation["error"]>["code"],
): string {
  switch (code) {
    case "git_unavailable":
      return "Git is unavailable on the Pacium host.";
    case "timeout":
      return "Git changes inspection timed out.";
    case "inspection_failed":
      return "Git could not read changed files.";
    case "invalid_output":
      return "Git returned invalid or excessive changed-file evidence.";
    case "repository_unavailable":
      return "Repository identity is unavailable; refresh Overview first.";
  }
}
