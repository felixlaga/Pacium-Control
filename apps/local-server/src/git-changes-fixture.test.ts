import {
  appendFile,
  mkdtemp,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectGitChanges } from "./git-changes.js";
import {
  runGitFixture,
  runGitOk,
  runGitProcess,
} from "./git-fixture-test-utils.js";

const observedAt = "2026-07-27T10:00:00.000Z";

describe("changed-file inspection against a Git fixture", () => {
  it("matches staged, unstaged, mixed, untracked, deleted, renamed, binary, and large evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-git-changes-"));
    try {
      await runGitOk(root, ["init", "--initial-branch=main"]);
      await Promise.all([
        writeFile(join(root, "staged.txt"), "base\n"),
        writeFile(join(root, "unstaged.txt"), "base\n"),
        writeFile(join(root, "mixed.txt"), "base\n"),
        writeFile(join(root, "deleted.txt"), "base\n"),
        writeFile(join(root, "old-name.txt"), "base\n"),
        writeFile(join(root, "type-change.txt"), "type source\n"),
        writeFile(join(root, "conflict.txt"), "base\n"),
        writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 3])),
      ]);
      await runGitOk(root, ["add", "--all"]);
      await runGitOk(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "commit",
        "-m",
        "fixture base",
      ]);

      await runGitOk(root, ["switch", "-c", "fixture-conflict"]);
      await writeFile(join(root, "conflict.txt"), "other\n");
      await runGitOk(root, ["add", "conflict.txt"]);
      await runGitOk(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "commit",
        "-m",
        "other conflict",
      ]);
      await runGitOk(root, ["switch", "main"]);
      await writeFile(join(root, "conflict.txt"), "ours\n");
      await runGitOk(root, ["add", "conflict.txt"]);
      await runGitOk(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "commit",
        "-m",
        "main conflict",
      ]);
      const mergeResult = await runGitProcess(root, [
        "-c",
        "user.name=Pacium Test",
        "-c",
        "user.email=pacium@example.invalid",
        "merge",
        "fixture-conflict",
      ]);
      expect(mergeResult.exitCode).not.toBe(0);

      await writeFile(join(root, "staged.txt"), "base\nstaged\n");
      await runGitOk(root, ["add", "staged.txt"]);
      await writeFile(join(root, "unstaged.txt"), "base\nunstaged\n");
      await writeFile(join(root, "mixed.txt"), "base\nstaged half\n");
      await runGitOk(root, ["add", "mixed.txt"]);
      await appendFile(join(root, "mixed.txt"), "unstaged half\n");
      await unlink(join(root, "deleted.txt"));
      await rename(join(root, "old-name.txt"), join(root, "renamed.txt"));
      await runGitOk(root, ["add", "old-name.txt", "renamed.txt"]);
      await unlink(join(root, "type-change.txt"));
      await symlink("staged.txt", join(root, "type-change.txt"));
      await appendFile(join(root, "binary.bin"), Buffer.from([0, 4, 5]));
      await writeFile(join(root, "untracked.txt"), "new\n");
      await writeFile(join(root, "large.dat"), Buffer.alloc(1024 * 1024 + 1));

      const observation = await inspectGitChanges(
        {
          status: "ready",
          root,
          name: "fixture",
          branch: "main",
          headCommit: null,
          headState: "branch",
          worktreeKind: "main",
          observedAt,
          error: null,
        },
        {
          observedAt,
          runGit: runGitFixture,
        },
      );
      const byPath = new Map(
        observation.files.map((file) => [file.path, file]),
      );

      expect(observation.status).toBe("ready");
      expect(byPath.get("staged.txt")).toMatchObject({
        staged: true,
        unstaged: false,
      });
      expect(byPath.get("unstaged.txt")).toMatchObject({
        staged: false,
        unstaged: true,
      });
      expect(byPath.get("mixed.txt")).toMatchObject({
        staged: true,
        unstaged: true,
      });
      expect(byPath.get("deleted.txt")).toMatchObject({
        kind: "deleted",
        unstaged: true,
      });
      expect(byPath.get("renamed.txt")).toMatchObject({
        kind: "renamed",
        previousPath: "old-name.txt",
      });
      expect(byPath.get("type-change.txt")).toMatchObject({
        kind: "type_changed",
      });
      expect(byPath.get("conflict.txt")).toMatchObject({
        kind: "conflicted",
        conflicted: true,
      });
      expect(byPath.get("binary.bin")).toMatchObject({
        binary: true,
        additions: null,
        deletions: null,
      });
      expect(byPath.get("untracked.txt")).toMatchObject({
        kind: "untracked",
        untracked: true,
      });
      expect(byPath.get("large.dat")).toMatchObject({
        kind: "untracked",
        large: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
