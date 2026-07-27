import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  readStableQueueFile,
  type QueueFileHandle,
  type QueueFileReaderIO,
  type QueueFileStat,
} from "./queue-file-reader.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("stable queue file reader", () => {
  it("returns exact UTF-8 text and deterministic provenance", async () => {
    const fixture = await queueFixture("Needs λ\n");
    const result = await readStableQueueFile(fixture.path);

    expect(result).toMatchObject({
      status: "stable",
      byteLength: 9,
      contentHash:
        "1631747394aaa288925e14bf18a121cf44fc05d3ff94a7ef4194e1d771847121",
      text: "Needs λ\n",
      error: null,
    });
    expect(result.modifiedAt).toMatch(/Z$/);
  });

  it("distinguishes complete empty input from missing input", async () => {
    const fixture = await queueFixture("");
    await expect(readStableQueueFile(fixture.path)).resolves.toMatchObject({
      status: "empty",
      byteLength: 0,
      contentHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      text: "",
    });
    await expect(
      readStableQueueFile(join(fixture.directory, "missing")),
    ).resolves.toEqual({
      status: "missing",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      text: null,
      error: null,
    });
  });

  it("bounds oversized input without retaining text or a hash", async () => {
    const fixture = await queueFixture("x".repeat(65_537));
    await expect(readStableQueueFile(fixture.path)).resolves.toMatchObject({
      status: "oversized",
      byteLength: 65_537,
      contentHash: null,
      text: null,
      error: null,
    });
  });

  it("rejects invalid UTF-8 without returning partial text", async () => {
    const fixture = await queueFixture(new Uint8Array([0xc3, 0x28]));
    await expect(readStableQueueFile(fixture.path)).resolves.toMatchObject({
      status: "invalid_utf8",
      byteLength: 2,
      contentHash: null,
      text: null,
      error: null,
    });
  });

  it("rejects symlinks and directories", async () => {
    const fixture = await queueFixture("target");
    const link = join(fixture.directory, "queue-link");
    await symlink(fixture.path, link);

    await expect(readStableQueueFile(link)).resolves.toMatchObject({
      status: "unsafe_type",
    });
    await expect(readStableQueueFile(fixture.directory)).resolves.toMatchObject(
      { status: "unsafe_type" },
    );
  });

  it("never promotes bytes when opened identity changes", async () => {
    const stable = stat({ inode: 1n, size: 4n });
    const changed = stat({ inode: 2n, size: 4n });
    const handle = fakeHandle([stable], new TextEncoder().encode("test"));
    const io: QueueFileReaderIO = {
      lstat: () => Promise.resolve(changed),
      open: () => Promise.resolve(handle),
    };

    await expect(readStableQueueFile("/configured/queue", io)).resolves.toEqual(
      {
        status: "changing",
        byteLength: null,
        modifiedAt: null,
        contentHash: null,
        text: null,
        error: null,
      },
    );
    expect(handle.closed).toBe(true);
  });

  it("rejects size or modification drift after reading", async () => {
    const before = stat({ size: 4n, modifiedNanoseconds: 1_000_000n });
    const after = stat({ size: 5n, modifiedNanoseconds: 2_000_000n });
    const handle = fakeHandle(
      [before, after],
      new TextEncoder().encode("test"),
    );
    let call = 0;
    const io: QueueFileReaderIO = {
      lstat: () => Promise.resolve(call++ === 0 ? before : after),
      open: () => Promise.resolve(handle),
    };

    await expect(
      readStableQueueFile("/configured/queue", io),
    ).resolves.toMatchObject({
      status: "changing",
      text: null,
      contentHash: null,
    });
    expect(handle.closed).toBe(true);
  });

  it("returns bounded error evidence without leaking the path", async () => {
    const io: QueueFileReaderIO = {
      lstat: () =>
        Promise.reject(
          Object.assign(new Error("secret /configured/queue"), {
            code: "EACCES",
          }),
        ),
      open: () => Promise.reject(new Error("unreachable")),
    };

    const result = await readStableQueueFile("/configured/queue", io);
    expect(result).toMatchObject({
      status: "read_error",
      contentHash: null,
      text: null,
      error: {
        code: "READ_FAILED",
        message: "The configured queue source could not be read (EACCES).",
      },
    });
    expect(JSON.stringify(result)).not.toContain("/configured/queue");
  });
});

async function queueFixture(content: string | Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), "pacium-queue-reader-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "queue");
  await writeFile(path, content);
  return { directory, path };
}

function stat(overrides: Partial<QueueFileStat> = {}): QueueFileStat {
  return {
    kind: "file",
    device: 1n,
    inode: 1n,
    size: 4n,
    modifiedNanoseconds: 1_000_000n,
    ...overrides,
  };
}

function fakeHandle(
  stats: QueueFileStat[],
  content: Uint8Array,
): QueueFileHandle & { closed: boolean } {
  let statIndex = 0;
  return {
    closed: false,
    stat() {
      return Promise.resolve(stats[Math.min(statIndex++, stats.length - 1)]!);
    },
    read(buffer, offset, length, position) {
      const available = content.subarray(position, position + length);
      buffer.set(available, offset);
      return Promise.resolve(available.byteLength);
    },
    close() {
      this.closed = true;
      return Promise.resolve();
    },
  };
}
