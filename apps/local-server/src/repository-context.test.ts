import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { discoverRepositoryContext } from "./repository-context.js";

describe("repository context discovery", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("finds an ancestor repository directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-repository-"));
    temporaryDirectories.push(root);
    await mkdir(join(root, ".git"));
    const nested = join(root, "packages", "web");
    await mkdir(nested, { recursive: true });

    expect(await discoverRepositoryContext(nested)).toEqual({
      root,
      name: root.split("/").at(-1),
    });
  });

  it("accepts a Git worktree marker file and returns null outside a repository", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-worktree-"));
    temporaryDirectories.push(root);
    await writeFile(join(root, ".git"), "gitdir: /tmp/example\n");
    expect(await discoverRepositoryContext(root)).toMatchObject({ root });

    const folder = await mkdtemp(join(tmpdir(), "pacium-folder-"));
    temporaryDirectories.push(folder);
    expect(await discoverRepositoryContext(folder)).toBeNull();
  });
});
