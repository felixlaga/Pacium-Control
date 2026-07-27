import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  MAX_PACIUM_CONFIG_BYTES,
  PACIUM_CONFIG_SCHEMA_VERSION,
  PaciumConfigDocumentSchema,
  PaciumWorkspaceSchema,
  type PaciumConfigDocument,
  type PaciumConfigObservation,
  type PaciumWorkspace,
} from "@pacium/contracts";

export interface PaciumConfigStoreIO {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  open: typeof open;
  readFile: typeof readFile;
  rename: typeof rename;
  unlink: typeof unlink;
  syncDirectory(path: string): Promise<void>;
}

const NODE_STORE_IO: PaciumConfigStoreIO = {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
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

export interface PaciumConfigStoreOptions {
  io?: Partial<PaciumConfigStoreIO>;
  normalizeWorkspace?: (workspace: PaciumWorkspace) => PaciumWorkspace;
  ownerId?: number | null;
  randomId?: () => string;
}

export type PaciumConfigStoreErrorCode =
  | "conflict"
  | "invalid_state"
  | "invalid_workspace"
  | "write_failed"
  | "durability_unknown"
  | "invalid_result";

export class PaciumConfigStoreError extends Error {
  public constructor(
    public readonly code: PaciumConfigStoreErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class PaciumConfigStore {
  public readonly configPath: string;
  private readonly io: PaciumConfigStoreIO;
  private readonly normalizeWorkspace: (
    workspace: PaciumWorkspace,
  ) => PaciumWorkspace;
  private readonly ownerId: number | null;
  private readonly randomId: () => string;
  private writeTail = Promise.resolve();

  public constructor(
    public readonly dataDirectory: string,
    options: PaciumConfigStoreOptions = {},
  ) {
    this.configPath = join(dataDirectory, "pacium.json");
    this.io = { ...NODE_STORE_IO, ...options.io };
    this.normalizeWorkspace =
      options.normalizeWorkspace ?? ((workspace) => workspace);
    this.ownerId =
      options.ownerId === undefined
        ? (process.getuid?.() ?? null)
        : options.ownerId;
    this.randomId = options.randomId ?? randomUUID;
  }

  public async inspect(): Promise<PaciumConfigObservation> {
    try {
      const directoryStatus = await this.optionalStatus(this.dataDirectory);
      if (directoryStatus === null) {
        return unconfigured();
      }
      if (
        directoryStatus.isSymbolicLink() ||
        !directoryStatus.isDirectory() ||
        this.hasUnsafeOwnershipOrMode(directoryStatus)
      ) {
        return configError(
          "unsafe_permissions",
          "Pacium data directory permissions or ownership are unsafe.",
        );
      }

      const fileStatus = await this.optionalStatus(this.configPath);
      if (fileStatus === null) {
        return unconfigured();
      }
      if (
        fileStatus.isSymbolicLink() ||
        !fileStatus.isFile() ||
        this.hasUnsafeOwnershipOrMode(fileStatus)
      ) {
        return configError(
          "unsafe_permissions",
          "Pacium config must be a private regular non-symlink file.",
        );
      }
      if (fileStatus.size === 0 || fileStatus.size > MAX_PACIUM_CONFIG_BYTES) {
        return configError(
          "invalid_file",
          `Pacium config must be between 1 and ${MAX_PACIUM_CONFIG_BYTES} bytes.`,
        );
      }

      const bytes = await this.io.readFile(this.configPath);
      if (bytes.byteLength !== fileStatus.size) {
        return configError(
          "invalid_file",
          "Pacium config changed while it was being read.",
        );
      }
      let value: unknown;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        value = JSON.parse(text);
      } catch {
        return configError(
          "invalid_file",
          "Pacium config must contain valid UTF-8 JSON.",
        );
      }
      if (
        isRecord(value) &&
        "schemaVersion" in value &&
        value.schemaVersion !== PACIUM_CONFIG_SCHEMA_VERSION
      ) {
        return configError(
          "unsupported_version",
          "Pacium config uses an unsupported schema version.",
        );
      }
      const parsed = PaciumConfigDocumentSchema.safeParse(value);
      if (!parsed.success) {
        return configError(
          "invalid_file",
          "Pacium config does not match the complete version-1 schema.",
        );
      }
      return {
        status: "ready",
        revision: parsed.data.revision,
        workspace: parsed.data.workspace,
        error: null,
      };
    } catch {
      return configError(
        "filesystem_error",
        "Pacium config could not be inspected. General terminals remain available.",
      );
    }
  }

  public replace(
    expectedRevision: number,
    workspace: PaciumWorkspace,
  ): Promise<PaciumConfigObservation> {
    const operation = this.writeTail.then(() =>
      this.replaceOnce(expectedRevision, workspace),
    );
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async replaceOnce(
    expectedRevision: number,
    workspace: PaciumWorkspace,
  ): Promise<PaciumConfigObservation> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new PaciumConfigStoreError(
        "invalid_workspace",
        "Expected Pacium config revision is invalid.",
      );
    }
    const current = await this.inspect();
    if (current.status === "error") {
      throw new PaciumConfigStoreError(
        "invalid_state",
        "Existing Pacium config must be repaired before replacement.",
      );
    }
    const currentRevision = current.status === "ready" ? current.revision : 0;
    if (currentRevision !== expectedRevision) {
      throw new PaciumConfigStoreError(
        "conflict",
        "Pacium config changed; inspect the current revision before replacing it.",
      );
    }
    if (currentRevision >= Number.MAX_SAFE_INTEGER) {
      throw new PaciumConfigStoreError(
        "invalid_state",
        "Pacium config revision cannot advance safely.",
      );
    }

    let normalized: PaciumWorkspace;
    try {
      normalized = this.normalizeWorkspace(
        PaciumWorkspaceSchema.parse(workspace),
      );
    } catch {
      throw new PaciumConfigStoreError(
        "invalid_workspace",
        "Pacium workspace references or paths are invalid.",
      );
    }
    const document = PaciumConfigDocumentSchema.parse({
      schemaVersion: PACIUM_CONFIG_SCHEMA_VERSION,
      revision: currentRevision + 1,
      workspace: normalized,
    });
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_PACIUM_CONFIG_BYTES) {
      throw new PaciumConfigStoreError(
        "invalid_workspace",
        "Normalized Pacium config exceeds its file limit.",
      );
    }

    await this.ensureDataDirectory();
    await this.atomicWrite(document, serialized);
    const accepted = await this.inspect();
    if (
      accepted.status !== "ready" ||
      accepted.revision !== document.revision
    ) {
      throw new PaciumConfigStoreError(
        "invalid_result",
        "Pacium config replacement could not be verified.",
      );
    }
    return accepted;
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await this.io.mkdir(this.dataDirectory, {
        recursive: true,
        mode: 0o700,
      });
      const status = await this.io.lstat(this.dataDirectory);
      if (
        status.isSymbolicLink() ||
        !status.isDirectory() ||
        this.hasUnsafeOwnershipOrMode(status)
      ) {
        throw new Error("unsafe directory");
      }
    } catch {
      throw new PaciumConfigStoreError(
        "write_failed",
        "Pacium data directory could not be created safely.",
      );
    }
  }

  private async atomicWrite(
    document: PaciumConfigDocument,
    serialized: string,
  ): Promise<void> {
    const temporaryPath = join(
      this.dataDirectory,
      `.pacium.json.${this.randomId()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    let renamed = false;
    try {
      handle = await this.io.open(temporaryPath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await this.io.rename(temporaryPath, this.configPath);
      renamed = true;
      await this.io.syncDirectory(this.dataDirectory);
    } catch {
      if (handle !== null) {
        await handle.close().catch(() => {});
      }
      if (!renamed) {
        await this.io.unlink(temporaryPath).catch(() => {});
      }
      throw new PaciumConfigStoreError(
        renamed ? "durability_unknown" : "write_failed",
        renamed
          ? "Pacium config was replaced but directory durability is unknown; inspect before retrying."
          : "Pacium config could not be replaced atomically.",
      );
    }

    if (document.revision < 1) {
      throw new PaciumConfigStoreError(
        "invalid_result",
        "Pacium config replacement produced an invalid revision.",
      );
    }
  }

  private async optionalStatus(path: string) {
    try {
      return await this.io.lstat(path);
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  private hasUnsafeOwnershipOrMode(status: {
    mode: number;
    uid: number;
  }): boolean {
    return (
      (status.mode & 0o077) !== 0 ||
      (this.ownerId !== null && status.uid !== this.ownerId)
    );
  }
}

function unconfigured(): PaciumConfigObservation {
  return {
    status: "unconfigured",
    revision: null,
    workspace: null,
    error: null,
  };
}

function configError(
  code: NonNullable<PaciumConfigObservation["error"]>["code"],
  message: string,
): PaciumConfigObservation {
  return {
    status: "error",
    revision: null,
    workspace: null,
    error: { code, message },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
