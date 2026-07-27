import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  MAX_GIT_DIFF_BYTES,
  RepositoryRelativePathSchema,
  type GitChangedFile,
  type GitChangesObservation,
  type GitDiffObservation,
  type RepositoryObservation,
} from "@pacium/contracts";

import {
  InvalidDiffOutput,
  normalizeDiffSections,
  type RawDiffSection,
} from "./git-diff-model.js";
import { inspectGitChanges, type GitChangesInspector } from "./git-changes.js";
import {
  createGitCommandRunner,
  GitCommandFailure,
  type GitCommandResult,
  type GitCommandRunner,
} from "./repository-context.js";

const GIT_DIFF_TIMEOUT_MILLISECONDS = 1_500;
const DIFF_FLAGS = [
  "--no-ext-diff",
  "--no-textconv",
  "--no-color",
  "--unified=3",
] as const;
const TRACKED_DETECTION_FLAGS = ["--find-renames", "--find-copies"] as const;

type UntrackedPathState = "safe" | "missing" | "unsafe";

export type GitDiffInspector = (
  repository: RepositoryObservation,
  path: string,
  observedAt?: string,
) => Promise<GitDiffObservation>;

export async function inspectGitDiff(
  repository: RepositoryObservation,
  path: string,
  options: {
    inspectChanges?: GitChangesInspector;
    observedAt?: string;
    runGit?: GitCommandRunner;
    validateUntrackedPath?: (
      root: string,
      path: string,
    ) => Promise<UntrackedPathState>;
  } = {},
): Promise<GitDiffObservation> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  if (!RepositoryRelativePathSchema.safeParse(path).success) {
    return errorObservation(
      repository.root,
      repository.headCommit,
      path,
      null,
      observedAt,
      "unsafe_path",
    );
  }
  if (repository.status === "not_repository") {
    return unavailableObservation(
      "not_repository",
      null,
      null,
      path,
      null,
      observedAt,
    );
  }
  if (repository.status !== "ready" || repository.root === null) {
    return errorObservation(
      repository.root,
      null,
      path,
      null,
      observedAt,
      "repository_unavailable",
    );
  }

  const inspectChanges =
    options.inspectChanges ??
    ((candidate, time) =>
      time === undefined
        ? inspectGitChanges(candidate)
        : inspectGitChanges(candidate, { observedAt: time }));
  const changes = await inspectChanges(repository, observedAt);
  if (changes.status !== "ready" || changes.root === null) {
    if (changes.status === "not_repository") {
      return unavailableObservation(
        "not_repository",
        null,
        null,
        path,
        null,
        changes.observedAt,
      );
    }
    return errorObservation(
      changes.root,
      null,
      path,
      null,
      changes.observedAt,
      changes.error?.code ?? "repository_unavailable",
    );
  }

  const readyChanges: GitChangesObservation & { root: string } = {
    ...changes,
    root: changes.root,
  };
  const file = readyChanges.files.find((candidate) => candidate.path === path);
  if (file === undefined) {
    return unavailableObservation(
      "not_found",
      readyChanges.root,
      readyChanges.headCommit,
      path,
      null,
      readyChanges.observedAt,
    );
  }
  if (file.binary) {
    return unavailableForFile("binary", readyChanges, file);
  }
  if (file.large) {
    return unavailableForFile("too_large", readyChanges, file);
  }
  if (file.untracked) {
    const validate = options.validateUntrackedPath ?? validateUntrackedFile;
    const pathState = await validate(readyChanges.root, file.path);
    if (pathState === "missing") {
      return unavailableForFile("not_found", readyChanges, file);
    }
    if (pathState === "unsafe") {
      return errorObservation(
        readyChanges.root,
        readyChanges.headCommit,
        file.path,
        file.previousPath,
        readyChanges.observedAt,
        "unsafe_path",
      );
    }
  }

  const runGit =
    options.runGit ??
    createGitCommandRunner({
      maxOutputBytes: MAX_GIT_DIFF_BYTES,
      timeoutMilliseconds: GIT_DIFF_TIMEOUT_MILLISECONDS,
    });
  let rawSections: RawDiffSection[];
  try {
    rawSections = await readDiffSections(runGit, readyChanges, file);
  } catch (error) {
    if (error instanceof GitCommandFailure && error.code === "invalid_output") {
      return unavailableForFile("too_large", readyChanges, file);
    }
    return errorObservation(
      readyChanges.root,
      readyChanges.headCommit,
      file.path,
      file.previousPath,
      readyChanges.observedAt,
      failureCode(error),
    );
  }

  try {
    const normalized = normalizeDiffSections(rawSections);
    return {
      ...normalized,
      root: readyChanges.root,
      headCommit: readyChanges.headCommit,
      path: file.path,
      previousPath: file.previousPath,
      observedAt: readyChanges.observedAt,
      error: null,
    };
  } catch (error) {
    return errorObservation(
      readyChanges.root,
      readyChanges.headCommit,
      file.path,
      file.previousPath,
      readyChanges.observedAt,
      error instanceof InvalidDiffOutput
        ? "invalid_output"
        : "inspection_failed",
    );
  }
}

