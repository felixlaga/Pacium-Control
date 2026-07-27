import { z } from "zod";

import { PaciumIdentifierSchema } from "./pacium-config.js";
import { QUEUE_ITEM_BOUNDARY_VERSION } from "./queue-classification.js";
import { QueueItemInspectionIdentitySchema } from "./queue-item-inspection.js";

export const QUEUE_STATE_SCHEMA_VERSION_V1 = 1 as const;
export const MAX_QUEUE_STATE_BYTES = 4 * 1024 * 1024;
export const MAX_QUEUE_DECISIONS = 4096;
export const MAX_QUEUE_ANSWER_BYTES = 8 * 1024;
export const MAX_QUEUE_DECISION_NOTE_BYTES = 2 * 1024;

const QueueHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

function boundedOperatorText(maxBytes: number, allowBlank: boolean) {
  return z
    .string()
    .max(maxBytes)
    .refine((value) => new TextEncoder().encode(value).byteLength <= maxBytes, {
      message: `Text exceeds ${maxBytes} UTF-8 bytes.`,
    })
    .refine((value) => allowBlank || value.trim().length > 0, {
      message: "Text must contain a non-whitespace character.",
    });
}

export const QueueDecisionRequestIdentitySchema =
  QueueItemInspectionIdentitySchema;
export type QueueDecisionRequestIdentity = z.infer<
  typeof QueueDecisionRequestIdentitySchema
>;

export const QueueQuestionAnswerPayloadSchema = z
  .object({
    answer: boundedOperatorText(MAX_QUEUE_ANSWER_BYTES, false),
    note: boundedOperatorText(MAX_QUEUE_DECISION_NOTE_BYTES, true).nullable(),
  })
  .strict();
export type QueueQuestionAnswerPayload = z.infer<
  typeof QueueQuestionAnswerPayloadSchema
>;

export const QueueApprovalDecisionPayloadSchema = z
  .object({
    outcome: z.enum(["approved", "denied"]),
    note: boundedOperatorText(MAX_QUEUE_DECISION_NOTE_BYTES, true).nullable(),
  })
  .strict();
export type QueueApprovalDecisionPayload = z.infer<
  typeof QueueApprovalDecisionPayloadSchema
>;

export const QueueDecisionSourceIdentitySchema = z
  .object({
    workspaceId: PaciumIdentifierSchema,
    workspaceRevision: z.number().int().positive().safe(),
    sourceId: PaciumIdentifierSchema,
    observationRevision: z.number().int().positive().safe(),
    boundary: z.literal(QUEUE_ITEM_BOUNDARY_VERSION),
    contentHash: QueueHashSchema,
    itemId: QueueHashSchema,
    itemType: z.enum(["question", "approval"]),
  })
  .strict();
export type QueueDecisionSourceIdentity = z.infer<
  typeof QueueDecisionSourceIdentitySchema
>;

export const QueueDecisionActorSchema = z
  .object({
    kind: z.literal("local_operator"),
    label: z.literal("Local operator"),
  })
  .strict();
export type QueueDecisionActor = z.infer<typeof QueueDecisionActorSchema>;

const QueueDecisionRecordBaseShape = {
  decisionId: z.string().uuid(),
  source: QueueDecisionSourceIdentitySchema,
  actor: QueueDecisionActorSchema,
  decidedAt: z.string().datetime(),
  decisionHash: QueueHashSchema,
};

export const QueueQuestionAnswerDecisionSchema = z
  .object({
    ...QueueDecisionRecordBaseShape,
    kind: z.literal("question_answer"),
    payload: QueueQuestionAnswerPayloadSchema,
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.source.itemType !== "question") {
      context.addIssue({
        code: "custom",
        message: "A question answer must reference a question source.",
        path: ["source", "itemType"],
      });
    }
  });
export type QueueQuestionAnswerDecision = z.infer<
  typeof QueueQuestionAnswerDecisionSchema
>;

export const QueueApprovalDecisionSchema = z
  .object({
    ...QueueDecisionRecordBaseShape,
    kind: z.literal("approval_decision"),
    payload: QueueApprovalDecisionPayloadSchema,
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.source.itemType !== "approval") {
      context.addIssue({
        code: "custom",
        message: "An approval decision must reference an approval source.",
        path: ["source", "itemType"],
      });
    }
  });
export type QueueApprovalDecision = z.infer<typeof QueueApprovalDecisionSchema>;

export const QueueDecisionRecordSchema = z.union([
  QueueQuestionAnswerDecisionSchema,
  QueueApprovalDecisionSchema,
]);
export type QueueDecisionRecord = z.infer<typeof QueueDecisionRecordSchema>;

export const QueueStateV1DocumentSchema = z
  .object({
    schemaVersion: z.literal(QUEUE_STATE_SCHEMA_VERSION_V1),
    revision: z.number().int().positive().safe(),
    decisions: z.array(QueueDecisionRecordSchema).max(MAX_QUEUE_DECISIONS),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    const sourceKeys = new Set<string>();
    const hashes = new Set<string>();
    for (const [index, decision] of document.decisions.entries()) {
      const sourceKey = queueDecisionIdentityKey(decision.source);
      if (ids.has(decision.decisionId)) {
        context.addIssue({
          code: "custom",
          message: "Queue decision IDs must be unique.",
          path: ["decisions", index, "decisionId"],
        });
      }
      if (sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          message: "Queue item identities can contain only one decision.",
          path: ["decisions", index, "source"],
        });
      }
      if (hashes.has(decision.decisionHash)) {
        context.addIssue({
          code: "custom",
          message: "Queue decision hashes must be unique.",
          path: ["decisions", index, "decisionHash"],
        });
      }
      ids.add(decision.decisionId);
      sourceKeys.add(sourceKey);
      hashes.add(decision.decisionHash);
    }
  });
