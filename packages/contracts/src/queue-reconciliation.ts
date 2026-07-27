import { z } from "zod";

import {
  MAX_PACIUM_QUEUE_SOURCES,
  PaciumIdentifierSchema,
} from "./pacium-config.js";
import {
  MAX_QUEUE_DECISIONS,
  MAX_QUEUE_DECISION_NOTE_BYTES,
} from "./queue-decision.js";

export const MAX_QUEUE_RESOLUTIONS = MAX_QUEUE_DECISIONS * 2;
export const MAX_QUEUE_ITEM_PRIOR_DECISIONS = 8;
export const MAX_QUEUE_SOURCE_CONFLICTS = 4;

const QueueHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const QueueUuidSchema = z.string().uuid();

const QueueResolutionNoteSchema = z
  .string()
  .max(MAX_QUEUE_DECISION_NOTE_BYTES)
  .refine(
    (value) =>
      new TextEncoder().encode(value).byteLength <=
      MAX_QUEUE_DECISION_NOTE_BYTES,
    {
      message: `Text exceeds ${MAX_QUEUE_DECISION_NOTE_BYTES} UTF-8 bytes.`,
    },
  )
  .nullable();

export const QueueResolutionActionSchema = z.enum([
  "acknowledged",
  "applied",
  "unable_to_apply",
  "confirmed_not_delivered",
  "superseded",
]);
export type QueueResolutionAction = z.infer<typeof QueueResolutionActionSchema>;

export const QueueResolutionActorSchema = z
  .object({
    kind: z.literal("local_operator"),
    label: z.literal("Local operator"),
  })
  .strict();

export const QueueResolutionSourceSchema = z.literal("human_labelled");

export const QueueResolutionDeliveryReferenceSchema = z
  .object({
    deliveryId: QueueUuidSchema,
    deliveryHash: QueueHashSchema,
  })
  .strict();
export type QueueResolutionDeliveryReference = z.infer<
  typeof QueueResolutionDeliveryReferenceSchema
>;

export const QueueResolutionRelatedDecisionSchema = z
  .object({
    decisionId: QueueUuidSchema,
    decisionHash: QueueHashSchema,
  })
  .strict();
export type QueueResolutionRelatedDecision = z.infer<
  typeof QueueResolutionRelatedDecisionSchema
>;

export const QueueResolutionRecordSchema = z
  .object({
    resolutionId: QueueUuidSchema,
    decisionId: QueueUuidSchema,
    decisionHash: QueueHashSchema,
    action: QueueResolutionActionSchema,
    delivery: QueueResolutionDeliveryReferenceSchema.nullable(),
    relatedDecision: QueueResolutionRelatedDecisionSchema.nullable(),
    actor: QueueResolutionActorSchema,
    source: QueueResolutionSourceSchema,
    recordedAt: z.string().datetime(),
    note: QueueResolutionNoteSchema,
    resolutionHash: QueueHashSchema,
  })
  .strict()
  .superRefine((resolution, context) => {
    const superseded = resolution.action === "superseded";
    if (
      superseded !== (resolution.relatedDecision !== null) ||
      superseded === (resolution.delivery !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Supersession requires only a related decision; every other resolution requires only a delivery.",
      });
    }
    if (
      resolution.relatedDecision?.decisionId === resolution.decisionId ||
      resolution.relatedDecision?.decisionHash === resolution.decisionHash
    ) {
      context.addIssue({
        code: "custom",
        message: "A decision cannot supersede itself.",
      });
    }
  });
export type QueueResolutionRecord = z.infer<typeof QueueResolutionRecordSchema>;

export const QueueResolutionRequestSchema = z
  .object({
    decisionId: QueueUuidSchema,
    decisionHash: QueueHashSchema,
    action: QueueResolutionActionSchema,
    delivery: QueueResolutionDeliveryReferenceSchema.nullable(),
    relatedDecision: QueueResolutionRelatedDecisionSchema.nullable(),
    note: QueueResolutionNoteSchema,
  })
  .strict()
  .superRefine((request, context) => {
    const superseded = request.action === "superseded";
    if (
      superseded !== (request.relatedDecision !== null) ||
      superseded === (request.delivery !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Supersession requests require only a related decision; every other request requires only a delivery.",
      });
    }
  });
export type QueueResolutionRequest = z.infer<
  typeof QueueResolutionRequestSchema
>;