export const FIXED_GIT_DIFF_TIMEOUT_MILLISECONDS =
  GIT_DIFF_TIMEOUT_MILLISECONDS;

async function readDiffSections(
  runGit: GitCommandRunner,
  changes: GitChangesObservation & { root: string },
  file: GitChangedFile,
): Promise<RawDiffSection[]> {
  const prefix = [
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-C",
    changes.root,
  ] as const;
  if (file.untracked) {
    const result = await runGit(changes.root, [
      ...prefix,
      "diff",
      "--no-index",
      ...DIFF_FLAGS,
      "--",
      "/dev/null",
      `./${file.path}`,
    ]);
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new DiffReadFailure();
    }
    return [{ source: "untracked", patch: result.stdout }];
  }

  const pathspecs = [file.previousPath, file.path].flatMap((candidate) =>
    candidate === null ? [] : [`:(literal)${candidate}`],
  );
  if (changes.headCommit !== null) {
    const result = await runGit(changes.root, [
      ...prefix,
      "diff",
      ...DIFF_FLAGS,
      ...TRACKED_DETECTION_FLAGS,
      changes.headCommit,
      "--",
      ...pathspecs,
    ]);
    requireSuccessfulDiff(result);
    return [{ source: "combined", patch: result.stdout }];
  }

  const reads: Promise<RawDiffSection>[] = [];
  if (file.staged || file.conflicted) {
    reads.push(
      runGit(changes.root, [
        ...prefix,
        "diff",
        "--cached",
        ...DIFF_FLAGS,
        ...TRACKED_DETECTION_FLAGS,
        "--",
        ...pathspecs,
      ]).then((result) => {
        requireSuccessfulDiff(result);
        return { source: "staged", patch: result.stdout };
      }),
    );
  }
  if (file.unstaged || file.conflicted) {
    reads.push(
      runGit(changes.root, [
        ...prefix,
        "diff",
        ...DIFF_FLAGS,
        ...TRACKED_DETECTION_FLAGS,
        "--",
        ...pathspecs,
      ]).then((result) => {
        requireSuccessfulDiff(result);
        return { source: "unstaged", patch: result.stdout };
      }),
    );
  }
  return Promise.all(reads);
}

async function validateUntrackedFile(
  root: string,
  path: string,
): Promise<UntrackedPathState> {
  const target = resolve(root, path);
  if (isAbsolute(path) || !containsPath(root, target)) {
    return "unsafe";
  }
  try {
    const canonicalRoot = await realpath(root);
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      return "unsafe";
    }
    const canonical = await realpath(target);
    return containsPath(canonicalRoot, canonical) ? "safe" : "unsafe";
  } catch (error) {
    return isMissingFile(error) ? "missing" : "unsafe";
  }
}

function containsPath(root: string, target: string): boolean {
  const child = relative(root, target);
  return (
    child === "" ||
    (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

function requireSuccessfulDiff(result: GitCommandResult): void {
  if (result.exitCode !== 0) {
    throw new DiffReadFailure();
  }
}

class DiffReadFailure extends Error {}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function unavailableForFile(
  status: "binary" | "too_large" | "not_found",
  changes: GitChangesObservation & { root: string },
  file: GitChangedFile,
): GitDiffObservation {
  return unavailableObservation(
    status,
    changes.root,
    changes.headCommit,
    file.path,
    file.previousPath,
    changes.observedAt,
  );
}

function unavailableObservation(
  status: "empty" | "binary" | "too_large" | "not_found" | "not_repository",
  root: string | null,
  headCommit: string | null,
  path: string,
  previousPath: string | null,
  observedAt: string,
): GitDiffObservation {
  return {
    status,
    root,
    headCommit,
    path,
    previousPath,
    observedAt,
    sections: [],
    patchBytes: 0,
    patchLines: 0,
    error: null,
  };
}

function errorObservation(
  root: string | null,
  headCommit: string | null,
  path: string,
  previousPath: string | null,
  observedAt: string,
  code: NonNullable<GitDiffObservation["error"]>["code"],
): GitDiffObservation {
  return {
    status: "error",
    root,
    headCommit: root === null ? null : headCommit,
    path,
    previousPath: root === null ? null : previousPath,
    observedAt,
    sections: [],
    patchBytes: 0,
    patchLines: 0,
    error: {
      code,
      message: errorMessage(code),
    },
  };
}

function failureCode(
  error: unknown,
): NonNullable<GitDiffObservation["error"]>["code"] {
  return error instanceof GitCommandFailure ? error.code : "inspection_failed";
}

function errorMessage(
  code: NonNullable<GitDiffObservation["error"]>["code"],
): string {
  switch (code) {
    case "git_unavailable":
      return "Git is unavailable on the Pacium host.";
    case "timeout":
      return "Git diff inspection timed out.";
    case "inspection_failed":
      return "Git could not read this file diff.";
    case "invalid_output":
      return "Git returned invalid diff evidence.";
    case "repository_unavailable":
      return "Repository evidence is unavailable; refresh Overview first.";
    case "unsafe_path":
      return "The selected path is unsafe to inspect.";
  }
}
