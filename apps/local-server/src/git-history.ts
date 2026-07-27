import {
  MAX_GIT_HISTORY_COMMITS,
  type GitHistoryObservation,
  type RepositoryObservation,
} from "@pacium/contracts";

import {
  InvalidHistoryOutput,
  normalizeGitHistoryOutput,
} from "./git-history-model.js";
import {
  createGitCommandRunner,
  GitCommandFailure,
  type GitCommandRunner,
} from "./repository-context.js";

const GIT_HISTORY_TIMEOUT_MILLISECONDS = 1_500;
const GIT_HISTORY_MAX_OUTPUT_BYTES = 256 * 1024;
const HISTORY_FORMAT = "%H%x00%P%x00%an%x00%aI%x00%s";

export type GitHistoryInspector = (
  repository: RepositoryObservation,
  observedAt?: string,
) => Promise<GitHistoryObservation>;

export async function inspectGitHistory(
  repository: RepositoryObservation,
  options: {
    observedAt?: string;
    runGit?: GitCommandRunner;
  } = {},
): Promise<GitHistoryObservation> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  if (repository.status === "not_repository") {
    return unavailableObservation("not_repository", null, null, observedAt);
  }
  if (repository.status !== "ready" || repository.root === null) {
    return errorObservation(
      repository.root,
      repository.headCommit,
      observedAt,
      "repository_unavailable",
    );
  }

  const runGit =
    options.runGit ??
    createGitCommandRunner({
      maxOutputBytes: GIT_HISTORY_MAX_OUTPUT_BYTES,
      timeoutMilliseconds: GIT_HISTORY_TIMEOUT_MILLISECONDS,
    });
  let result;
  try {
    result = await runGit(repository.root, [
      "-c",
      "core.fsmonitor=false",
      "-C",
      repository.root,
      "--no-pager",
      "log",
      "--no-show-signature",
      "--date-order",
      `--max-count=${MAX_GIT_HISTORY_COMMITS + 1}`,
      "-z",
      `--format=${HISTORY_FORMAT}`,
      "HEAD",
    ]);
  } catch (error) {
    return errorObservation(
      repository.root,
      repository.headCommit,
      observedAt,
      failureCode(error),
    );
  }

  if (result.exitCode !== 0) {
    return repository.headCommit === null
      ? unavailableObservation("empty", repository.root, null, observedAt)
      : errorObservation(
          repository.root,
          repository.headCommit,
          observedAt,
          "inspection_failed",
        );
  }

  try {
    const normalized = normalizeGitHistoryOutput(result.stdout);
    const headCommit = normalized.commits[0]?.id;
    if (headCommit === undefined) {
      throw new InvalidHistoryOutput("HEAD produced no commit evidence.");
    }
    return {
      status: "ready",
      root: repository.root,
      headCommit,
      observedAt,
      commits: normalized.commits,
      truncated: normalized.truncated,
      error: null,
    };
  } catch (error) {
    return errorObservation(
      repository.root,
      repository.headCommit,
      observedAt,
      error instanceof InvalidHistoryOutput
        ? "invalid_output"
        : "inspection_failed",
    );
  }
}

export const FIXED_GIT_HISTORY_TIMEOUT_MILLISECONDS =
  GIT_HISTORY_TIMEOUT_MILLISECONDS;
export const FIXED_GIT_HISTORY_MAX_OUTPUT_BYTES = GIT_HISTORY_MAX_OUTPUT_BYTES;

function unavailableObservation(
  status: "empty" | "not_repository",
  root: string | null,
  headCommit: string | null,
  observedAt: string,
): GitHistoryObservation {
  return {
    status,
    root,
    headCommit,
    observedAt,
    commits: [],
    truncated: false,
    error: null,
  };
}

function errorObservation(
  root: string | null,
  headCommit: string | null,
  observedAt: string,
  code: NonNullable<GitHistoryObservation["error"]>["code"],
): GitHistoryObservation {
  return {
    status: "error",
    root,
    headCommit,
    observedAt,
    commits: [],
    truncated: false,
    error: {
      code,
      message: errorMessage(code),
    },
  };
}

function failureCode(
  error: unknown,
): NonNullable<GitHistoryObservation["error"]>["code"] {
  return error instanceof GitCommandFailure ? error.code : "inspection_failed";
}

function errorMessage(
  code: NonNullable<GitHistoryObservation["error"]>["code"],
): string {
  switch (code) {
    case "git_unavailable":
      return "Git is unavailable on the Pacium host.";
    case "timeout":
      return "Git history inspection timed out.";
    case "invalid_output":
      return "Git returned invalid or excessive commit history.";
    case "inspection_failed":
      return "Git could not inspect commit history.";
    case "repository_unavailable":
      return "Repository evidence is unavailable for commit history.";
  }
}
