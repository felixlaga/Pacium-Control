import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
  MAX_QUEUE_DELIVERIES,
  MAX_QUEUE_DECISIONS,
  MAX_QUEUE_RESOLUTIONS,
  MAX_QUEUE_STATE_BYTES,
  QUEUE_STATE_SCHEMA_VERSION,
  QueueDecisionRecordSchema,
  QueueDeliveryOutcomeSchema,
  QueueDeliveryRecordSchema,
  QueueResolutionRecordSchema,
  QueueStateDocumentSchema,
  QueueStateV3DocumentSchema,
  type QueueDeliveryOutcome,
  type QueueDeliveryRecord,
  type QueueDecisionRecord,
  type QueueResolutionRecord,
  queueDecisionIdentityKey,
} from "@pacium/contracts";

import { hasValidQueueDecisionHash } from "./queue-decision-hash.js";
import {
  computeQueueDeliveryHash,
  hasValidQueueDeliveryHash,
} from "./queue-delivery-hash.js";
import { hasValidQueueResolutionHash } from "./queue-resolution-hash.js";

export interface QueueDecisionStoreIO {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  open: typeof open;
  readFile: typeof readFile;
  rename: typeof rename;
  unlink: typeof unlink;
  syncDirectory(path: string): Promise<void>;
}

