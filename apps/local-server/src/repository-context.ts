import { lstat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface RepositoryContext {
  root: string;
  name: string;
}

export async function discoverRepositoryContext(
  canonicalCwd: string,
): Promise<RepositoryContext | null> {
  let candidate = canonicalCwd;

  while (true) {
    try {
      await lstat(join(candidate, ".git"));
      return {
        root: candidate,
        name: basename(candidate) || candidate,
      };
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) {
        return null;
      }
      candidate = parent;
    }
  }
}
