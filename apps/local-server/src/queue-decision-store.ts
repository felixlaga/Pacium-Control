import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  MAX_QUEUE_STATE_BYTES,
  QUEUE_STATE_SCHEMA_VERSION,
  QueueStateDocumentSchema,
  type QueueDecisionRecord,
} from "@pacium/contracts";

import { hasValidQueueDecisionHash } from "./queue-decision-hash.js";

export interface QueueDecisionStoreReadIO {
  lstat: typeof lstat;
  readFile: typeof readFile;
}

const NODE_READ_IO: QueueDecisionStoreReadIO = {
  lstat,
  readFile,
};

export interface QueueDecisionStoreOptions {
  io?: Partial<QueueDecisionStoreReadIO>;
  ownerId?: number | null;
}

export type QueueDecisionStoreErrorCode =
  | "invalid_file"
  | "unsupported_version"
  | "unsafe_permissions"
  | "filesystem_error";

export type QueueDecisionStoreObservation =
  | {
      status: "empty";
      revision: 0;
      decisions: readonly [];
      error: null;
    }
  | {
      status: "ready";
      revision: number;
      decisions: readonly QueueDecisionRecord[];
      error: null;
    }
  | {
      status: "error";
      revision: null;
      decisions: readonly [];
      error: {
        code: QueueDecisionStoreErrorCode;
        message: string;
      };
    };

export class QueueDecisionStore {
  public readonly statePath: string;
  private readonly io: QueueDecisionStoreReadIO;
  private readonly ownerId: number | null;

  public constructor(
    public readonly dataDirectory: string,
    options: QueueDecisionStoreOptions = {},
  ) {
    this.statePath = join(dataDirectory, "queue-state.json");
    this.io = { ...NODE_READ_IO, ...options.io };
    this.ownerId =
      options.ownerId === undefined
        ? (process.getuid?.() ?? null)
        : options.ownerId;
  }

  public async inspect(): Promise<QueueDecisionStoreObservation> {
    try {
      const directoryStatus = await this.optionalStatus(this.dataDirectory);
      if (directoryStatus === null) {
        return emptyState();
      }
      if (
        directoryStatus.isSymbolicLink() ||
        !directoryStatus.isDirectory() ||
        this.hasUnsafeOwnershipOrMode(directoryStatus)
      ) {
        return stateError(
          "unsafe_permissions",
          "Pacium data directory permissions or ownership are unsafe.",
        );
      }

      const stateStatus = await this.optionalStatus(this.statePath);
      if (stateStatus === null) {
        return emptyState();
      }
      if (
        stateStatus.isSymbolicLink() ||
        !stateStatus.isFile() ||
        this.hasUnsafeOwnershipOrMode(stateStatus)
      ) {
        return stateError(
          "unsafe_permissions",
          "Queue decision state must be a private regular non-symlink file.",
        );
      }
      if (
        stateStatus.size === 0 ||
        stateStatus.size > MAX_QUEUE_STATE_BYTES
      ) {
        return stateError(
          "invalid_file",
          `Queue decision state must be between 1 and ${MAX_QUEUE_STATE_BYTES} bytes.`,
        );
      }

      const bytes = await this.io.readFile(this.statePath);
      if (bytes.byteLength !== stateStatus.size) {
        return stateError(
          "invalid_file",
          "Queue decision state changed while it was being read.",
        );
      }

      let value: unknown;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        value = JSON.parse(text);
      } catch {
        return stateError(
          "invalid_file",
          "Queue decision state must contain valid UTF-8 JSON.",
        );
      }

      if (
        isRecord(value) &&
        "schemaVersion" in value &&
        value.schemaVersion !== QUEUE_STATE_SCHEMA_VERSION
      ) {
        return stateError(
          "unsupported_version",
          "Queue decision state uses an unsupported schema version.",
        );
      }

      const parsed = QueueStateDocumentSchema.safeParse(value);
      if (!parsed.success) {
        return stateError(
          "invalid_file",
          "Queue decision state does not match the complete version-1 schema.",
        );
      }
      if (
        parsed.data.decisions.some(
          (decision) => !hasValidQueueDecisionHash(decision),
        )
      ) {
        return stateError(
          "invalid_file",
          "Queue decision state contains a decision hash mismatch.",
        );
      }

      return {
        status: "ready",
        revision: parsed.data.revision,
        decisions: parsed.data.decisions,
        error: null,
      };
    } catch {
      return stateError(
        "filesystem_error",
        "Queue decision state could not be inspected. Queue sources and terminals remain available.",
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

function emptyState(): QueueDecisionStoreObservation {
  return {
    status: "empty",
    revision: 0,
    decisions: [],
    error: null,
  };
}

function stateError(
  code: QueueDecisionStoreErrorCode,
  message: string,
): QueueDecisionStoreObservation {
  return {
    status: "error",
    revision: null,
    decisions: [],
    error: { code, message },
  };
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
