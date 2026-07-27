import { z } from "zod";

import {
  PaciumAbsolutePathSchema,
  PaciumIdentifierSchema,
  PaciumLabelSchema,
} from "./pacium-config.js";
import { QueueResolutionActionSchema } from "./queue-reconciliation.js";

export const MAX_PACIUM_CONTEXT_SOURCE_BYTES = 32 * 1024;
export const MAX_PACIUM_RECENT_DECISIONS = 12;
export const MAX_PACIUM_DECISION_PREVIEW_BYTES = 320;

const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const UuidSchema = z.string().uuid();
const ContextKindSchema = z.enum(["objective", "plan"]);
const ContextFormatSchema = z.literal("plain_text");

const ContextSourceBase = {
  kind: ContextKindSchema,
  observedAt: z.string().datetime(),
};

const ConfiguredContextSourceBase = {
  ...ContextSourceBase,
  path: PaciumAbsolutePathSchema,
  format: ContextFormatSchema,
};

export const PaciumContextSourceErrorCodeSchema = z.enum([
  "missing",
  "changing",
  "oversized",
  "invalid_utf8",
  "unsafe_type",
  "unreadable",
]);
export type PaciumContextSourceErrorCode = z.infer<
  typeof PaciumContextSourceErrorCodeSchema
>;

export const PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES = {
  missing: "The configured context file is missing.",
  changing: "The configured context file changed while it was being read.",
  oversized: `The configured context file exceeds ${MAX_PACIUM_CONTEXT_SOURCE_BYTES} bytes.`,
  invalid_utf8: "The configured context file is not valid UTF-8.",
  unsafe_type:
    "The configured context source must be a regular non-symlink file.",
  unreadable: "The configured context file could not be read.",
} as const satisfies Record<PaciumContextSourceErrorCode, string>;

export const PaciumContextSourceErrorSchema = z
  .object({
    code: PaciumContextSourceErrorCodeSchema,
    message: z.string().min(1).max(160),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.message !== PACIUM_CONTEXT_SOURCE_ERROR_MESSAGES[error.code]) {
      context.addIssue({
        code: "custom",
        message: "Context source errors use fixed safe copy.",
      });
    }
  });

export const PaciumContextSourceObservationSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({
        ...ContextSourceBase,
        status: z.literal("unconfigured"),
        path: z.null(),
        format: z.null(),
        byteLength: z.null(),
        modifiedAt: z.null(),
        contentHash: z.null(),
        contentBase64: z.null(),
        error: z.null(),
      })
      .strict(),
    z
      .object({
        ...ConfiguredContextSourceBase,
        status: z.literal("ready"),
        byteLength: z
          .number()
          .int()
          .positive()
          .max(MAX_PACIUM_CONTEXT_SOURCE_BYTES),
        modifiedAt: z.string().datetime(),
        contentHash: HashSchema,
        contentBase64: z
          .string()
          .min(4)
          .max(Math.ceil(MAX_PACIUM_CONTEXT_SOURCE_BYTES / 3) * 4)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
          ),
        error: z.null(),
      })
      .strict(),
    z
      .object({
        ...ConfiguredContextSourceBase,
        status: z.literal("empty"),
        byteLength: z.literal(0),
        modifiedAt: z.string().datetime(),
        contentHash: HashSchema,
        contentBase64: z.null(),
        error: z.null(),
      })
      .strict(),
    z
      .object({
        ...ConfiguredContextSourceBase,
        status: PaciumContextSourceErrorCodeSchema,
        byteLength: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER)
          .nullable(),
        modifiedAt: z.string().datetime().nullable(),
        contentHash: z.null(),
        contentBase64: z.null(),
        error: PaciumContextSourceErrorSchema,
      })
      .strict()
      .superRefine((source, context) => {
        if (source.error.code !== source.status) {
          context.addIssue({
            code: "custom",
            message: "Context source status and error code must agree.",
          });
        }
      }),
  ],
);
export type PaciumContextSourceObservation = z.infer<
  typeof PaciumContextSourceObservationSchema
>;

const QuestionPreviewSchema = z
  .string()
  .max(MAX_PACIUM_DECISION_PREVIEW_BYTES)
  .refine(
    (value) =>
      new TextEncoder().encode(value).byteLength <=
      MAX_PACIUM_DECISION_PREVIEW_BYTES,
    {
      message: `Decision preview exceeds ${MAX_PACIUM_DECISION_PREVIEW_BYTES} UTF-8 bytes.`,
    },
  );

export const PaciumRecentDecisionResponseSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("question_answer"),
      preview: QuestionPreviewSchema,
      truncated: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("approval_decision"),
      outcome: z.enum(["approved", "denied"]),
    })
    .strict(),
]);

export const PaciumRecentDeliverySummarySchema = z
  .object({
    attemptCount: z.number().int().min(1).max(2),
    deliveryId: UuidSchema,
    deliveryHash: HashSchema,
    status: z.enum(["delivering", "delivered", "failed", "unknown"]),
    requestedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    evidenceKind: z
      .enum(["answer_file_created", "terminal_transport_accepted"])
      .nullable(),
  })
  .strict()
  .superRefine((delivery, context) => {
    const complete = delivery.status !== "delivering";
    if (complete !== (delivery.completedAt !== null)) {
      context.addIssue({
        code: "custom",
        message:
          "Completed recent delivery evidence requires a completion time.",
      });
    }
    if (
      (delivery.status === "delivered") !==
      (delivery.evidenceKind !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Only delivered recent delivery evidence contains an evidence kind.",
      });
    }
  });

export const PaciumRecentLifecycleSummarySchema = z
  .object({
    resolutionId: UuidSchema,
    resolutionHash: HashSchema,
    action: QueueResolutionActionSchema,
    source: z.literal("human_labelled"),
    actorLabel: z.literal("Local operator"),
    recordedAt: z.string().datetime(),
  })
  .strict();

export const PaciumRecentDecisionSummarySchema = z
  .object({
    decisionId: UuidSchema,
    decisionHash: HashSchema,
    workspaceId: PaciumIdentifierSchema,
    sourceId: PaciumIdentifierSchema,
    sourceLabel: PaciumLabelSchema.nullable(),
    sourceCurrent: z.boolean(),
    itemId: HashSchema,
    contentHash: HashSchema,
    decidedAt: z.string().datetime(),
    actorLabel: z.literal("Local operator"),
    response: PaciumRecentDecisionResponseSchema,
    delivery: PaciumRecentDeliverySummarySchema.nullable(),
    lifecycle: PaciumRecentLifecycleSummarySchema.nullable(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.sourceCurrent !== (decision.sourceLabel !== null)) {
      context.addIssue({
        code: "custom",
        message:
          "A current recent decision source requires its accepted label.",
      });
    }
  });
export type PaciumRecentDecisionSummary = z.infer<
  typeof PaciumRecentDecisionSummarySchema
>;

export const PaciumRecentDecisionStateSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ready"),
      decisions: z
        .array(PaciumRecentDecisionSummarySchema)
        .max(MAX_PACIUM_RECENT_DECISIONS),
      truncated: z.boolean(),
      error: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      decisions: z.tuple([]),
      truncated: z.literal(false),
      error: z
        .object({
          code: z.literal("decision_state_unavailable"),
          message: z.literal(
            "Recent decision state is unavailable. Context files and terminals remain available.",
          ),
        })
        .strict(),
    })
    .strict(),
]);

export const PaciumContextObservationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.enum(["ready", "partial"]),
      workspaceId: PaciumIdentifierSchema,
      workspaceRevision: z.number().int().positive().safe(),
      objective: PaciumContextSourceObservationSchema,
      plan: PaciumContextSourceObservationSchema,
      recentDecisions: PaciumRecentDecisionStateSchema,
      observedAt: z.string().datetime(),
      error: z.null(),
    })
    .strict()
    .superRefine((observation, context) => {
      if (
        observation.objective.kind !== "objective" ||
        observation.plan.kind !== "plan"
      ) {
        context.addIssue({
          code: "custom",
          message: "Context observation source kinds must be fixed.",
        });
      }
      const fullyAvailable =
        ["ready", "empty", "unconfigured"].includes(
          observation.objective.status,
        ) &&
        ["ready", "empty", "unconfigured"].includes(observation.plan.status) &&
        observation.recentDecisions.status === "ready";
      if ((observation.status === "ready") !== fullyAvailable) {
        context.addIssue({
          code: "custom",
          message:
            "Context observation status must reflect its source availability.",
        });
      }
    }),
  z
    .object({
      status: z.literal("unavailable"),
      workspaceId: z.null(),
      workspaceRevision: z.null(),
      objective: z.null(),
      plan: z.null(),
      recentDecisions: z.null(),
      observedAt: z.string().datetime(),
      error: z
        .object({
          code: z.enum(["config_unavailable", "config_drift"]),
          message: z.string().min(1).max(180),
        })
        .strict(),
    })
    .strict(),
]);
export type PaciumContextObservation = z.infer<
  typeof PaciumContextObservationSchema
>;
