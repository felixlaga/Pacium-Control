import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_PACIUM_CONTEXT_SOURCE_BYTES,
  PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES,
  type PaciumContextSource,
} from "@pacium/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readPaciumContextSource,
  type ContextFileHandle,
  type ContextFileReaderIO,
  type ContextFileStat,
} from "./context-file-reader.js";

const temporaryDirectories: string[] = [];
const observedAt = "2026-07-27T12:00:00.000Z";

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("Pacium context file reader", () => {
  it("does not touch the filesystem for an unconfigured source", async () => {
    const io: ContextFileReaderIO = {
      lstat: vi.fn(),
      open: vi.fn(),
    };
    await expect(
      readPaciumContextSource("objective", null, {
        io,
        now: () => observedAt,
      }),
    ).resolves.toEqual({
      kind: "objective",
      status: "unconfigured",
      path: null,
      format: null,
      observedAt,
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      contentBase64: null,
      error: null,
    });
    expect(io.lstat).not.toHaveBeenCalled();
    expect(io.open).not.toHaveBeenCalled();
  });

  it("returns exact bounded UTF-8 content and provenance", async () => {
    const fixture = await contextFixture("Build λ\n");
    const result = await readPaciumContextSource(
      "objective",
      source(fixture.path),
      { now: () => observedAt },
    );

    expect(result).toMatchObject({
      kind: "objective",
      status: "ready",
      path: fixture.path,
      format: "plain_text",
      observedAt,
      byteLength: 9,
      contentHash:
        "b560e5fbcb4dcfa9dd5733779b19390b86d0950c5876f25de3e0cb28fcc0e603",
      error: null,
    });
    expect(
      Buffer.from(result.contentBase64 ?? "", "base64").toString("utf8"),
    ).toBe("Build λ\n");
    expect(result.modifiedAt).toMatch(/Z$/);
  });

  it("distinguishes empty and missing files without creating either", async () => {
    const fixture = await contextFixture("");
    await expect(
      readPaciumContextSource("plan", source(fixture.path), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      kind: "plan",
      status: "empty",
      byteLength: 0,
      contentHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      contentBase64: null,
      error: null,
    });

    const missingPath = join(fixture.directory, "missing");
    await expect(
      readPaciumContextSource("objective", source(missingPath), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "missing",
      path: missingPath,
      byteLength: null,
      contentHash: null,
      contentBase64: null,
      error: {
        code: "missing",
        message: PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES.missing,
      },
    });
  });

  it("bounds oversized and invalid UTF-8 content without returning bytes", async () => {
    const oversized = await contextFixture(
      "x".repeat(MAX_PACIUM_CONTEXT_SOURCE_BYTES + 1),
    );
    await expect(
      readPaciumContextSource("objective", source(oversized.path), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "oversized",
      byteLength: MAX_PACIUM_CONTEXT_SOURCE_BYTES + 1,
      contentHash: null,
      contentBase64: null,
    });

    const invalid = await contextFixture(new Uint8Array([0xc3, 0x28]));
    await expect(
      readPaciumContextSource("plan", source(invalid.path), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "invalid_utf8",
      byteLength: 2,
      contentHash: null,
      contentBase64: null,
    });
  });

  it("rejects symlinks and directories without following them", async () => {
    const fixture = await contextFixture("private objective");
    const link = join(fixture.directory, "objective-link");
    await symlink(fixture.path, link);

    await expect(
      readPaciumContextSource("objective", source(link), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "unsafe_type",
      contentBase64: null,
    });
    await expect(
      readPaciumContextSource("plan", source(fixture.directory), {
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "unsafe_type",
      contentBase64: null,
    });
  });

  it("rejects an opened identity mismatch and always closes the handle", async () => {
    const pathStat = stat({ inode: 1n, size: 4n });
    const openedStat = stat({ inode: 2n, size: 4n });
    const handle = fakeHandle([openedStat], new TextEncoder().encode("test"));
    const io: ContextFileReaderIO = {
      lstat: () => Promise.resolve(pathStat),
      open: () => Promise.resolve(handle),
    };

    await expect(
      readPaciumContextSource("objective", source("/configured/OBJECTIVE"), {
        io,
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "changing",
      contentBase64: null,
      contentHash: null,
    });
    expect(handle.closed).toBe(true);
  });

  it("rejects size or modification drift after reading", async () => {
    const before = stat({ size: 4n, modifiedNanoseconds: 1_000_000n });
    const after = stat({ size: 5n, modifiedNanoseconds: 2_000_000n });
    const handle = fakeHandle(
      [before, after],
      new TextEncoder().encode("test"),
    );
    let pathCall = 0;
    const io: ContextFileReaderIO = {
      lstat: () => Promise.resolve(pathCall++ === 0 ? before : after),
      open: () => Promise.resolve(handle),
    };

    await expect(
      readPaciumContextSource("plan", source("/configured/PLAN"), {
        io,
        now: () => observedAt,
      }),
    ).resolves.toMatchObject({
      status: "changing",
      contentBase64: null,
      contentHash: null,
    });
    expect(handle.closed).toBe(true);
  });

  it("returns fixed path-free error copy", async () => {
    const io: ContextFileReaderIO = {
      lstat: () =>
        Promise.reject(
          Object.assign(new Error("secret /configured/OBJECTIVE"), {
            code: "EACCES",
          }),
        ),
      open: () => Promise.reject(new Error("unreachable")),
    };
    const result = await readPaciumContextSource(
      "objective",
      source("/configured/OBJECTIVE"),
      { io, now: () => observedAt },
    );

    expect(result).toMatchObject({
      status: "unreadable",
      contentHash: null,
      contentBase64: null,
      error: {
        code: "unreadable",
        message: PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES.unreadable,
      },
    });
    expect(result.error?.message).not.toContain("/configured/OBJECTIVE");
  });
});

async function contextFixture(content: string | Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), "pacium-context-reader-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "context");
  await writeFile(path, content);
  return { directory, path };
}

function source(path: string): PaciumContextSource {
  return { format: "plain_text", path };
}

function stat(overrides: Partial<ContextFileStat> = {}): ContextFileStat {
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
  stats: ContextFileStat[],
  content: Uint8Array,
): ContextFileHandle & { closed: boolean } {
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
