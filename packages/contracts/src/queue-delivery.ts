import { z } from "zod";

import {
  PaciumAbsolutePathSchema,
  PaciumIdentifierSchema,
  PaciumLabelSchema,
  PaciumRoleIdSchema,
} from "./pacium-config.js";
import {
  MAX_QUEUE_DECISIONS,
  QueueApprovalDecisionPayloadSchema,
  QueueDecisionRecordSchema,
  QueueQuestionAnswerPayloadSchema,
  QueueStateV1DocumentSchema,
} from "./queue-decision.js";
import {
  MAX_QUEUE_RESOLUTIONS,
  QueueResolutionRecordSchema,
} from "./queue-reconciliation.js";

export const QUEUE_STATE_SCHEMA_VERSION_V2 = 2 as const;
export const QUEUE_STATE_SCHEMA_VERSION = 3 as const;
export const MAX_QUEUE_DELIVERIES = 4096;
export const MAX_QUEUE_DELIVERIES_V3 = MAX_QUEUE_DELIVERIES * 2;
export const MAX_QUEUE_DELIVERY_PAYLOAD_BYTES = 16 * 1024;

const QueueHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const SessionIdSchema = z.string().uuid();

export const QueueAnswerFileTargetSchema = z
  .object({
    type: z.literal("answer_file"),
    methodId: PaciumIdentifierSchema,
    methodLabel: PaciumLabelSchema,
    path: PaciumAbsolutePathSchema,
  })
  .strict();

export const QueueRolePromptTargetSchema = z
  .object({
    type: z.literal("role_prompt"),
    methodId: PaciumIdentifierSchema,
    methodLabel: PaciumLabelSchema,
    role: PaciumRoleIdSchema,
    sessionId: SessionIdSchema,
    sessionEpoch: z.number().int().positive(),
  })
  .strict();

export const QueueDeliveryTargetSchema = z.discriminatedUnion("type", [
  QueueAnswerFileTargetSchema,
  QueueRolePromptTargetSchema,
]);
export type QueueDeliveryTarget = z.infer<typeof QueueDeliveryTargetSchema>;

export const QueueAnswerFileDeliveryEvidenceSchema = z
  .object({
    kind: z.literal("answer_file_created"),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(MAX_QUEUE_DELIVERY_PAYLOAD_BYTES),
    contentHash: QueueHashSchema,
  })
  .strict();
export type QueueAnswerFileDeliveryEvidence = z.infer<
  typeof QueueAnswerFileDeliveryEvidenceSchema
>;

export const QueueRolePromptDeliveryEvidenceSchema = z
  .object({
    kind: z.literal("terminal_transport_accepted"),
    sessionId: SessionIdSchema,
    sessionEpoch: z.number().int().positive(),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(MAX_QUEUE_DELIVERY_PAYLOAD_BYTES),
    contentHash: QueueHashSchema,
  })
  .strict();
export type QueueRolePromptDeliveryEvidence = z.infer<
  typeof QueueRolePromptDeliveryEvidenceSchema
>;

export const QueueDeliveryEvidenceSchema = z.discriminatedUnion("kind", [
  QueueAnswerFileDeliveryEvidenceSchema,
  QueueRolePromptDeliveryEvidenceSchema,
]);
export type QueueDeliveryEvidence = z.infer<typeof QueueDeliveryEvidenceSchema>;

export const QueueDeliveryErrorCodeSchema = z.enum([
  "DECISION_NOT_FOUND",
  "DECISION_HASH_MISMATCH",
  "DELIVERY_NOT_CONFIGURED",
  "DELIVERY_ITEM_STALE",
  "DELIVERY_CONFIG_UNAVAILABLE",
  "DELIVERY_TARGET_UNAVAILABLE",
  "DELIVERY_TARGET_OCCUPIED",
  "DELIVERY_STATE_UNAVAILABLE",
  "DELIVERY_STATE_FULL",
  "DELIVERY_WRITE_FAILED",
  "DELIVERY_DURABILITY_UNKNOWN",
  "DELIVERY_OUTCOME_UNKNOWN",
]);
export type QueueDeliveryErrorCode = z.infer<
  typeof QueueDeliveryErrorCodeSchema
>;

