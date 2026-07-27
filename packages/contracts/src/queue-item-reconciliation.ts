import { z } from "zod";

import {
  QueueDeliveryRecordSchema,
  type QueueDeliveryRecord,
} from "./queue-delivery.js";
import {
  QueueArtifactObservationSchema,
  QueueLifecycleStateSchema,
  QueuePriorDecisionListSchema,
  QueueSourceConflictsSchema,
  type QueueLifecycleState,
} from "./queue-reconciliation.js";

const QueueHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const QueueRetryStateSchema = z
  .object({
    status: z.enum(["not_applicable", "locked", "ready", "exhausted"]),
  })
  .strict();
export type QueueRetryState = z.infer<typeof QueueRetryStateSchema>;

export const QueueItemReconciliationSchema = z
  .object({
    decisionId: z.string().uuid(),
    decisionHash: QueueHashSchema,
    conflicts: QueueSourceConflictsSchema,
    priorDecisions: QueuePriorDecisionListSchema,
    attempts: z.array(QueueDeliveryRecordSchema).max(2),
    artifact: QueueArtifactObservationSchema.nullable(),
    lifecycle: QueueLifecycleStateSchema,
    retry: QueueRetryStateSchema,
  })
  .strict()
  .superRefine((state, context) => {
    if (
      state.attempts.some(
        (attempt) =>
          attempt.decisionId !== state.decisionId ||
          attempt.decisionHash !== state.decisionHash,
      ) ||
      state.lifecycle.history.some(
        (resolution) =>
          resolution.decisionId !== state.decisionId ||
          resolution.decisionHash !== state.decisionHash,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Item reconciliation evidence must reference one immutable decision.",
      });
    }
    const expectedRetry = retryStatus(state.attempts, state.lifecycle);
    if (state.retry.status !== expectedRetry) {
      context.addIssue({
        code: "custom",
        message:
          "Retry status must match immutable attempts and lifecycle evidence.",
      });
    }
    if ((state.artifact !== null) !== state.attempts.length > 0) {
      context.addIssue({
        code: "custom",
        message:
          "Artifact reconciliation exists exactly when a delivery attempt exists.",
      });
    }
  });
export type QueueItemReconciliation = z.infer<
  typeof QueueItemReconciliationSchema
>;

function retryStatus(
  attempts: QueueDeliveryRecord[],
  lifecycle: QueueLifecycleState,
): QueueRetryState["status"] {
  if (attempts.length === 0) {
    return "not_applicable";
  }
  if (attempts.length === 2) {
    return "exhausted";
  }
  const attempt = attempts[0];
  if (
    attempt?.outcome?.status === "delivered" ||
    lifecycle.status === "acknowledged" ||
    lifecycle.status === "applied" ||
    lifecycle.status === "unable_to_apply" ||
    lifecycle.status === "superseded"
  ) {
    return "not_applicable";
  }
  return lifecycle.status === "confirmed_not_delivered" ? "ready" : "locked";
}
