import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  MAX_RELAUNCH_MANIFESTS,
  RELAUNCH_MANIFEST_STATE_SCHEMA_VERSION,
  RelaunchManifestSchema,
  RelaunchManifestStateSchema,
  type RelaunchManifest,
} from "@pacium/contracts";

const MAX_RELAUNCH_STATE_BYTES = 512 * 1024;

export class RelaunchManifestStoreError extends Error {
  public constructor(
    public readonly code:
      | "invalid_file"
      | "unsupported_version"
      | "unsafe_permissions"
      | "write_failed"
      | "durability_unknown",
    message: string,
  ) {
    super(message);
  }
}

export class RelaunchManifestStore {
  public readonly statePath: string;
  private manifests: RelaunchManifest[] = [];
  private initialized = false;
  private writeTail = Promise.resolve();

  public constructor(
    public readonly dataDirectory: string,
    private readonly ownerId = process.getuid?.() ?? null,
    private readonly randomId: () => string = randomUUID,
  ) {
    this.statePath = join(dataDirectory, "relaunch-manifests.json");
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const directoryStatus = await optionalStatus(this.dataDirectory);
    if (directoryStatus === null) {
      this.initialized = true;
      return;
    }
    this.requireSafeDirectory(directoryStatus);
    const stateStatus = await optionalStatus(this.statePath);
    if (stateStatus === null) {
      this.initialized = true;
      return;
    }
    if (
      stateStatus.isSymbolicLink() ||
      !stateStatus.isFile() ||
      this.hasUnsafeOwnershipOrMode(stateStatus)
    ) {
      throw new RelaunchManifestStoreError(
        "unsafe_permissions",
        "Relaunch manifest state must be a private regular non-symlink file.",
      );
    }
    if (stateStatus.size === 0 || stateStatus.size > MAX_RELAUNCH_STATE_BYTES) {
      throw new RelaunchManifestStoreError(
        "invalid_file",
        `Relaunch manifest state must be between 1 and ${MAX_RELAUNCH_STATE_BYTES} bytes.`,
      );
    }
    const bytes = await readFile(this.statePath);
    if (bytes.byteLength !== stateStatus.size) {
      throw new RelaunchManifestStoreError(
        "invalid_file",
        "Relaunch manifest state changed while it was being read.",
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new RelaunchManifestStoreError(
        "invalid_file",
        "Relaunch manifest state must contain valid UTF-8 JSON.",
      );
    }
    if (
      isRecord(value) &&
      "schemaVersion" in value &&
      value.schemaVersion !== RELAUNCH_MANIFEST_STATE_SCHEMA_VERSION
    ) {
      throw new RelaunchManifestStoreError(
        "unsupported_version",
        "Relaunch manifest state uses an unsupported schema version.",
      );
    }
    const parsed = RelaunchManifestStateSchema.safeParse(value);
    if (!parsed.success) {
      throw new RelaunchManifestStoreError(
        "invalid_file",
        "Relaunch manifest state does not match the supported complete schema.",
      );
    }
    this.manifests = parsed.data.manifests;
    this.initialized = true;
  }

  public list(): RelaunchManifest[] {
    this.requireInitialized();
    return this.manifests.map((manifest) => structuredClone(manifest));
  }

  public get(manifestId: string): RelaunchManifest | null {
    this.requireInitialized();
    const manifest = this.manifests.find(({ id }) => id === manifestId);
    return manifest === undefined ? null : structuredClone(manifest);
  }

  public upsert(manifest: RelaunchManifest): Promise<RelaunchManifest> {
    this.requireInitialized();
    const parsed = RelaunchManifestSchema.parse(manifest);
    const operation = this.writeTail.then(async () => {
      const retained = this.manifests.filter(
        ({ id, sessionId }) =>
          id !== parsed.id && sessionId !== parsed.sessionId,
      );
      const next = [parsed, ...retained]
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            right.id.localeCompare(left.id),
        )
        .slice(0, MAX_RELAUNCH_MANIFESTS);
      await this.replace(next);
      this.manifests = next;
      return structuredClone(parsed);
    });
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async replace(manifests: RelaunchManifest[]): Promise<void> {
    const document = RelaunchManifestStateSchema.parse({
      schemaVersion: RELAUNCH_MANIFEST_STATE_SCHEMA_VERSION,
      manifests,
    });
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_RELAUNCH_STATE_BYTES) {
      throw new RelaunchManifestStoreError(
        "write_failed",
        "Relaunch manifest state exceeds its bounded file size.",
      );
    }
    await this.ensureDataDirectory();
    const temporaryPath = join(
      this.dataDirectory,
      `.relaunch-manifests.json.${this.randomId()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    let renamed = false;
    try {
      handle = await open(temporaryPath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporaryPath, this.statePath);
      renamed = true;
      const directoryHandle = await open(this.dataDirectory, "r");
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } catch {
      if (handle !== null) {
        await handle.close().catch(() => {});
      }
      if (!renamed) {
        await unlink(temporaryPath).catch(() => {});
      }
      throw new RelaunchManifestStoreError(
        renamed ? "durability_unknown" : "write_failed",
        renamed
          ? "Relaunch manifest state was replaced but directory durability is unknown; inspect before retrying."
          : "Relaunch manifest state could not be replaced atomically.",
      );
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
      this.requireSafeDirectory(await lstat(this.dataDirectory));
    } catch (error) {
      if (error instanceof RelaunchManifestStoreError) {
        throw error;
      }
      throw new RelaunchManifestStoreError(
        "write_failed",
        "Pacium data directory could not be created safely.",
      );
    }
  }

  private requireSafeDirectory(
    status: Awaited<ReturnType<typeof lstat>>,
  ): void {
    if (
      status.isSymbolicLink() ||
      !status.isDirectory() ||
      this.hasUnsafeOwnershipOrMode(status)
    ) {
      throw new RelaunchManifestStoreError(
        "unsafe_permissions",
        "Pacium data directory permissions or ownership are unsafe.",
      );
    }
  }

  private hasUnsafeOwnershipOrMode(status: {
    mode: number | bigint;
    uid: number | bigint;
  }): boolean {
    return (
      (this.ownerId !== null && Number(status.uid) !== this.ownerId) ||
      (Number(status.mode) & 0o077) !== 0
    );
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error("Relaunch manifest store has not been initialized.");
    }
  }
}

async function optionalStatus(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