export const QUEUE_DELIVERY_ERROR_MESSAGES = {
  DECISION_NOT_FOUND:
    "The immutable decision is unavailable. No delivery was attempted.",
  DECISION_HASH_MISMATCH:
    "The decision identity no longer matches. No delivery was attempted.",
  DELIVERY_NOT_CONFIGURED:
    "This queue source has no configured delivery method.",
  DELIVERY_ITEM_STALE:
    "The decided queue item is no longer current. No delivery was attempted.",
  DELIVERY_CONFIG_UNAVAILABLE:
    "The accepted Pacium configuration is unavailable or changed. No delivery was attempted.",
  DELIVERY_TARGET_UNAVAILABLE:
    "The configured delivery target is unavailable. No other target was used.",
  DELIVERY_TARGET_OCCUPIED:
    "The configured answer file already exists. Pacium did not overwrite it.",
  DELIVERY_STATE_UNAVAILABLE:
    "Delivery state is unavailable. No delivery was attempted.",
  DELIVERY_STATE_FULL:
    "Delivery state reached its safe bound. No delivery was attempted.",
  DELIVERY_WRITE_FAILED:
    "The configured transport failed before delivery could be confirmed.",
  DELIVERY_DURABILITY_UNKNOWN:
    "Delivery intent durability is unknown. Pacium did not invoke the configured transport.",
  DELIVERY_OUTCOME_UNKNOWN:
    "The delivery side effect may have occurred, but its durable outcome is unknown. Pacium will not retry it.",
} as const satisfies Record<QueueDeliveryErrorCode, string>;

export const QueueDeliveryErrorSchema = z
  .object({
    code: QueueDeliveryErrorCodeSchema,
    message: z.string().min(1).max(240),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.message !== QUEUE_DELIVERY_ERROR_MESSAGES[error.code]) {
      context.addIssue({
        code: "custom",
        message: "Queue delivery errors use fixed safe copy.",
      });
    }
  });
export type QueueDeliveryError = z.infer<typeof QueueDeliveryErrorSchema>;

export const QueueDeliveryOutcomeSchema = z
  .object({
    status: z.enum(["delivered", "failed", "unknown"]),
    recordedAt: z.string().datetime(),
    evidence: QueueDeliveryEvidenceSchema.nullable(),
    error: QueueDeliveryErrorSchema.nullable(),
  })
  .strict()
  .superRefine((outcome, context) => {
    if (
      outcome.status === "delivered" &&
      (outcome.evidence === null || outcome.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Delivered outcomes require evidence and no error.",
      });
    }
    if (
      outcome.status !== "delivered" &&
      (outcome.evidence !== null || outcome.error === null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Failed or unknown outcomes require one error and no evidence.",
      });
    }
  });
export type QueueDeliveryOutcome = z.infer<typeof QueueDeliveryOutcomeSchema>;

export const QueueDeliveryRecordSchema = z
  .object({
    deliveryId: z.string().uuid(),
    decisionId: z.string().uuid(),
    decisionHash: QueueHashSchema,
    target: QueueDeliveryTargetSchema,
    payloadHash: QueueHashSchema,
    payloadByteLength: z
      .number()
      .int()
      .positive()
      .max(MAX_QUEUE_DELIVERY_PAYLOAD_BYTES),
    requestedAt: z.string().datetime(),
    outcome: QueueDeliveryOutcomeSchema.nullable(),
    deliveryHash: QueueHashSchema,
  })
  .strict();
export type QueueDeliveryRecord = z.infer<typeof QueueDeliveryRecordSchema>;

