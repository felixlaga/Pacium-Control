import { constants } from "node:fs";
import { open, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  MAX_QUEUE_SOURCE_BYTES,
  type QueueObservationError,
  type QueueSourceObservationStatus,
} from "@pacium/contracts";

export interface QueueFileStat {
  kind: "file" | "symlink" | "other";
  device: bigint;
  inode: bigint;
  size: bigint;
  modifiedNanoseconds: bigint;
}

export interface QueueFileHandle {
  stat(): Promise<QueueFileStat>;
  read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number>;
  close(): Promise<void>;
}

export interface QueueFileReaderIO {
  lstat(path: string): Promise<QueueFileStat>;
  open(path: string): Promise<QueueFileHandle>;
}

export interface QueueFileReadResult {
  status: Exclude<QueueSourceObservationStatus, "pending" | "watch_error">;
  byteLength: number | null;
  modifiedAt: string | null;
  contentHash: string | null;
  text: string | null;
  error: QueueObservationError | null;
}

const NODE_READER_IO: QueueFileReaderIO = {
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

export async function readStableQueueFile(
  path: string,
  io: QueueFileReaderIO = NODE_READER_IO,
): Promise<QueueFileReadResult> {
  let beforePath: QueueFileStat;
  try {
    beforePath = await io.lstat(path);
  } catch (error) {
    return readFailure(error);
  }
  if (beforePath.kind !== "file") {
    return degraded("unsafe_type");
  }

  let handle: QueueFileHandle;
  try {
    handle = await io.open(path);
  } catch (error) {
    return readFailure(error);
  }

  try {
    const beforeOpen = await handle.stat();
    if (beforeOpen.kind !== "file" || !sameIdentity(beforePath, beforeOpen)) {
      return degraded("changing");
    }
    if (beforeOpen.size > BigInt(MAX_QUEUE_SOURCE_BYTES)) {
      const afterPath = await io.lstat(path);
      return sameIdentity(beforeOpen, afterPath)
        ? {
            ...degraded("oversized"),
            byteLength: safeByteLength(beforeOpen.size),
            modifiedAt: modifiedAt(beforeOpen),
          }
        : degraded("changing");
    }

    const buffer = new Uint8Array(MAX_QUEUE_SOURCE_BYTES + 1);
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

    const afterOpen = await handle.stat();
    const afterPath = await io.lstat(path);
    if (
      !sameIdentity(beforeOpen, afterOpen) ||
      !sameIdentity(afterOpen, afterPath) ||
      afterOpen.size !== BigInt(bytesRead)
    ) {
      return degraded("changing");
    }
    if (bytesRead > MAX_QUEUE_SOURCE_BYTES) {
      return {
        ...degraded("oversized"),
        byteLength: bytesRead,
        modifiedAt: modifiedAt(afterOpen),
      };
    }

    const bytes = buffer.subarray(0, bytesRead);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return {
        ...degraded("invalid_utf8"),
        byteLength: bytesRead,
        modifiedAt: modifiedAt(afterOpen),
      };
    }
    return {
      status: bytesRead === 0 ? "empty" : "stable",
      byteLength: bytesRead,
      modifiedAt: modifiedAt(afterOpen),
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      text,
      error: null,
    };
  } catch (error) {
    return readFailure(error);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function degraded(
  status: Exclude<
    QueueFileReadResult["status"],
    "stable" | "empty" | "read_error"
  >,
): QueueFileReadResult {
  return {
    status,
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    text: null,
    error: null,
  };
}

function readFailure(error: unknown): QueueFileReadResult {
  const code = systemErrorCode(error);
  if (code === "ENOENT") {
    return degraded("missing");
  }
  if (code === "ELOOP") {
    return degraded("unsafe_type");
  }
  return {
    status: "read_error",
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    text: null,
    error: {
      code: "READ_FAILED",
      message:
        code === null
          ? "The configured queue source could not be read."
          : `The configured queue source could not be read (${code}).`,
    },
  };
}

function sameIdentity(left: QueueFileStat, right: QueueFileStat): boolean {
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

function modifiedAt(stat: QueueFileStat): string {
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
}): QueueFileStat {
  return {
    kind: stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : "other",
    device: stat.dev,
    inode: stat.ino,
    size: stat.size,
    modifiedNanoseconds: stat.mtimeNs,
  };
}
