import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  open,
  realpath,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { QueueAnswerFileDeliveryEvidence } from "@pacium/contracts";

import type { QueueDeliveryPayload } from "./queue-delivery-payload.js";

export interface AnswerFileDeliveryIO {
  link: typeof link;
  lstat: typeof lstat;
  open: typeof open;
  realpath: typeof realpath;
  unlink: typeof unlink;
  syncDirectory(path: string): Promise<void>;
}

const NODE_IO: AnswerFileDeliveryIO = {
  link,
  lstat,
  open,
  realpath,
  unlink,
  async syncDirectory(path) {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
};

export type AnswerFileDeliveryErrorCode =
  "occupied" | "unavailable" | "write_failed" | "unknown";

export class AnswerFileDeliveryError extends Error {
  public constructor(public readonly code: AnswerFileDeliveryErrorCode) {
    super(code);
  }
}

export interface AnswerFileDeliveryOptions {
  io?: Partial<AnswerFileDeliveryIO>;
  ownerId?: number | null;
  randomId?: () => string;
}

export async function inspectAnswerFileTarget(
  path: string,
  options: AnswerFileDeliveryOptions = {},
): Promise<"ready" | "occupied" | "unavailable"> {
  const io = { ...NODE_IO, ...options.io };
  const ownerId =
    options.ownerId === undefined
      ? (process.getuid?.() ?? null)
      : options.ownerId;
  try {
    await validateMissingTarget(io, path, dirname(path), ownerId);
    return "ready";
  } catch (error) {
    return error instanceof AnswerFileDeliveryError && error.code === "occupied"
      ? "occupied"
      : "unavailable";
  }
}

export async function publishAnswerFile(
  path: string,
  payload: QueueDeliveryPayload,
  options: AnswerFileDeliveryOptions = {},
): Promise<QueueAnswerFileDeliveryEvidence> {
  const io = { ...NODE_IO, ...options.io };
  const ownerId =
    options.ownerId === undefined
      ? (process.getuid?.() ?? null)
      : options.ownerId;
  const parent = dirname(path);
  const randomId = options.randomId ?? randomUUID;
  await validateMissingTarget(io, path, parent, ownerId);

  const temporaryPath = join(
    parent,
    `.${basename(path)}.pacium.${randomId()}.tmp`,
  );
  let handle: FileHandle | null = null;
  let linked = false;
  try {
    handle = await io.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(payload.bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await io.link(temporaryPath, path);
    linked = true;
    const targetStatus = await io.lstat(path);
    if (
      targetStatus.isSymbolicLink() ||
      !targetStatus.isFile() ||
      (targetStatus.mode & 0o077) !== 0 ||
      (ownerId !== null && targetStatus.uid !== ownerId)
    ) {
      throw new AnswerFileDeliveryError("unknown");
    }
    await io.syncDirectory(parent);
    await io.unlink(temporaryPath);
    await io.syncDirectory(parent);
    return {
      kind: "answer_file_created",
      byteLength: payload.byteLength,
      contentHash: payload.contentHash,
    };
  } catch (error) {
    if (handle !== null) {
      await handle.close().catch(() => {});
    }
    if (!linked) {
      await io.unlink(temporaryPath).catch(() => {});
      if (isExists(error)) {
        throw new AnswerFileDeliveryError("occupied");
      }
      if (error instanceof AnswerFileDeliveryError) {
        throw error;
      }
      throw new AnswerFileDeliveryError("write_failed");
    }
    await io.unlink(temporaryPath).catch(() => {});
    throw new AnswerFileDeliveryError("unknown");
  }
}

async function validateMissingTarget(
  io: AnswerFileDeliveryIO,
  path: string,
  parent: string,
  ownerId: number | null,
): Promise<void> {
  try {
    const [canonicalParent, parentStatus] = await Promise.all([
      io.realpath(parent),
      io.lstat(parent),
    ]);
    if (
      canonicalParent !== parent ||
      parentStatus.isSymbolicLink() ||
      !parentStatus.isDirectory() ||
      (ownerId !== null && parentStatus.uid !== ownerId)
    ) {
      throw new AnswerFileDeliveryError("unavailable");
    }
  } catch (error) {
    if (error instanceof AnswerFileDeliveryError) {
      throw error;
    }
    throw new AnswerFileDeliveryError("unavailable");
  }

  try {
    const targetStatus = await io.lstat(path);
    if (targetStatus.isSymbolicLink() || !targetStatus.isFile()) {
      throw new AnswerFileDeliveryError("unavailable");
    }
    throw new AnswerFileDeliveryError("occupied");
  } catch (error) {
    if (error instanceof AnswerFileDeliveryError) {
      throw error;
    }
    if (!isMissing(error)) {
      throw new AnswerFileDeliveryError("unavailable");
    }
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
