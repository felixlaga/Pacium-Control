import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, type Stats } from "node:fs";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  HostSetupDocumentSchema,
  MAX_HOST_SETUP_BYTES,
  type HostSetupDocument,
} from "@pacium/contracts";

const FILE_NAME = "host-setup.json";

export function loadHostSetupDocument(
  dataDirectory: string,
  ownerId: number | null = process.getuid?.() ?? null,
): HostSetupDocument | null {
  const path = join(dataDirectory, FILE_NAME);
  let status: Stats;
  try {
    status = lstatSync(path);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw new Error("Pacium host setup could not be inspected.", {
      cause: error,
    });
  }
  try {
    const directory = lstatSync(dataDirectory);
    if (
      directory.isSymbolicLink() ||
      !directory.isDirectory() ||
      hasUnsafeOwnershipOrMode(directory, ownerId)
    ) {
      throw new Error("unsafe directory");
    }
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw new Error("Pacium host setup directory is unsafe.", {
      cause: error,
    });
  }
  if (
    status.isSymbolicLink() ||
    !status.isFile() ||
    hasUnsafeOwnershipOrMode(status, ownerId) ||
    status.size === 0 ||
    status.size > MAX_HOST_SETUP_BYTES
  ) {
    throw new Error("Pacium host setup is not one safe private file.");
  }
  try {
    const bytes = readFileSync(path);
    if (bytes.byteLength !== status.size) {
      throw new Error("changed during read");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return HostSetupDocumentSchema.parse(JSON.parse(text) as unknown);
  } catch {
    throw new Error("Pacium host setup contains invalid versioned JSON.");
  }
}

export class HostSetupStore {
  public readonly path: string;

  public constructor(
    private readonly dataDirectory: string,
    private readonly ownerId: number | null = process.getuid?.() ?? null,
  ) {
    this.path = join(dataDirectory, FILE_NAME);
  }

  public async inspect(): Promise<HostSetupDocument | null> {
    try {
      const status = await lstat(this.path);
      const directory = await lstat(this.dataDirectory);
      if (
        directory.isSymbolicLink() ||
        !directory.isDirectory() ||
        hasUnsafeOwnershipOrMode(directory, this.ownerId)
      ) {
        throw new Error("unsafe directory");
      }
      if (
        status.isSymbolicLink() ||
        !status.isFile() ||
        hasUnsafeOwnershipOrMode(status, this.ownerId) ||
        status.size === 0 ||
        status.size > MAX_HOST_SETUP_BYTES
      ) {
        throw new Error("unsafe file");
      }
      const bytes = await readFile(this.path);
      if (bytes.byteLength !== status.size) {
        throw new Error("changed during read");
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return HostSetupDocumentSchema.parse(JSON.parse(text) as unknown);
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw new Error("Pacium host setup could not be read safely.", {
        cause: error,
      });
    }
  }

  public async replace(input: HostSetupDocument): Promise<HostSetupDocument> {
    const document = HostSetupDocumentSchema.parse(input);
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_HOST_SETUP_BYTES) {
      throw new Error("Pacium host setup exceeds its file limit.");
    }
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    const directory = await lstat(this.dataDirectory);
    if (
      directory.isSymbolicLink() ||
      !directory.isDirectory() ||
      hasUnsafeOwnershipOrMode(directory, this.ownerId)
    ) {
      throw new Error("Pacium data directory is unsafe.");
    }

    const temporaryPath = join(
      this.dataDirectory,
      `.${FILE_NAME}.${randomUUID()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    let renamed = false;
    try {
      handle = await open(temporaryPath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporaryPath, this.path);
      renamed = true;
      const directoryHandle = await open(this.dataDirectory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } catch {
      if (handle !== null) {
        await handle.close().catch(() => undefined);
      }
      if (!renamed) {
        await unlink(temporaryPath).catch(() => undefined);
      }
      throw new Error(
        renamed
          ? "Host setup was replaced but durability is unknown."
          : "Host setup could not be written atomically.",
      );
    }
    const accepted = await this.inspect();
    if (accepted === null) {
      throw new Error("Host setup replacement could not be verified.");
    }
    return accepted;
  }
}

function hasUnsafeOwnershipOrMode(
  status: Pick<Stats, "mode" | "uid">,
  ownerId: number | null,
): boolean {
  return (
    (status.mode & 0o077) !== 0 || (ownerId !== null && status.uid !== ownerId)
  );
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
