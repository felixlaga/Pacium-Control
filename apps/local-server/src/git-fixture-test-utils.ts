import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

import type {
  GitCommandResult,
  GitCommandRunner,
} from "./repository-context.js";

const xcodeGit = "/Applications/Xcode.app/Contents/Developer/usr/bin/git";
const gitExecutable =
  process.platform === "darwin" && existsSync(xcodeGit) ? xcodeGit : "git";

export const runGitFixture: GitCommandRunner = (cwd, args) =>
  runGitProcess(cwd, [...args]);

export async function runGitOk(cwd: string, args: string[]): Promise<void> {
  const result = await runGitProcess(cwd, args);
  if (result.exitCode !== 0) {
    throw new Error(`Git fixture command failed: ${result.stderr}`);
  }
}

export function runGitProcess(
  cwd: string,
  args: string[],
): Promise<GitCommandResult> {
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
