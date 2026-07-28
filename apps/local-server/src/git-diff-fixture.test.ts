import {
  appendFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RepositoryObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { inspectGitChanges, type GitChangesInspector } from "./git-changes.js";
import { inspectGitDiff } from "./git-diff.js";
import {
  runGitFixture,
  runGitOk,
  runGitProcess,
} from "./git-fixture-test-utils.js";

const observedAt = "2026-07-27T10:00:00.000Z";
const inspectFixtureChanges: GitChangesInspector = (candidate, time) =>
  inspectGitChanges(candidate, {
    ...(time === undefined ? {} : { observedAt: time }),
    runGit: runGitFixture,
  });

describe("diff inspection against real Git fixtures", () => {
  it("reads tracked, deleted, renamed, conflicted, untracked, binary, large, and unsafe-symlink states", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "pacium-git-diff-"));
    const root = join(sandbox, "repo");
    await mkdir(root);
    try {
      await runGitOk(root, ["init", "--initial-branch=main"]);
      await Promise.all([
        writeFile(join(root, "tracked.txt"), "base\n"),
        writeFile(join(root, "deleted.txt"), "delete me\n"),
        writeFile(join(root, "old-name.txt"), "rename me\n"),
        writeFile(join(root, "conflict.txt"), "base\n"),
        writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 3])),
      ]);
      await runGitOk(root, ["add", "--all"]);
      await commit(root, "fixture base");

      await runGitOk(root, ["switch", "-c", "fixture-conflict"]);
      await writeFile(join(root, "conflict.txt"), "other\n");
      await runGitOk(root, ["add", "conflict.txt"]);
      await commit(root, "other conflict");
      await runGitOk(root, ["switch", "main"]);
      await writeFile(join(root, "conflict.txt"), "ours\n");
      await runGitOk(root, ["add", "conflict.txt"]);
      await commit(root, "main conflict");
      const merge = await runGitProcess(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "merge",
        "fixture-conflict",
      ]);
      expect(merge.exitCode).toBe(1);

      await writeFile(join(root, "tracked.txt"), "changed\n");
      await unlink(join(root, "deleted.txt"));
      await rename(join(root, "old-name.txt"), join(root, "renamed.txt"));
      await runGitOk(root, ["add", "old-name.txt", "renamed.txt"]);
      await writeFile(join(root, "untracked.txt"), "untracked\n");
      await appendFile(join(root, "binary.bin"), Buffer.from([0, 4, 5]));
      await writeFile(join(root, "large.dat"), Buffer.alloc(1024 * 1024 + 1));
      await writeFile(join(sandbox, "outside.txt"), "outside\n");
      await symlink("../outside.txt", join(root, "outside-link.txt"));

      const inspect = (path: string) =>
        inspectGitDiff(repository(root), path, {
          inspectChanges: inspectFixtureChanges,
          observedAt,
          runGit: runGitFixture,
        });

      const tracked = await inspect("tracked.txt");
      expect(tracked.status).toBe("ready");
      expect(tracked.sections[0]?.patch).toContain("-base");
      const deleted = await inspect("deleted.txt");
      expect(deleted.status).toBe("ready");
      expect(deleted.sections[0]?.patch).toContain("deleted file mode");
      const renamed = await inspect("renamed.txt");
      expect(renamed).toMatchObject({
        status: "ready",
        previousPath: "old-name.txt",
      });
      expect(renamed.sections[0]?.patch).toContain("rename from old-name.txt");
      const conflict = await inspect("conflict.txt");
      expect(conflict.status).toBe("ready");
      expect(conflict.sections[0]?.patch).toContain("<<<<<<< HEAD");
      const untracked = await inspect("untracked.txt");
      expect(untracked.error).toBeNull();
      expect(untracked.status).toBe("ready");
      expect(untracked.sections[0]?.source).toBe("untracked");
      expect(untracked.sections[0]?.patch).toContain("--- /dev/null");
      await expect(inspect("binary.bin")).resolves.toMatchObject({
        status: "binary",
        sections: [],
      });
      await expect(inspect("large.dat")).resolves.toMatchObject({
        status: "too_large",
        sections: [],
      });
      await expect(inspect("outside-link.txt")).resolves.toMatchObject({
        status: "error",
        sections: [],
        error: { code: "unsafe_path" },
      });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("separates staged and unstaged patches in an unborn repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-git-diff-unborn-"));
    try {
      await runGitOk(root, ["init", "--initial-branch=main"]);
      await writeFile(join(root, "new.txt"), "staged\n");
      await runGitOk(root, ["add", "new.txt"]);
      await appendFile(join(root, "new.txt"), "unstaged\n");

      const observation = await inspectGitDiff(
        {
          ...repository(root),
          headCommit: null,
          headState: "unborn",
        },
        "new.txt",
        {
          inspectChanges: inspectFixtureChanges,
          observedAt,
          runGit: runGitFixture,
        },
      );

      expect(observation.status).toBe("ready");
      expect(observation.headCommit).toBeNull();
      expect(observation.sections.map(({ source }) => source)).toEqual([
        "staged",
        "unstaged",
      ]);
      expect(observation.sections[0]?.patch).toContain("+staged");
      expect(observation.sections[1]?.patch).toContain("+unstaged");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

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

function commit(root: string, message: string): Promise<void> {
  return runGitOk(root, [
    "-c",
    "user.name=Pacium Test",
    "-c",
    "user.email=pacium@example.invalid",
    "commit",
    "-m",
    message,
  ]);
}