export const QueueStateV2DocumentSchema = z
  .object({
    schemaVersion: z.literal(QUEUE_STATE_SCHEMA_VERSION_V2),
    revision: z.number().int().positive().safe(),
    decisions: z.array(QueueDecisionRecordSchema).max(MAX_QUEUE_DECISIONS),
    deliveries: z.array(QueueDeliveryRecordSchema).max(MAX_QUEUE_DELIVERIES),
  })
  .strict()
  .superRefine((document, context) => {
    const decisions = new Map(
      document.decisions.map((decision) => [decision.decisionId, decision]),
    );
    const deliveryIds = new Set<string>();
    const deliveredDecisions = new Set<string>();
    for (const [index, delivery] of document.deliveries.entries()) {
      const decision = decisions.get(delivery.decisionId);
      if (
        decision === undefined ||
        decision.decisionHash !== delivery.decisionHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["deliveries", index, "decisionId"],
          message:
            "A queue delivery must reference one matching immutable decision.",
        });
      }
      if (deliveryIds.has(delivery.deliveryId)) {
        context.addIssue({
          code: "custom",
          path: ["deliveries", index, "deliveryId"],
          message: "Queue delivery IDs must be unique.",
        });
      }
      if (deliveredDecisions.has(delivery.decisionId)) {
        context.addIssue({
          code: "custom",
          path: ["deliveries", index, "decisionId"],
          message: "A queue decision can contain only one delivery attempt.",
        });
      }
      deliveryIds.add(delivery.deliveryId);
      deliveredDecisions.add(delivery.decisionId);
    }
  });
export type QueueStateV2Document = z.infer<typeof QueueStateV2DocumentSchema>;

export const QueueStateV3DocumentSchema = z
  .object({
    schemaVersion: z.literal(QUEUE_STATE_SCHEMA_VERSION),
    revision: z.number().int().positive().safe(),
    decisions: z.array(QueueDecisionRecordSchema).max(MAX_QUEUE_DECISIONS),
    deliveries: z.array(QueueDeliveryRecordSchema).max(MAX_QUEUE_DELIVERIES_V3),
    resolutions: z
      .array(QueueResolutionRecordSchema)
      .max(MAX_QUEUE_RESOLUTIONS),
  })
  .strict()
  .superRefine(validateQueueStateV3);
export type QueueStateV3Document = z.infer<typeof QueueStateV3DocumentSchema>;

export const QueueStateDocumentSchema = z.union([
  QueueStateV1DocumentSchema,
  QueueStateV2DocumentSchema,
  QueueStateV3DocumentSchema,
]);
export type QueueStateDocument = z.infer<typeof QueueStateDocumentSchema>;

export const QueueAnswerFileDocumentSchema = z
  .object({
    format: z.literal("pacium_decision_v1"),
    decision: QueueDecisionRecordSchema,
  })
  .strict();
export type QueueAnswerFileDocument = z.infer<
  typeof QueueAnswerFileDocumentSchema
>;

export const QueueRolePromptDocumentSchema = z
  .object({
    format: z.literal("pacium_decision_v1"),
    decisionId: z.string().uuid(),
    decisionHash: QueueHashSchema,
    kind: z.enum(["question_answer", "approval_decision"]),
    payload: z.union([
      QueueQuestionAnswerPayloadSchema,
      QueueApprovalDecisionPayloadSchema,
    ]),
  })
  .strict();
export type QueueRolePromptDocument = z.infer<
  typeof QueueRolePromptDocumentSchema
>;

const QueueDeliveryStateBase = {
  decisionId: z.string().uuid(),
  decisionHash: QueueHashSchema,
};

export const QueueDeliveryStateSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("not_configured"),
      ...QueueDeliveryStateBase,
      target: z.null(),
      delivery: z.null(),
      error: QueueDeliveryErrorSchema,
    })
    .strict()
    .superRefine((state, context) => {
      if (state.error.code !== "DELIVERY_NOT_CONFIGURED") {
        context.addIssue({
          code: "custom",
          message:
            "An unconfigured delivery state requires the fixed not-configured error.",
        });
      }
    }),
  z
    .object({
      status: z.literal("ready"),
      ...QueueDeliveryStateBase,
      target: QueueDeliveryTargetSchema,
      delivery: z.null(),
      error: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.enum(["delivering", "delivered", "failed", "unknown"]),
      ...QueueDeliveryStateBase,
      target: QueueDeliveryTargetSchema,
      delivery: QueueDeliveryRecordSchema,
      error: QueueDeliveryErrorSchema.nullable(),
    })
    .strict()
    .superRefine((state, context) => {
      if (
        state.delivery.decisionId !== state.decisionId ||
        state.delivery.decisionHash !== state.decisionHash
      ) {
        context.addIssue({
          code: "custom",
          message: "Delivery state and record decision identities must agree.",
        });
      }
      const outcomeStatus = state.delivery.outcome?.status ?? null;
      const valid =
        (state.status === "delivering" &&
          outcomeStatus === null &&
          state.error === null) ||
        (state.status === "delivered" &&
          outcomeStatus === "delivered" &&
          state.error === null) ||
        (state.status === "failed" &&
          outcomeStatus === "failed" &&
          state.error?.code === state.delivery.outcome?.error?.code) ||
        (state.status === "unknown" &&
          (outcomeStatus === null || outcomeStatus === "unknown") &&
          state.error?.code === "DELIVERY_OUTCOME_UNKNOWN");
      if (!valid) {
        context.addIssue({
          code: "custom",
          message: "Delivery state must agree with its durable outcome.",
        });
      }
    }),
  z
    .object({
      status: z.literal("unavailable"),
      ...QueueDeliveryStateBase,
      target: QueueDeliveryTargetSchema.nullable(),
      delivery: z.null(),
      error: QueueDeliveryErrorSchema,
    })
    .strict(),
]);
export type QueueDeliveryState = z.infer<typeof QueueDeliveryStateSchema>;