export const QueueResolutionErrorCodeSchema = z.enum([
  "RESOLUTION_DECISION_NOT_FOUND",
  "RESOLUTION_DECISION_HASH_MISMATCH",
  "RESOLUTION_DELIVERY_NOT_FOUND",
  "RESOLUTION_DELIVERY_HASH_MISMATCH",
  "RESOLUTION_RELATED_DECISION_INVALID",
  "RESOLUTION_TRANSITION_INVALID",
  "RESOLUTION_STATE_UNAVAILABLE",
  "RESOLUTION_STATE_FULL",
  "RESOLUTION_WRITE_FAILED",
  "RESOLUTION_DURABILITY_UNKNOWN",
]);
export type QueueResolutionErrorCode = z.infer<
  typeof QueueResolutionErrorCodeSchema
>;

export const QUEUE_RESOLUTION_ERROR_MESSAGES = {
  RESOLUTION_DECISION_NOT_FOUND:
    "The immutable decision is unavailable. No lifecycle label was recorded.",
  RESOLUTION_DECISION_HASH_MISMATCH:
    "The decision identity no longer matches. No lifecycle label was recorded.",
  RESOLUTION_DELIVERY_NOT_FOUND:
    "The delivery attempt is unavailable. No lifecycle label was recorded.",
  RESOLUTION_DELIVERY_HASH_MISMATCH:
    "The delivery attempt identity no longer matches. No lifecycle label was recorded.",
  RESOLUTION_RELATED_DECISION_INVALID:
    "The replacement decision is not an eligible superseding decision.",
  RESOLUTION_TRANSITION_INVALID:
    "This lifecycle change is not valid from the current immutable state.",
  RESOLUTION_STATE_UNAVAILABLE:
    "Lifecycle state is unavailable. Queue sources, targets, and terminals were not changed.",
  RESOLUTION_STATE_FULL:
    "Lifecycle state reached its safe bound. No label was recorded.",
  RESOLUTION_WRITE_FAILED:
    "The lifecycle label could not be stored atomically. External state was not changed.",
  RESOLUTION_DURABILITY_UNKNOWN:
    "The lifecycle label may have been stored, but durability is unknown. Inspect current state before retrying.",
} as const satisfies Record<QueueResolutionErrorCode, string>;

export const QueueResolutionErrorSchema = z
  .object({
    code: QueueResolutionErrorCodeSchema,
    message: z.string().min(1).max(240),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.message !== QUEUE_RESOLUTION_ERROR_MESSAGES[error.code]) {
      context.addIssue({
        code: "custom",
        message: "Queue resolution errors use fixed safe copy.",
      });
    }
  });
export type QueueResolutionError = z.infer<typeof QueueResolutionErrorSchema>;

export const QueueResolutionResultSchema = z
  .object({
    status: z.enum([
      "recorded",
      "existing",
      "rejected",
      "unavailable",
      "durability_unknown",
    ]),
    decisionId: QueueUuidSchema,
    decisionHash: QueueHashSchema,
    resolution: QueueResolutionRecordSchema.nullable(),
    error: QueueResolutionErrorSchema.nullable(),
  })
  .strict()
  .superRefine((result, context) => {
    const successful =
      result.status === "recorded" || result.status === "existing";
    const unknown = result.status === "durability_unknown";
    if (
      successful !== (result.resolution !== null) ||
      successful === (result.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Successful resolution results contain only a record; unsuccessful results contain only an error.",
      });
    }
    if (
      result.resolution !== null &&
      (result.resolution.decisionId !== result.decisionId ||
        result.resolution.decisionHash !== result.decisionHash)
    ) {
      context.addIssue({
        code: "custom",
        message: "Resolution result and record identities must agree.",
      });
    }
    if (unknown !== (result.error?.code === "RESOLUTION_DURABILITY_UNKNOWN")) {
      context.addIssue({
        code: "custom",
        message:
          "Only a durability-unknown result uses the durability-unknown error.",
      });
    }
  });
export type QueueResolutionResult = z.infer<typeof QueueResolutionResultSchema>;

export const QueueSourceConflictKindSchema = z.enum([
  "source_changed_after_decision",
  "source_unavailable_after_decision",
  "duplicate_current_item",
]);
export type QueueSourceConflictKind = z.infer<
  typeof QueueSourceConflictKindSchema
>;

