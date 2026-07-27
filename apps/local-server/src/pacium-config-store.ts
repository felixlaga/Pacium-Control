import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  MAX_PACIUM_CONFIG_BYTES,
  PACIUM_CONFIG_SCHEMA_VERSION,
  PaciumConfigDocumentSchema,
  type PaciumConfigObservation,
} from "@pacium/contracts";

export interface PaciumConfigStoreIO {
  lstat: typeof lstat;
  readFile: typeof readFile;
}

const NODE_STORE_IO: PaciumConfigStoreIO = {
  lstat,
  readFile,
};

export class PaciumConfigStore {
  public readonly configPath: string;

  public constructor(
    public readonly dataDirectory: string,
    private readonly io: PaciumConfigStoreIO = NODE_STORE_IO,
    private readonly ownerId: number | null = process.getuid?.() ?? null,
  ) {
    this.configPath = join(dataDirectory, "pacium.json");
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
