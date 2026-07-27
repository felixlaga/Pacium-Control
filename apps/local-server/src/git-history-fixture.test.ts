import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RepositoryObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { inspectGitHistory } from "./git-history.js";
import {
  runGitFixture,
  runGitOk,
  runGitProcess,
} from "./git-fixture-test-utils.js";

const observedAt = "2026-07-27T11:00:00.000Z";

describe("commit history against real Git fixtures", () => {
  it("matches linear, merge, unusual-text, and detached HEAD evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-git-history-"));
    try {
      await runGitOk(root, ["init", "--initial-branch=main"]);
      await writeFile(join(root, "file.txt"), "base\n");
      await runGitOk(root, ["add", "file.txt"]);
      await commit(root, "Base commit");

      await runGitOk(root, ["switch", "-c", "feature"]);
      await writeFile(join(root, "feature.txt"), "feature\n");
      await runGitOk(root, ["add", "feature.txt"]);
      await commit(root, "Feature\tcommit", "Pacium\tAgent");

      await runGitOk(root, ["switch", "main"]);
      await writeFile(join(root, "main.txt"), "main\n");
      await runGitOk(root, ["add", "main.txt"]);
      await commit(root, "Main commit");
      await runGitOk(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "merge",
        "--no-ff",
        "-m",
        "Merge feature",
        "feature",
      ]);

      const history = await inspect(root);
      const directHead = await runGitProcess(root, ["rev-parse", "HEAD"]);
      expect(history).toMatchObject({
        status: "ready",
        root,
        headCommit: directHead.stdout.trim(),
        truncated: false,
        error: null,
      });
      expect(history.commits[0]).toMatchObject({
        id: directHead.stdout.trim(),
        subject: "Merge feature",
      });
      expect(history.commits[0]?.parents).toHaveLength(2);
      expect(history.commits.map(({ subject }) => subject)).toEqual(
        expect.arrayContaining([
          "Feature commit",
          "Main commit",
          "Base commit",
        ]),
      );
      expect(
        history.commits.find(({ subject }) => subject === "Feature commit"),
      ).toMatchObject({ authorName: "Pacium Agent" });

      await runGitOk(root, ["switch", "--detach", "HEAD~1"]);
      const detachedHead = await runGitProcess(root, ["rev-parse", "HEAD"]);
      const detached = await inspect(root);
      expect(detached).toMatchObject({
        status: "ready",
        headCommit: detachedHead.stdout.trim(),
      });
      expect(detached.commits[0]?.id).toBe(detachedHead.stdout.trim());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks a real 51-record window truncated and handles unborn HEAD", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-git-history-many-"));
    const unbornRoot = await mkdtemp(
      join(tmpdir(), "pacium-git-history-unborn-"),
    );
    try {
      await runGitOk(root, ["init", "--initial-branch=main"]);
      for (let index = 0; index < 51; index += 1) {
        await commit(root, `Commit ${index}`, "Pacium Test", true);
      }
      const history = await inspect(root);
      expect(history.status).toBe("ready");
      expect(history.commits).toHaveLength(50);
      expect(history.truncated).toBe(true);
      expect(history.commits[0]?.subject).toBe("Commit 50");
      expect(history.commits.at(-1)?.subject).toBe("Commit 1");

      await runGitOk(unbornRoot, ["init", "--initial-branch=main"]);
      const unborn = await inspectGitHistory(
        {
          ...repository(unbornRoot),
          headCommit: null,
          headState: "unborn",
        },
        { observedAt, runGit: runGitFixture },
      );
      expect(unborn).toMatchObject({
        status: "empty",
        root: unbornRoot,
        headCommit: null,
        commits: [],
        truncated: false,
        error: null,
      });
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(unbornRoot, { recursive: true, force: true }),
      ]);
    }
  });
});

function inspect(root: string) {
  return inspectGitHistory(repository(root), {
    observedAt,
    runGit: runGitFixture,
  });
}

function repository(root: string): RepositoryObservation {
  return {
    status: "ready",
    root,
    name: "fixture",
    branch: "main",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt,
    error: null,
  };
}

function commit(
  root: string,
  message: string,
  authorName = "Pacium Test",
  allowEmpty = false,
): Promise<void> {
  return runGitOk(root, [
    "-c",
    `user.name=${authorName}`,
    "-c",
    "user.email=pacium@example.invalid",
    "commit",
    ...(allowEmpty ? ["--allow-empty"] : []),
    "-m",
    message,
  ]);
}
