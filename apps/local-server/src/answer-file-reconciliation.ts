import {
  QueueArtifactObservationSchema,
  type QueueArtifactObservation,
  type QueueDeliveryRecord,
} from "@pacium/contracts";

import {
  readStableQueueFile,
  type QueueFileReadResult,
  type QueueFileReaderIO,
} from "./queue-file-reader.js";

export interface AnswerFileReconciliationOptions {
  now?: () => string;
  read?: (path: string, io?: QueueFileReaderIO) => Promise<QueueFileReadResult>;
}

export async function reconcileAnswerFile(
  delivery: QueueDeliveryRecord,
  options: AnswerFileReconciliationOptions = {},
): Promise<QueueArtifactObservation> {
  if (delivery.target.type !== "answer_file") {
    return QueueArtifactObservationSchema.parse({
      status: "acknowledgement_unavailable",
      source: "provider_unavailable",
      observedAt: (options.now ?? (() => new Date().toISOString()))(),
      reason: "role_prompt_unobserved",
      byteLength: null,
      contentHash: null,
    });
  }
  const observedAt = (options.now ?? (() => new Date().toISOString()))();
  const result = await (options.read ?? readStableQueueFile)(
    delivery.target.path,
  );
  if (result.status === "missing") {
    return QueueArtifactObservationSchema.parse({
      status: "acknowledgement_unavailable",
      source: "filesystem_observed",
      observedAt,
      reason: "answer_file_missing",
      byteLength: null,
      contentHash: null,
    });
  }
  if (
    result.status === "stable" &&
    result.byteLength === delivery.payloadByteLength &&
    result.contentHash === delivery.payloadHash
  ) {
    return QueueArtifactObservationSchema.parse({
      status: "transport_artifact_present",
      source: "filesystem_observed",
      observedAt,
      reason: null,
      byteLength: result.byteLength,
      contentHash: result.contentHash,
    });
  }
  const reason =
    result.status === "stable" || result.status === "empty"
      ? "answer_file_changed"
      : result.status === "unsafe_type"
        ? "answer_file_unsafe"
        : result.status === "oversized"
          ? "answer_file_oversized"
          : "answer_file_unreadable";
  return QueueArtifactObservationSchema.parse({
    status: "target_conflict",
    source: "filesystem_observed",
    observedAt,
    reason,
    byteLength: result.byteLength,
    contentHash: result.contentHash,
  });
}