export const QueueDeliveryResultSchema = z
  .object({
    status: z.enum(["delivered", "failed", "unknown", "existing", "rejected"]),
    decisionId: z.string().uuid(),
    decisionHash: QueueHashSchema,
    state: QueueDeliveryStateSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (
      result.state.decisionId !== result.decisionId ||
      result.state.decisionHash !== result.decisionHash
    ) {
      context.addIssue({
        code: "custom",
        message: "Queue delivery result and state identities must agree.",
      });
    }
    const valid =
      (result.status === "delivered" && result.state.status === "delivered") ||
      (result.status === "failed" && result.state.status === "failed") ||
      (result.status === "unknown" && result.state.status === "unknown") ||
      (result.status === "existing" &&
        ["delivering", "delivered", "failed", "unknown"].includes(
          result.state.status,
        )) ||
      (result.status === "rejected" &&
        ["not_configured", "unavailable"].includes(result.state.status));
    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "Queue delivery result and state statuses must agree.",
      });
    }
  });
export type QueueDeliveryResult = z.infer<typeof QueueDeliveryResultSchema>;

export function queueDeliveryError(
  code: QueueDeliveryErrorCode,
): QueueDeliveryError {
  return {
    code,
    message: QUEUE_DELIVERY_ERROR_MESSAGES[code],
  };
}