export const QueueSourceConflictSchema = z
  .object({
    conflictId: QueueHashSchema,
    kind: QueueSourceConflictKindSchema,
    decisionCount: z.number().int().positive().max(MAX_QUEUE_DECISIONS),
    relatedSourceIds: z
      .array(PaciumIdentifierSchema)
      .max(MAX_PACIUM_QUEUE_SOURCES),
    observedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((conflict, context) => {
    const duplicate = conflict.kind === "duplicate_current_item";
    if (duplicate !== conflict.relatedSourceIds.length > 0) {
      context.addIssue({
        code: "custom",
        message:
          "Only duplicate-current-item conflicts name related accepted sources.",
      });
    }
  });
export type QueueSourceConflict = z.infer<typeof QueueSourceConflictSchema>;

export const QueueSourceConflictsSchema = z
  .array(QueueSourceConflictSchema)
  .max(MAX_QUEUE_SOURCE_CONFLICTS);

export const QueuePriorDecisionReferenceSchema = z
  .object({
    decisionId: QueueUuidSchema,
    decisionHash: QueueHashSchema,
    itemId: QueueHashSchema,
    itemType: z.enum(["question", "approval"]),
    decidedAt: z.string().datetime(),
  })
  .strict();
export type QueuePriorDecisionReference = z.infer<
  typeof QueuePriorDecisionReferenceSchema
>;

export const QueuePriorDecisionListSchema = z
  .object({
    decisions: z
      .array(QueuePriorDecisionReferenceSchema)
      .max(MAX_QUEUE_ITEM_PRIOR_DECISIONS),
    truncated: z.boolean(),
  })
  .strict();
export type QueuePriorDecisionList = z.infer<
  typeof QueuePriorDecisionListSchema
>;

export const QueueArtifactObservationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("transport_artifact_present"),
      source: z.literal("filesystem_observed"),
      observedAt: z.string().datetime(),
      reason: z.null(),
      byteLength: z.number().int().positive().safe(),
      contentHash: QueueHashSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("acknowledgement_unavailable"),
      source: z.enum(["filesystem_observed", "provider_unavailable"]),
      observedAt: z.string().datetime(),
      reason: z.enum(["answer_file_missing", "role_prompt_unobserved"]),
      byteLength: z.null(),
      contentHash: z.null(),
    })
    .strict()
    .superRefine((observation, context) => {
      const valid =
        (observation.reason === "answer_file_missing" &&
          observation.source === "filesystem_observed") ||
        (observation.reason === "role_prompt_unobserved" &&
          observation.source === "provider_unavailable");
      if (!valid) {
        context.addIssue({
          code: "custom",
          message:
            "Acknowledgement-unavailable reason and evidence source must agree.",
        });
      }
    }),
  z
    .object({
      status: z.literal("target_conflict"),
      source: z.literal("filesystem_observed"),
      observedAt: z.string().datetime(),
      reason: z.enum([
        "answer_file_changed",
        "answer_file_unsafe",
        "answer_file_oversized",
        "answer_file_unreadable",
      ]),
      byteLength: z.number().int().nonnegative().safe().nullable(),
      contentHash: QueueHashSchema.nullable(),
    })
    .strict(),
]);
export type QueueArtifactObservation = z.infer<
  typeof QueueArtifactObservationSchema
>;

export const QueueLifecycleStateSchema = z
  .object({
    status: z.enum([
      "awaiting_evidence",
      "acknowledged",
      "applied",
      "unable_to_apply",
      "confirmed_not_delivered",
      "superseded",
    ]),
    current: QueueResolutionRecordSchema.nullable(),
    history: z.array(QueueResolutionRecordSchema).max(2),
    historyTruncated: z.boolean(),
  })
  .strict()
  .superRefine((state, context) => {
    if (
      (state.status === "awaiting_evidence") !== (state.current === null) ||
      (state.current !== null && state.current.action !== state.status)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Lifecycle status must match its current immutable resolution.",
      });
    }
    if (
      state.current !== null &&
      state.history.at(-1)?.resolutionId !== state.current.resolutionId
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The current lifecycle resolution must be the last visible history record.",
      });
    }
  });
export type QueueLifecycleState = z.infer<typeof QueueLifecycleStateSchema>;

export function queueResolutionError(
  code: QueueResolutionErrorCode,
): QueueResolutionError {
  return {
    code,
    message: QUEUE_RESOLUTION_ERROR_MESSAGES[code],
  };
}
