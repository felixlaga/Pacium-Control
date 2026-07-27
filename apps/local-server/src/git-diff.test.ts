import type {
  GitChangedFile,
  GitChangesObservation,
  RepositoryObservation,
} from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  FIXED_GIT_DIFF_TIMEOUT_MILLISECONDS,
  inspectGitDiff,
} from "./git-diff.js";
import {
  GitCommandFailure,
  type GitCommandResult,
  type GitCommandRunner,
} from "./repository-context.js";

const observedAt = "2026-07-27T10:00:00.000Z";
const headCommit = "a".repeat(40);
const repository: RepositoryObservation = {
  status: "ready",
  root: "/work/pacium",
  name: "pacium",
  branch: "dev",
  headCommit,
  headState: "branch",
  worktreeKind: "main",
  observedAt,
  error: null,
};
const file: GitChangedFile = {
  path: "src/new.ts",
  previousPath: "src/old.ts",
  kind: "renamed",
  staged: true,
  unstaged: true,
  untracked: false,
  conflicted: false,
  additions: 2,
  deletions: 1,
  binary: false,
  large: false,
  sizeBytes: 100,
};

function changes(
  candidate: GitChangedFile = file,
  head: string | null = headCommit,
): GitChangesObservation {
  return {
    status: "ready",
    root: repository.root,
    headCommit: head,
    observedAt,
    files: [candidate],
    totals: {
      fileCount: 1,
      additions: candidate.additions ?? 0,
      deletions: candidate.deletions ?? 0,
      unavailableLineCount: candidate.additions === null ? 1 : 0,
      conflictCount: candidate.conflicted ? 1 : 0,
    },
    truncated: false,
    error: null,
  };
}

function result(stdout: string, exitCode = 0): GitCommandResult {
  return { exitCode, stdout, stderr: "" };
}

describe("bounded Git diff inspection", () => {
  it("revalidates membership and reads one tracked literal path with fixed arguments", async () => {
    const inspectChanges = vi.fn(() => Promise.resolve(changes()));
    const runGit = vi.fn<GitCommandRunner>(() =>
      Promise.resolve(
        result(
          "diff --git a/src/old.ts b/src/new.ts\n@@ -1 +1 @@\n-old\n+new\n",
        ),
      ),
    );

    const observation = await inspectGitDiff(repository, file.path, {
      inspectChanges,
      observedAt,
      runGit,
    });

    expect(observation).toMatchObject({
      status: "ready",
      path: file.path,
      previousPath: file.previousPath,
      headCommit,
      sections: [{ source: "combined" }],
    });
    expect(inspectChanges).toHaveBeenCalledWith(repository, observedAt);
    expect(runGit).toHaveBeenCalledWith(
      repository.root,
      expect.arrayContaining([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "--unified=3",
        headCommit,
        "--",
        `:(literal)${file.previousPath}`,
        `:(literal)${file.path}`,
      ]),
    );
    expect(FIXED_GIT_DIFF_TIMEOUT_MILLISECONDS).toBeLessThanOrEqual(1_500);
  });

  it("uses a fixed no-index comparison only for a contained untracked regular file", async () => {
    const untracked: GitChangedFile = {
      ...file,
      path: "-untracked.ts",
      previousPath: null,
      kind: "untracked",
      staged: false,
      unstaged: false,
      untracked: true,
    };
    const runGit = vi.fn<GitCommandRunner>(() =>
      Promise.resolve(
        result(
          "diff --git a/-untracked.ts b/-untracked.ts\n--- /dev/null\n+++ b/-untracked.ts\n@@ -0,0 +1 @@\n+new\n",
          1,
        ),
      ),
    );

    const observation = await inspectGitDiff(repository, untracked.path, {
      inspectChanges: () => Promise.resolve(changes(untracked)),
      runGit,
      validateUntrackedPath: () => Promise.resolve("safe"),
    });

    expect(observation).toMatchObject({
      status: "ready",
      sections: [{ source: "untracked" }],
    });
    expect(runGit).toHaveBeenCalledWith(
      repository.root,
      expect.arrayContaining([
        "--no-index",
        "--",
        "/dev/null",
        "./-untracked.ts",
      ]),
    );
  });

  it("uses separate staged and unstaged sections before the first commit", async () => {
    const runGit = vi
      .fn<GitCommandRunner>()
      .mockResolvedValueOnce(result("staged patch\n"))
      .mockResolvedValueOnce(result("unstaged patch\n"));

    const observation = await inspectGitDiff(repository, file.path, {
      inspectChanges: () => Promise.resolve(changes(file, null)),
      runGit,
    });

    expect(observation).toMatchObject({
      status: "ready",
      headCommit: null,
      sections: [{ source: "staged" }, { source: "unstaged" }],
    });
    expect(runGit.mock.calls[0]?.[1]).toContain("--cached");
    expect(runGit.mock.calls[1]?.[1]).not.toContain("--cached");
  });

  it("refuses stale, binary, large, missing, and unsafe selectors before Git", async () => {
    const runGit = vi.fn<GitCommandRunner>();
    const inspectChanges = vi.fn(() => Promise.resolve(changes()));
    await expect(
      inspectGitDiff(repository, "missing.ts", { inspectChanges, runGit }),
    ).resolves.toMatchObject({ status: "not_found" });
    await expect(
      inspectGitDiff(repository, "../../escape", { inspectChanges, runGit }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_path" },
    });
    await expect(
      inspectGitDiff(repository, file.path, {
        inspectChanges: () =>
          Promise.resolve(changes({ ...file, binary: true })),
        runGit,
      }),
    ).resolves.toMatchObject({ status: "binary" });
    await expect(
      inspectGitDiff(repository, file.path, {
        inspectChanges: () =>
          Promise.resolve(changes({ ...file, large: true })),
        runGit,
      }),
    ).resolves.toMatchObject({ status: "too_large" });

    const untracked = {
      ...file,
      path: "link.ts",
      previousPath: null,
      kind: "untracked" as const,
      staged: false,
      unstaged: false,
      untracked: true,
    };
    await expect(
      inspectGitDiff(repository, untracked.path, {
        inspectChanges: () => Promise.resolve(changes(untracked)),
        runGit,
        validateUntrackedPath: () => Promise.resolve("unsafe"),
      }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "unsafe_path" },
    });
    expect(runGit).not.toHaveBeenCalled();
  });

  it("contains Git, repository, and excessive-output failures without patch leakage", async () => {
    await expect(
      inspectGitDiff(repository, file.path, {
        inspectChanges: () => Promise.resolve(changes()),
        runGit: () => Promise.reject(new GitCommandFailure("timeout")),
      }),
    ).resolves.toMatchObject({
      status: "error",
      sections: [],
      error: { code: "timeout" },
    });
    await expect(
      inspectGitDiff(repository, file.path, {
        inspectChanges: () => Promise.resolve(changes()),
        runGit: () => Promise.reject(new GitCommandFailure("invalid_output")),
      }),
    ).resolves.toMatchObject({
      status: "too_large",
      sections: [],
      error: null,
    });
    await expect(
      inspectGitDiff(
        {
          ...repository,
          status: "error",
          headCommit: null,
          headState: "unknown",
        },
        file.path,
      ),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "repository_unavailable" },
    });
    await expect(
      inspectGitDiff(
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
        file.path,
      ),
    ).resolves.toMatchObject({ status: "not_repository" });
  });
});
