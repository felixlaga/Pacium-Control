import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RepoDocsService } from "./repo-docs-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function repoFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pacium-repo-docs-"));
  temporaryDirectories.push(directory);
  return directory;
}

function service(allowedRoots: readonly string[]): RepoDocsService {
  return new RepoDocsService({
    listAllowedRoots: () => Promise.resolve([...allowedRoots]),
  });
}

describe("repository docs service", () => {
  it("returns all three conventional docs case-insensitively in kind order", async () => {
    const root = await repoFixture();
    await writeFile(join(root, "FELIX-QUEUE.md"), "- queued\n");
    await writeFile(join(root, "Backlog.md"), "- backlog item\n");
    await writeFile(join(root, "NEEDS-FELIX.md"), "- need\n");

    const response = await service([root]).inspect(root);
    expect(response).toMatchObject({
      root: await realpath(root),
      docs: [
        {
          kind: "backlog",
          fileName: "Backlog.md",
          status: "stable",
          byteLength: 15,
          content: "- backlog item\n",
        },
        {
          kind: "needs",
          fileName: "NEEDS-FELIX.md",
          status: "stable",
          content: "- need\n",
        },
        {
          kind: "queue",
          fileName: "FELIX-QUEUE.md",
          status: "stable",
          content: "- queued\n",
        },
      ],
    });
    expect(response?.docs[0]?.path).toBe(
      join(await realpath(root), "Backlog.md"),
    );
    expect(response?.docs[0]?.modifiedAt).toMatch(/Z$/);
  });

  it("rejects a root outside the allowed repository roots", async () => {
    const allowed = await repoFixture();
    const outside = await repoFixture();
    await writeFile(join(outside, "BACKLOG.md"), "- secret\n");

    await expect(service([allowed]).inspect(outside)).resolves.toBeNull();
  });

  it("rejects a relative root before touching the filesystem", async () => {
    const root = await repoFixture();
    await expect(service([root]).inspect("relative/path")).resolves.toBeNull();
  });

  it("skips symlinked doc files entirely", async () => {
    const root = await repoFixture();
    await writeFile(join(root, "target.txt"), "- linked\n");
    await symlink(join(root, "target.txt"), join(root, "BACKLOG.md"));

    await expect(service([root]).inspect(root)).resolves.toMatchObject({
      docs: [],
    });
  });

  it("resolves a symlinked root to the same allowed canonical directory", async () => {
    const container = await repoFixture();
    const root = await repoFixture();
    await writeFile(join(root, "BACKLOG.md"), "- via link\n");
    const link = join(container, "repo-link");
    await symlink(root, link);

    await expect(service([root]).inspect(link)).resolves.toMatchObject({
      root: await realpath(root),
      docs: [{ fileName: "BACKLOG.md", content: "- via link\n" }],
    });
  });

  it("labels an oversized doc without returning content", async () => {
    const root = await repoFixture();
    await writeFile(join(root, "BACKLOG.md"), "x".repeat(65_537));

    await expect(service([root]).inspect(root)).resolves.toMatchObject({
      docs: [
        {
          kind: "backlog",
          status: "oversized",
          byteLength: 65_537,
          content: null,
        },
      ],
    });
  });

  it("labels an empty doc without content", async () => {
    const root = await repoFixture();
    await writeFile(join(root, "NEEDS-FELIX.md"), "");

    await expect(service([root]).inspect(root)).resolves.toMatchObject({
      docs: [{ kind: "needs", status: "empty", byteLength: 0, content: null }],
    });
  });

  it("ignores files outside the conventional names", async () => {
    const root = await repoFixture();
    for (const name of [
      "README.md",
      "BACKLOG.txt",
      "BACKLOGS.md",
      "NEEDS-.md",
      "-QUEUE.md",
      "NEEDS FELIX.md",
      "queue.md",
    ]) {
      await writeFile(join(root, name), "- ignored\n");
    }
    await writeFile(join(root, "backlog.md"), "- kept\n");

    await expect(service([root]).inspect(root)).resolves.toMatchObject({
      docs: [{ kind: "backlog", fileName: "backlog.md", content: "- kept\n" }],
    });
  });

  it("caps the response at sixteen docs in deterministic order", async () => {
    const root = await repoFixture();
    await writeFile(join(root, "BACKLOG.md"), "- first\n");
    for (let index = 10; index < 30; index += 1) {
      await writeFile(join(root, `NEEDS-AGENT-${index}.md`), "- need\n");
    }

    const response = await service([root]).inspect(root);
    expect(response?.docs).toHaveLength(16);
    expect(response?.docs[0]).toMatchObject({
      kind: "backlog",
      fileName: "BACKLOG.md",
    });
    expect(response?.docs.slice(1).map(({ fileName }) => fileName)).toEqual(
      Array.from({ length: 15 }, (_, index) => `NEEDS-AGENT-${index + 10}.md`),
    );
  });
});
