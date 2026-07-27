import type { RepositoryObservation } from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  FIXED_GIT_HISTORY_MAX_OUTPUT_BYTES,
  FIXED_GIT_HISTORY_TIMEOUT_MILLISECONDS,
  inspectGitHistory,
} from "./git-history.js";
import {
  GitCommandFailure,
  type GitCommandRunner,
} from "./repository-context.js";

const observedAt = "2026-07-27T11:00:00.000Z";
const root = "/work/pacium";
const oldHead = "1".repeat(40);
const currentHead = "a".repeat(40);
const repository: RepositoryObservation = {
  status: "ready",
  root,
  name: "pacium",
  branch: "dev",
  headCommit: oldHead,
  headState: "branch",
  worktreeKind: "main",
  observedAt: "2026-07-27T10:00:00.000Z",
  error: null,
};

describe("fixed Git history inspection", () => {
  it("uses only the session-owned root and fixed local HEAD arguments", async () => {
    const runGit = vi.fn<GitCommandRunner>().mockResolvedValue({
      exitCode: 0,
      stdout: historyRecord(currentHead),
      stderr: "",
    });
    const result = await inspectGitHistory(repository, { observedAt, runGit });

    expect(runGit).toHaveBeenCalledWith(root, [
      "-c",
      "core.fsmonitor=false",
      "-C",
      root,
      "--no-pager",
      "log",
      "--no-show-signature",
      "--date-order",
      "--max-count=51",
      "-z",
      "--format=%H%x00%P%x00%an%x00%aI%x00%s",
      "HEAD",
    ]);
    expect(result).toMatchObject({
      status: "ready",
      root,
      headCommit: currentHead,
      observedAt,
      truncated: false,
      error: null,
    });
    expect(result.commits).toHaveLength(1);
  });

  it("does not invoke Git for absent or degraded repository evidence", async () => {
    const runGit = vi.fn<GitCommandRunner>();
    expect(
      await inspectGitHistory(
        {
          ...repository,
          status: "not_repository",
          root: null,
          name: null,
          branch: null,
          headCommit: null,
          headState: "unknown",
          worktreeKind: "unknown",
        },
        { observedAt, runGit },
      ),
    ).toMatchObject({ status: "not_repository", root: null });
    expect(
      await inspectGitHistory(
        {
          ...repository,
          status: "error",
          branch: null,
          headCommit: null,
          headState: "unknown",
          error: {
            code: "timeout",
            message: "Git inspection timed out.",
          },
        },
        { observedAt, runGit },
      ),
    ).toMatchObject({
      status: "error",
      error: { code: "repository_unavailable" },
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it("reports an unborn repository honestly and detects a newly created HEAD", async () => {
    const unborn = {
      ...repository,
      headCommit: null,
      headState: "unborn" as const,
    };
    expect(
      await inspectGitHistory(unborn, {
        observedAt,
        runGit: vi.fn<GitCommandRunner>().mockResolvedValue({
          exitCode: 128,
          stdout: "",
          stderr: "not used in operator copy",
        }),
      }),
    ).toMatchObject({
      status: "empty",
      root,
      headCommit: null,
      commits: [],
      error: null,
    });

    expect(
      await inspectGitHistory(unborn, {
        observedAt,
        runGit: vi.fn<GitCommandRunner>().mockResolvedValue({
          exitCode: 0,
          stdout: historyRecord(currentHead),
          stderr: "",
        }),
      }),
    ).toMatchObject({
      status: "ready",
      headCommit: currentHead,
    });
  });

  it("maps process and malformed-output failures to stable bounded errors", async () => {
    const cases: Array<{
      runGit: GitCommandRunner;
      code: string;
    }> = [
      {
        runGit: vi
          .fn<GitCommandRunner>()
          .mockRejectedValue(new GitCommandFailure("git_unavailable")),
        code: "git_unavailable",
      },
      {
        runGit: vi
          .fn<GitCommandRunner>()
          .mockRejectedValue(new GitCommandFailure("timeout")),
        code: "timeout",
      },
      {
        runGit: vi.fn<GitCommandRunner>().mockResolvedValue({
          exitCode: 2,
          stdout: "",
          stderr: "secret path",
        }),
        code: "inspection_failed",
      },
      {
        runGit: vi.fn<GitCommandRunner>().mockResolvedValue({
          exitCode: 0,
          stdout: "not framed",
          stderr: "",
        }),
        code: "invalid_output",
      },
      {
        runGit: vi.fn<GitCommandRunner>().mockResolvedValue({
          exitCode: 0,
          stdout: "",
          stderr: "",
        }),
        code: "invalid_output",
      },
    ];
    for (const testCase of cases) {
      const result = await inspectGitHistory(repository, {
        observedAt,
        runGit: testCase.runGit,
      });
      expect(result).toMatchObject({
        status: "error",
        root,
        headCommit: oldHead,
        commits: [],
        truncated: false,
        error: { code: testCase.code },
      });
      expect(result.error?.message).not.toContain("secret");
    }
  });

  it("exports the fixed process limits", () => {
    expect(FIXED_GIT_HISTORY_TIMEOUT_MILLISECONDS).toBe(1_500);
    expect(FIXED_GIT_HISTORY_MAX_OUTPUT_BYTES).toBe(256 * 1024);
  });
});

function historyRecord(id: string): string {
  return [
    id,
    oldHead,
    "Pacium Agent",
    "2026-07-27T11:00:00+02:00",
    "Inspect recent work",
    "",
  ].join("\0");
}
