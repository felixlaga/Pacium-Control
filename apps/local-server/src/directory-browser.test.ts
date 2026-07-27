import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  browseHostDirectories,
  DirectoryBrowserError,
} from "./directory-browser.js";

describe("host directory browser", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("returns sorted directories only with repository and hidden markers", async () => {
    const root = await createRoot();
    await mkdir(join(root, "zeta"));
    await mkdir(join(root, "Alpha", ".git"), { recursive: true });
    await mkdir(join(root, ".hidden"));
    await writeFile(join(root, "not-a-directory.txt"), "ignored");

    const listing = await browseHostDirectories({
      requestedPath: root,
      defaultPath: root,
      homePath: root,
    });
    const canonicalRoot = listing.currentPath;

    expect(listing.entries).toEqual([
      {
        name: ".hidden",
        path: join(canonicalRoot, ".hidden"),
        hidden: true,
        repository: false,
      },
      {
        name: "Alpha",
        path: join(canonicalRoot, "Alpha"),
        hidden: false,
        repository: true,
      },
      {
        name: "zeta",
        path: join(canonicalRoot, "zeta"),
        hidden: false,
        repository: false,
      },
    ]);
    expect(listing.truncated).toBe(false);
  });

  it("bounds results and reports truncation", async () => {
    const root = await createRoot();
    await Promise.all(
      ["one", "two", "three"].map((name) => mkdir(join(root, name))),
    );

    const listing = await browseHostDirectories({
      requestedPath: root,
      defaultPath: root,
      homePath: root,
      maxEntries: 2,
    });

    expect(listing.entries).toHaveLength(2);
    expect(listing.truncated).toBe(true);
  });

  it("rejects relative, missing, and file paths", async () => {
    const root = await createRoot();
    const file = join(root, "file.txt");
    await writeFile(file, "not a directory");

    for (const requestedPath of ["relative", join(root, "missing"), file]) {
      await expect(
        browseHostDirectories({
          requestedPath,
          defaultPath: root,
          homePath: root,
        }),
      ).rejects.toBeInstanceOf(DirectoryBrowserError);
    }
  });

  async function createRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "pacium-directory-browser-"));
    roots.push(root);
    return root;
  }
});
