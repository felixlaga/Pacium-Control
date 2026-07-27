import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import {
  MAX_PACIUM_CONTEXT_SOURCE_BYTES,
  PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES,
  PaciumContextSourceObservationSchema,
  type PaciumContextSourceObservation,
  type PaciumContextSourceErrorCode,
  type PaciumContextSource,
} from "@pacium/contracts";

export interface ContextFileStat {
  kind: "file" | "symlink" | "other";
  device: bigint;
  inode: bigint;
  size: bigint;
  modifiedNanoseconds: bigint;
}

export interface ContextFileHandle {
  stat(): Promise<ContextFileStat>;
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number>;
  close(): Promise<void>;
}

export interface ContextFileReaderIO {
  lstat(path: string): Promise<ContextFileStat>;
  open(path: string): Promise<ContextFileHandle>;
}

export interface ContextFileReaderOptions {
  io?: ContextFileReaderIO;
  now?: () => string;
}

const NODE_CONTEXT_IO: ContextFileReaderIO = {
  async lstat(path) {
    return normalizeStat(await lstat(path, { bigint: true }));
  },
  async open(path) {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(path, constants.O_RDONLY | noFollow);
    return {
      async stat() {
        return normalizeStat(await handle.stat({ bigint: true }));
      },
      async read(buffer, offset, length, position) {
        const result = await handle.read(buffer, offset, length, position);
        return result.bytesRead;
      },
      async close() {
        await handle.close();
      },
    };
  },
};

export async function readPaciumContextSource(
  kind: "objective" | "plan",
  source: PaciumContextSource | null,
  options: ContextFileReaderOptions = {},
): Promise<PaciumContextSourceObservation> {
  const observedAt = (options.now ?? (() => new Date().toISOString()))();
  if (source === null) {
    return PaciumContextSourceObservationSchema.parse({
      kind,
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
  }

  const io = options.io ?? NODE_CONTEXT_IO;
  let pathStat: ContextFileStat;
  try {
    pathStat = await io.lstat(source.path);
  } catch (error) {
    return readFailure(kind, source, observedAt, error);
  }
  if (pathStat.kind !== "file") {
    return degraded(kind, source, observedAt, "unsafe_type");
  }

  let handle: ContextFileHandle;
  try {
    handle = await io.open(source.path);
  } catch (error) {
    return readFailure(kind, source, observedAt, error);
  }

  try {
    const openStat = await handle.stat();
    if (openStat.kind !== "file" || !sameIdentity(pathStat, openStat)) {
      return degraded(kind, source, observedAt, "changing");
    }
    if (openStat.size > BigInt(MAX_PACIUM_CONTEXT_SOURCE_BYTES)) {
      const finalPathStat = await io.lstat(source.path);
      return sameIdentity(openStat, finalPathStat)
        ? degraded(kind, source, observedAt, "oversized", openStat)
        : degraded(kind, source, observedAt, "changing");
    }

    const buffer = new Uint8Array(MAX_PACIUM_CONTEXT_SOURCE_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.byteLength) {
      const count = await handle.read(
        buffer,
        bytesRead,
        buffer.byteLength - bytesRead,
        bytesRead,
      );
      if (count === 0) {
        break;
      }
      bytesRead += count;
    }

    const finalOpenStat = await handle.stat();
    const finalPathStat = await io.lstat(source.path);
    if (
      !sameIdentity(openStat, finalOpenStat) ||
      !sameIdentity(finalOpenStat, finalPathStat) ||
      finalOpenStat.size !== BigInt(bytesRead)
    ) {
      return degraded(kind, source, observedAt, "changing");
    }
    if (bytesRead > MAX_PACIUM_CONTEXT_SOURCE_BYTES) {
      return degraded(kind, source, observedAt, "oversized", finalOpenStat);
    }

    const bytes = buffer.subarray(0, bytesRead);
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return degraded(kind, source, observedAt, "invalid_utf8", finalOpenStat);
    }

    const contentHash = createHash("sha256").update(bytes).digest("hex");
    if (bytesRead === 0) {
      return PaciumContextSourceObservationSchema.parse({
        kind,
        status: "empty",
        path: source.path,
        format: source.format,
        observedAt,
        byteLength: 0,
        modifiedAt: modifiedAt(finalOpenStat),
        contentHash,
        contentBase64: null,
        error: null,
      });
    }
    return PaciumContextSourceObservationSchema.parse({
      kind,
      status: "ready",
      path: source.path,
      format: source.format,
      observedAt,
      byteLength: bytesRead,
      modifiedAt: modifiedAt(finalOpenStat),
      contentHash,
      contentBase64: Buffer.from(bytes).toString("base64"),
      error: null,
    });
  } catch (error) {
    return readFailure(kind, source, observedAt, error);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function degraded(
  kind: "objective" | "plan",
  source: PaciumContextSource,
  observedAt: string,
  status: PaciumContextSourceErrorCode,
  stat?: ContextFileStat,
): PaciumContextSourceObservation {
  return PaciumContextSourceObservationSchema.parse({
    kind,
    status,
    path: source.path,
    format: source.format,
    observedAt,
    byteLength: stat === undefined ? null : safeByteLength(stat.size),
    modifiedAt: stat === undefined ? null : modifiedAt(stat),
    contentHash: null,
    contentBase64: null,
    error: {
      code: status,
      message: PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES[status],
    },
  });
}

function readFailure(
  kind: "objective" | "plan",
  source: PaciumContextSource,
  observedAt: string,
  error: unknown,
): PaciumContextSourceObservation {
  const code = systemErrorCode(error);
  if (code === "ENOENT") {
    return degraded(kind, source, observedAt, "missing");
  }
  if (code === "ELOOP") {
    return degraded(kind, source, observedAt, "unsafe_type");
  }
  return degraded(kind, source, observedAt, "unreadable");
}

function sameIdentity(left: ContextFileStat, right: ContextFileStat): boolean {
  return (
    right.kind === "file" &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.modifiedNanoseconds === right.modifiedNanoseconds
  );
}

function safeByteLength(size: bigint): number | null {
  return size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(size) : null;
}

function modifiedAt(stat: ContextFileStat): string {
  return new Date(Number(stat.modifiedNanoseconds / 1_000_000n)).toISOString();
}

function systemErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,32}$/.test(error.code)
  ) {
    return error.code;
  }
  return null;
}

function normalizeStat(stat: {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}): ContextFileStat {
  return {
    kind: stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : "other",
    device: stat.dev,
    inode: stat.ino,
    size: stat.size,
    modifiedNanoseconds: stat.mtimeNs,
  };
}