function validateQueueStateV3(
  document: {
    decisions: z.infer<typeof QueueDecisionRecordSchema>[];
    deliveries: QueueDeliveryRecord[];
    resolutions: z.infer<typeof QueueResolutionRecordSchema>[];
  },
  context: z.core.$RefinementCtx,
): void {
  const decisions = new Map(
    document.decisions.map((decision) => [decision.decisionId, decision]),
  );
  const deliveries = new Map<string, QueueDeliveryRecord>();
  const deliveriesByDecision = new Map<string, QueueDeliveryRecord[]>();
  const deliveryHashes = new Set<string>();

  for (const [index, delivery] of document.deliveries.entries()) {
    const decision = decisions.get(delivery.decisionId);
    if (
      decision === undefined ||
      decision.decisionHash !== delivery.decisionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliveries", index, "decisionId"],
        message:
          "A queue delivery must reference one matching immutable decision.",
        input: delivery,
      });
    }
    if (
      deliveries.has(delivery.deliveryId) ||
      deliveryHashes.has(delivery.deliveryHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliveries", index],
        message: "Queue delivery identities and hashes must be unique.",
        input: delivery,
      });
    }
    deliveries.set(delivery.deliveryId, delivery);
    deliveryHashes.add(delivery.deliveryHash);
    const attempts = deliveriesByDecision.get(delivery.decisionId) ?? [];
    attempts.push(delivery);
    deliveriesByDecision.set(delivery.decisionId, attempts);
    if (attempts.length > 2) {
      context.addIssue({
        code: "custom",
        path: ["deliveries", index, "decisionId"],
        message: "A queue decision can contain at most two delivery attempts.",
        input: delivery,
      });
    }
    if (
      attempts.length === 2 &&
      (attempts[0]?.payloadHash !== delivery.payloadHash ||
        attempts[0]?.payloadByteLength !== delivery.payloadByteLength)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliveries", index, "payloadHash"],
        message:
          "A retry must preserve the immutable decision payload identity.",
        input: delivery,
      });
    }
  }

  const resolutionIds = new Set<string>();
  const resolutionHashes = new Set<string>();
  const resolutionsByDecision = new Map<
    string,
    z.infer<typeof QueueResolutionRecordSchema>[]
  >();

  for (const [index, resolution] of document.resolutions.entries()) {
    const decision = decisions.get(resolution.decisionId);
    if (
      decision === undefined ||
      decision.decisionHash !== resolution.decisionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["resolutions", index, "decisionId"],
        message:
          "A lifecycle resolution must reference one matching immutable decision.",
        input: resolution,
      });
    }
    if (
      resolutionIds.has(resolution.resolutionId) ||
      resolutionHashes.has(resolution.resolutionHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["resolutions", index],
        message: "Lifecycle resolution identities and hashes must be unique.",
        input: resolution,
      });
    }
    resolutionIds.add(resolution.resolutionId);
    resolutionHashes.add(resolution.resolutionHash);

    if (resolution.delivery !== null) {
      const delivery = deliveries.get(resolution.delivery.deliveryId);
      if (
        delivery === undefined ||
        delivery.deliveryHash !== resolution.delivery.deliveryHash ||
        delivery.decisionId !== resolution.decisionId
      ) {
        context.addIssue({
          code: "custom",
          path: ["resolutions", index, "delivery"],
          message:
            "A lifecycle resolution must reference a matching attempt for its decision.",
          input: resolution,
        });
      }
      if (
        resolution.action === "confirmed_not_delivered" &&
        delivery?.outcome?.status === "delivered"
      ) {
        context.addIssue({
          code: "custom",
          path: ["resolutions", index, "action"],
          message: "A delivered attempt cannot be confirmed as not delivered.",
          input: resolution,
        });
      }
    }

    if (resolution.relatedDecision !== null) {
      const related = decisions.get(resolution.relatedDecision.decisionId);
      if (
        decision === undefined ||
        related === undefined ||
        related.decisionHash !== resolution.relatedDecision.decisionHash ||
        related.source.workspaceId !== decision.source.workspaceId ||
        related.source.sourceId !== decision.source.sourceId ||
        related.source.itemId === decision.source.itemId
      ) {
        context.addIssue({
          code: "custom",
          path: ["resolutions", index, "relatedDecision"],
          message:
            "A superseding decision must be a distinct item from the same workspace source.",
          input: resolution,
        });
      }
    }

    const history = resolutionsByDecision.get(resolution.decisionId) ?? [];
    if (!isValidResolutionTransition(history, resolution.action)) {
      context.addIssue({
        code: "custom",
        path: ["resolutions", index, "action"],
        message:
          "Lifecycle resolutions must follow the bounded monotonic transition order.",
        input: resolution,
      });
    }
    history.push(resolution);
    resolutionsByDecision.set(resolution.decisionId, history);
  }

  for (const [decisionId, attempts] of deliveriesByDecision) {
    if (attempts.length !== 2) {
      continue;
    }
    const first = attempts[0];
    if (first === undefined) {
      continue;
    }
    const unlocked = document.resolutions.some(
      (resolution) =>
        resolution.decisionId === decisionId &&
        resolution.action === "confirmed_not_delivered" &&
        resolution.delivery?.deliveryId === first.deliveryId &&
        resolution.delivery?.deliveryHash === first.deliveryHash,
    );
    if (!unlocked) {
      context.addIssue({
        code: "custom",
        path: ["deliveries"],
        message:
          "A second delivery attempt requires an exact confirmed-not-delivered resolution for the first attempt.",
        input: attempts,
      });
    }
  }
}

function isValidResolutionTransition(
  history: z.infer<typeof QueueResolutionRecordSchema>[],
  next: z.infer<typeof QueueResolutionRecordSchema>["action"],
): boolean {
  const current = history.at(-1)?.action;
  if (current === undefined) {
    return true;
  }
  if (
    current === "applied" ||
    current === "unable_to_apply" ||
    current === "superseded"
  ) {
    return false;
  }
  if (current === "acknowledged") {
    return (
      next === "applied" || next === "unable_to_apply" || next === "superseded"
    );
  }
  return (
    next === "acknowledged" ||
    next === "applied" ||
    next === "unable_to_apply" ||
    next === "superseded"
  );
}
