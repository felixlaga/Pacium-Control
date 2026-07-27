import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  appendFile,
  mkdtemp,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectGitChanges } from "./git-changes.js";
import type {
  GitCommandResult,
  GitCommandRunner,
} from "./repository-context.js";

const xcodeGit = "/Applications/Xcode.app/Contents/Developer/usr/bin/git";
const gitExecutable =
  process.platform === "darwin" && existsSync(xcodeGit) ? xcodeGit : "git";
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

      await writeFile(join(root, "staged.txt"), "base\nstaged\n");
      await runGitOk(root, ["add", "staged.txt"]);
      await writeFile(join(root, "unstaged.txt"), "base\nunstaged\n");
      await writeFile(join(root, "mixed.txt"), "base\nstaged half\n");
      await runGitOk(root, ["add", "mixed.txt"]);
      await appendFile(join(root, "mixed.txt"), "unstaged half\n");
      await unlink(join(root, "deleted.txt"));
      await rename(join(root, "old-name.txt"), join(root, "renamed.txt"));
      await runGitOk(root, ["add", "old-name.txt", "renamed.txt"]);
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

const runGitFixture: GitCommandRunner = (cwd, args) =>
  runGitProcess(cwd, [...args]);

async function runGitOk(cwd: string, args: string[]): Promise<void> {
  const result = await runGitProcess(cwd, args);
  if (result.exitCode !== 0) {
    throw new Error(`Git fixture command failed: ${result.stderr}`);
  }
}

function runGitProcess(cwd: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    execFile(
      gitExecutable,
      args,
      {
        cwd,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          exitCode:
            error === null
              ? 0
              : typeof error.code === "number"
                ? error.code
                : 1,
          stdout,
          stderr,
        });
      },
    );
  });
}