const NODE_STORE_IO: QueueDecisionStoreIO = {
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

export interface QueueDecisionStoreOptions {
  io?: Partial<QueueDecisionStoreIO>;
  ownerId?: number | null;
  randomId?: () => string;
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
      deliveries: readonly [];
      resolutions: readonly [];
      error: null;
    }
  | {
      status: "ready";
      revision: number;
      decisions: readonly QueueDecisionRecord[];
      deliveries: readonly QueueDeliveryRecord[];
      resolutions: readonly QueueResolutionRecord[];
      error: null;
    }
  | {
      status: "error";
      revision: null;
      decisions: readonly [];
      deliveries: readonly [];
      resolutions: readonly [];
      error: {
        code: QueueDecisionStoreErrorCode;
        message: string;
      };
    };

export type QueueDecisionStoreAppendResult = {
  status: "recorded" | "existing";
  revision: number;
  decision: QueueDecisionRecord;
};

export type QueueDeliveryStoreMutationResult = {
  status: "recorded" | "existing";
  revision: number;
  delivery: QueueDeliveryRecord;
};

export type QueueResolutionStoreMutationResult = {
  status: "recorded" | "existing";
  revision: number;
  resolution: QueueResolutionRecord;
};

export type QueueDecisionStoreWriteErrorCode =
  | "invalid_state"
  | "state_full"
  | "already_decided"
  | "write_failed"
  | "durability_unknown"
  | "invalid_result";

export class QueueDecisionStoreWriteError extends Error {
  public constructor(
    public readonly code: QueueDecisionStoreWriteErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class QueueDecisionStore {
  public readonly statePath: string;
  private readonly io: QueueDecisionStoreIO;
  private readonly ownerId: number | null;
  private readonly randomId: () => string;
  private writeTail = Promise.resolve();

  public constructor(
    public readonly dataDirectory: string,
    options: QueueDecisionStoreOptions = {},
  ) {
    this.statePath = join(dataDirectory, "queue-state.json");
    this.io = { ...NODE_STORE_IO, ...options.io };
    this.ownerId =
      options.ownerId === undefined
        ? (process.getuid?.() ?? null)
        : options.ownerId;
    this.randomId = options.randomId ?? randomUUID;
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
      if (stateStatus.size === 0 || stateStatus.size > MAX_QUEUE_STATE_BYTES) {
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
        value.schemaVersion !== 1 &&
        value.schemaVersion !== 2 &&
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
          "Queue decision state does not match a complete supported schema.",
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
      const deliveries =
        parsed.data.schemaVersion === 1 ? [] : parsed.data.deliveries;
      if (deliveries.some((delivery) => !hasValidQueueDeliveryHash(delivery))) {
        return stateError(
          "invalid_file",
          "Queue decision state contains a delivery hash mismatch.",
        );
      }
      const resolutions =
        parsed.data.schemaVersion === QUEUE_STATE_SCHEMA_VERSION
          ? parsed.data.resolutions
          : [];
      if (
        resolutions.some(
          (resolution) => !hasValidQueueResolutionHash(resolution),
        )
      ) {
        return stateError(
          "invalid_file",
          "Queue decision state contains a lifecycle resolution hash mismatch.",
        );
      }

      return {
        status: "ready",
        revision: parsed.data.revision,
        decisions: parsed.data.decisions,
        deliveries,
        resolutions,
        error: null,
      };
    } catch {
      return stateError(
        "filesystem_error",
        "Queue decision state could not be inspected. Queue sources and terminals remain available.",
      );
    }
  }

  public append(
    decision: QueueDecisionRecord,
  ): Promise<QueueDecisionStoreAppendResult> {
    const operation = this.writeTail.then(() => this.appendOnce(decision));
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  public beginDelivery(
    delivery: QueueDeliveryRecord,
  ): Promise<QueueDeliveryStoreMutationResult> {
    const operation = this.writeTail.then(() =>
      this.beginDeliveryOnce(delivery),
    );
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  public finishDelivery(
    deliveryId: string,
    outcome: QueueDeliveryOutcome,
  ): Promise<QueueDeliveryStoreMutationResult> {
    const operation = this.writeTail.then(() =>
      this.finishDeliveryOnce(deliveryId, outcome),
    );
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  public appendResolution(
    resolution: QueueResolutionRecord,
  ): Promise<QueueResolutionStoreMutationResult> {
    const operation = this.writeTail.then(() =>
      this.appendResolutionOnce(resolution),
    );
    this.writeTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async appendOnce(
    decision: QueueDecisionRecord,
  ): Promise<QueueDecisionStoreAppendResult> {
    const parsedDecision = QueueDecisionRecordSchema.parse(decision);
    if (!hasValidQueueDecisionHash(parsedDecision)) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "A queue decision with an invalid hash cannot be stored.",
      );
    }

    const current = await this.inspect();
    if (current.status === "error") {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Existing queue decision state must be repaired before recording another decision.",
      );
    }

    const sourceKey = queueDecisionIdentityKey(parsedDecision.source);
    const existing = current.decisions.find(
      (candidate) => queueDecisionIdentityKey(candidate.source) === sourceKey,
    );
    if (existing !== undefined) {
      if (hasSameDecisionIntent(existing, parsedDecision)) {
        return {
          status: "existing",
          revision: current.revision,
          decision: existing,
        };
      }
      throw new QueueDecisionStoreWriteError(
        "already_decided",
        "This queue item already has a different immutable decision.",
      );
    }

    if (current.decisions.length >= MAX_QUEUE_DECISIONS) {
      throw new QueueDecisionStoreWriteError(
        "state_full",
        "Queue decision state reached its safe record bound.",
      );
    }
    if (current.revision >= Number.MAX_SAFE_INTEGER) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Queue decision state revision cannot advance safely.",
      );
    }

    const document = QueueStateV3DocumentSchema.parse({
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: current.revision + 1,
      decisions: [...current.decisions, parsedDecision],
      deliveries: current.deliveries,
      resolutions: current.resolutions,
    });
    const accepted = await this.persistDocument(document);
    const acceptedDecision = accepted.decisions.find(
      (candidate) => queueDecisionIdentityKey(candidate.source) === sourceKey,
    );
    if (
      acceptedDecision === undefined ||
      acceptedDecision.decisionHash !== parsedDecision.decisionHash
    ) {
      throw new QueueDecisionStoreWriteError(
        "invalid_result",
        "Queue decision replacement could not be verified.",
      );
    }

    return {
      status: "recorded",
      revision: accepted.revision,
      decision: acceptedDecision,
    };
  }

  private async beginDeliveryOnce(
    delivery: QueueDeliveryRecord,
  ): Promise<QueueDeliveryStoreMutationResult> {
    const parsedDelivery = QueueDeliveryRecordSchema.parse(delivery);
    if (!hasValidQueueDeliveryHash(parsedDelivery)) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "A queue delivery with an invalid hash cannot be stored.",
      );
    }
    const current = await this.inspect();
    if (current.status === "error") {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Existing queue decision state must be repaired before delivery.",
      );
    }
    const existing = current.deliveries.find(
      (candidate) => candidate.decisionId === parsedDelivery.decisionId,
    );
    if (existing !== undefined) {
      return {
        status: "existing",
        revision: current.revision,
        delivery: existing,
      };
    }
    const decision = current.decisions.find(
      (candidate) =>
        candidate.decisionId === parsedDelivery.decisionId &&
        candidate.decisionHash === parsedDelivery.decisionHash,
    );
    if (decision === undefined) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Queue delivery must reference an existing immutable decision.",
      );
    }
    if (current.deliveries.length >= MAX_QUEUE_DELIVERIES) {
      throw new QueueDecisionStoreWriteError(
        "state_full",
        "Queue delivery state reached its safe record bound.",
      );
    }
    const document = QueueStateV3DocumentSchema.parse({
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: nextRevision(current.revision),
      decisions: current.decisions,
      deliveries: [...current.deliveries, parsedDelivery],
      resolutions: current.resolutions,
    });
    const accepted = await this.persistDocument(document);
    const acceptedDelivery = accepted.deliveries.find(
      (candidate) => candidate.deliveryId === parsedDelivery.deliveryId,
    );
    if (
      acceptedDelivery === undefined ||
      acceptedDelivery.deliveryHash !== parsedDelivery.deliveryHash
    ) {
      throw new QueueDecisionStoreWriteError(
        "invalid_result",
        "Queue delivery intent replacement could not be verified.",
      );
    }
    return {
      status: "recorded",
      revision: accepted.revision,
      delivery: acceptedDelivery,
    };
  }

  private async finishDeliveryOnce(
    deliveryId: string,
    outcome: QueueDeliveryOutcome,
  ): Promise<QueueDeliveryStoreMutationResult> {
    const parsedOutcome = QueueDeliveryOutcomeSchema.parse(outcome);
    const current = await this.inspect();
    if (current.status !== "ready") {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Queue delivery intent is unavailable.",
      );
    }
    const index = current.deliveries.findIndex(
      (candidate) => candidate.deliveryId === deliveryId,
    );
    const existing = current.deliveries[index];
    if (existing === undefined) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Queue delivery intent does not exist.",
      );
    }
    if (existing.outcome !== null) {
      if (JSON.stringify(existing.outcome) === JSON.stringify(parsedOutcome)) {
        return {
          status: "existing",
          revision: current.revision,
          delivery: existing,
        };
      }
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Queue delivery outcome is already immutable.",
      );
    }
    const unhashed = {
      deliveryId: existing.deliveryId,
      decisionId: existing.decisionId,
      decisionHash: existing.decisionHash,
      target: existing.target,
      payloadHash: existing.payloadHash,
      payloadByteLength: existing.payloadByteLength,
      requestedAt: existing.requestedAt,
      outcome: parsedOutcome,
    };
    const updated: QueueDeliveryRecord = {
      ...unhashed,
      deliveryHash: computeQueueDeliveryHash(unhashed),
    };
    const deliveries = [...current.deliveries];
    deliveries[index] = updated;
    const document = QueueStateV3DocumentSchema.parse({
      schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
      revision: nextRevision(current.revision),
      decisions: current.decisions,
      deliveries,
      resolutions: current.resolutions,
    });
    const accepted = await this.persistDocument(document);
    const acceptedDelivery = accepted.deliveries.find(
      (candidate) => candidate.deliveryId === deliveryId,
    );
    if (
      acceptedDelivery === undefined ||
      acceptedDelivery.deliveryHash !== updated.deliveryHash
    ) {
      throw new QueueDecisionStoreWriteError(
        "invalid_result",
        "Queue delivery outcome replacement could not be verified.",
      );
    }
    return {
      status: "recorded",
      revision: accepted.revision,
      delivery: acceptedDelivery,
    };
  }

  private async appendResolutionOnce(
    resolution: QueueResolutionRecord,
  ): Promise<QueueResolutionStoreMutationResult> {
    const parsedResolution = QueueResolutionRecordSchema.parse(resolution);
    if (!hasValidQueueResolutionHash(parsedResolution)) {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "A lifecycle resolution with an invalid hash cannot be stored.",
      );
    }
    const current = await this.inspect();
    if (current.status !== "ready") {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "Existing queue decision state must be available before recording a lifecycle resolution.",
      );
    }
    const matchingAction = current.resolutions.find(
      (candidate) =>
        candidate.decisionId === parsedResolution.decisionId &&
        candidate.action === parsedResolution.action,
    );
    if (matchingAction !== undefined) {
      if (hasSameResolutionIntent(matchingAction, parsedResolution)) {
        return {
          status: "existing",
          revision: current.revision,
          resolution: matchingAction,
        };
      }
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "This lifecycle action already has a different immutable record.",
      );
    }
    if (current.resolutions.length >= MAX_QUEUE_RESOLUTIONS) {
      throw new QueueDecisionStoreWriteError(
        "state_full",
        "Queue lifecycle state reached its safe record bound.",
      );
    }
    let document: ReturnType<typeof QueueStateV3DocumentSchema.parse>;
    try {
      document = QueueStateV3DocumentSchema.parse({
        schemaVersion: QUEUE_STATE_SCHEMA_VERSION,
        revision: nextRevision(current.revision),
        decisions: current.decisions,
        deliveries: current.deliveries,
        resolutions: [...current.resolutions, parsedResolution],
      });
    } catch {
      throw new QueueDecisionStoreWriteError(
        "invalid_state",
        "The lifecycle resolution does not match the current immutable queue state.",
      );
    }
    const accepted = await this.persistDocument(document);
    const acceptedResolution = accepted.resolutions.find(
      (candidate) =>
        candidate.resolutionId === parsedResolution.resolutionId &&
        candidate.resolutionHash === parsedResolution.resolutionHash,
    );
    if (acceptedResolution === undefined) {
      throw new QueueDecisionStoreWriteError(
        "invalid_result",
        "Queue lifecycle replacement could not be verified.",
      );
    }
    return {
      status: "recorded",
      revision: accepted.revision,
      resolution: acceptedResolution,
    };
  }

  private async persistDocument(document: {
    schemaVersion: 3;
    revision: number;
    decisions: QueueDecisionRecord[];
    deliveries: QueueDeliveryRecord[];
    resolutions: QueueResolutionRecord[];
  }): Promise<Extract<QueueDecisionStoreObservation, { status: "ready" }>> {
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_QUEUE_STATE_BYTES) {
      throw new QueueDecisionStoreWriteError(
        "state_full",
        "Queue decision state reached its safe serialized size bound.",
      );
    }
    await this.ensureDataDirectory();
    await this.atomicWrite(serialized);
    const accepted = await this.inspect();
    if (
      accepted.status !== "ready" ||
      accepted.revision !== document.revision
    ) {
      throw new QueueDecisionStoreWriteError(
        "invalid_result",
        "Queue state replacement could not be verified.",
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
      throw new QueueDecisionStoreWriteError(
        "write_failed",
        "Pacium data directory could not be created safely.",
      );
    }
  }

  private async atomicWrite(serialized: string): Promise<void> {
    const temporaryPath = join(
      this.dataDirectory,
      `.queue-state.json.${this.randomId()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    let renamed = false;
    try {
      handle = await this.io.open(temporaryPath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await this.io.rename(temporaryPath, this.statePath);
      renamed = true;
      await this.io.syncDirectory(this.dataDirectory);
    } catch {
      if (handle !== null) {
        await handle.close().catch(() => {});
      }
      if (!renamed) {
        await this.io.unlink(temporaryPath).catch(() => {});
      }
      throw new QueueDecisionStoreWriteError(
        renamed ? "durability_unknown" : "write_failed",
        renamed
          ? "Queue decision state was replaced but directory durability is unknown; inspect before retrying."
          : "Queue decision state could not be replaced atomically.",
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

function hasSameDecisionIntent(
  left: QueueDecisionRecord,
  right: QueueDecisionRecord,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "question_answer" && right.kind === "question_answer") {
    return (
      left.payload.answer === right.payload.answer &&
      left.payload.note === right.payload.note
    );
  }
  if (left.kind === "approval_decision" && right.kind === "approval_decision") {
    return (
      left.payload.outcome === right.payload.outcome &&
      left.payload.note === right.payload.note
    );
  }
  return false;
}

function hasSameResolutionIntent(
  left: QueueResolutionRecord,
  right: QueueResolutionRecord,
): boolean {
  return (
    left.decisionId === right.decisionId &&
    left.decisionHash === right.decisionHash &&
    left.action === right.action &&
    JSON.stringify(left.delivery) === JSON.stringify(right.delivery) &&
    JSON.stringify(left.relatedDecision) ===
      JSON.stringify(right.relatedDecision) &&
    left.note === right.note
  );
}

function emptyState(): QueueDecisionStoreObservation {
  return {
    status: "empty",
    revision: 0,
    decisions: [],
    deliveries: [],
    resolutions: [],
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
    deliveries: [],
    resolutions: [],
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

function nextRevision(revision: number): number {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new QueueDecisionStoreWriteError(
      "invalid_state",
      "Queue decision state revision cannot advance safely.",
    );
  }
  return revision + 1;
}