export type QueueStateV1Document = z.infer<typeof QueueStateV1DocumentSchema>;

export const QueueDecisionErrorCodeSchema = z.enum([
  "ITEM_STALE",
  "ITEM_TYPE_MISMATCH",
  "ITEM_ALREADY_DECIDED",
  "DECISION_STATE_UNAVAILABLE",
  "DECISION_STATE_FULL",
  "DECISION_WRITE_FAILED",
  "DECISION_DURABILITY_UNKNOWN",
]);
export type QueueDecisionErrorCode = z.infer<
  typeof QueueDecisionErrorCodeSchema
>;

export const QUEUE_DECISION_ERROR_MESSAGES = {
  ITEM_STALE:
    "This queue item is no longer current. No decision was recorded or delivered.",
  ITEM_TYPE_MISMATCH:
    "The current queue item does not accept this decision type. No decision was recorded or delivered.",
  ITEM_ALREADY_DECIDED:
    "This queue item already has a different immutable decision. The existing decision was preserved.",
  DECISION_STATE_UNAVAILABLE:
    "Local decision state is unavailable. Queue sources and terminals were not changed.",
  DECISION_STATE_FULL:
    "Local decision state reached its safe bound. No decision was recorded or delivered.",
  DECISION_WRITE_FAILED:
    "The decision could not be stored atomically. Queue sources and terminals were not changed.",
  DECISION_DURABILITY_UNKNOWN:
    "The decision may have been stored, but durability is unknown. Inspect current state before retrying.",
} as const satisfies Record<QueueDecisionErrorCode, string>;

export const QueueDecisionErrorSchema = z
  .object({
    code: QueueDecisionErrorCodeSchema,
    message: z.string().min(1).max(200),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.message !== QUEUE_DECISION_ERROR_MESSAGES[error.code]) {
      context.addIssue({
        code: "custom",
        message: "Queue decision errors use fixed safe copy.",
      });
    }
  });
export type QueueDecisionError = z.infer<typeof QueueDecisionErrorSchema>;

export const OpenQueueItemDecisionStateSchema = z
  .object({
    status: z.literal("open"),
    decision: z.null(),
    error: z.null(),
  })
  .strict();

export const DecidedQueueItemDecisionStateSchema = z
  .object({
    status: z.literal("decided"),
    decision: QueueDecisionRecordSchema,
    error: z.null(),
  })
  .strict();

export const UnavailableQueueItemDecisionStateSchema = z
  .object({
    status: z.literal("unavailable"),
    decision: z.null(),
    error: QueueDecisionErrorSchema.refine(
      (error) =>
        error.code === "DECISION_STATE_UNAVAILABLE" ||
        error.code === "DECISION_STATE_FULL",
      {
        message:
          "Unavailable decision state uses a storage availability error.",
      },
    ),
  })
  .strict();

export const QueueItemDecisionStateSchema = z.discriminatedUnion("status", [
  OpenQueueItemDecisionStateSchema,
  DecidedQueueItemDecisionStateSchema,
  UnavailableQueueItemDecisionStateSchema,
]);
export type QueueItemDecisionState = z.infer<
  typeof QueueItemDecisionStateSchema
>;

const QueueDecisionResultIdentityShape =
  QueueDecisionRequestIdentitySchema.shape;

const SuccessfulQueueDecisionResultSchema = z
  .object({
    status: z.enum(["recorded", "existing"]),
    ...QueueDecisionResultIdentityShape,
    decision: QueueDecisionRecordSchema,
    error: z.null(),
  })
  .strict();

const FailedQueueDecisionResultSchema = z
  .object({
    status: z.enum(["stale", "unavailable", "rejected"]),
    ...QueueDecisionResultIdentityShape,
    decision: z.null(),
    error: QueueDecisionErrorSchema,
  })
  .strict()
  .superRefine((result, context) => {
    const valid =
      (result.status === "stale" && result.error.code === "ITEM_STALE") ||
      (result.status === "rejected" &&
        (result.error.code === "ITEM_TYPE_MISMATCH" ||
          result.error.code === "ITEM_ALREADY_DECIDED")) ||
      (result.status === "unavailable" &&
        result.error.code.startsWith("DECISION_"));
    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "Queue decision result status and error code must agree.",
      });
    }
  });

export const QueueDecisionResultSchema = z.discriminatedUnion("status", [
  SuccessfulQueueDecisionResultSchema,
  FailedQueueDecisionResultSchema,
]);
export type QueueDecisionResult = z.infer<typeof QueueDecisionResultSchema>;

export function queueDecisionError(
  code: QueueDecisionErrorCode,
): QueueDecisionError {
  return {
    code,
    message: QUEUE_DECISION_ERROR_MESSAGES[code],
  };
}

export function queueDecisionIdentityKey(
  source: Pick<
    QueueDecisionSourceIdentity,
    "workspaceId" | "sourceId" | "boundary" | "itemId"
  >,
): string {
  return [
    source.workspaceId,
    source.sourceId,
    source.boundary,
    source.itemId,
  ].join("\u0000");
}
