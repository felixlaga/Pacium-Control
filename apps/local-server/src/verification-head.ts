import {
  createGitCommandRunner,
  type GitCommandRunner,
} from "./repository-context.js";

const verificationHeadGitRunner = createGitCommandRunner({
  maxOutputBytes: 4 * 1024,
  timeoutMilliseconds: 750,
});

export type VerificationHeadObserver = (
  repositoryRoot: string,
) => Promise<string | null>;

export async function observeVerificationHead(
  repositoryRoot: string,
  runGit: GitCommandRunner = verificationHeadGitRunner,
): Promise<string | null> {
  try {
    const result = await runGit(repositoryRoot, [
      "-c",
      "core.fsmonitor=false",
      "-C",
      repositoryRoot,
      "rev-parse",
      "--verify",
      "HEAD",
    ]);
    if (result.exitCode !== 0) {
      return null;
    }
    const headCommit = result.stdout.trim();
    return /^[0-9a-f]{40,64}$/.test(headCommit) ? headCommit : null;
  } catch {
    return null;
  }
}
