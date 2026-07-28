import { z } from "zod";

export const PROVIDER_OBSERVATION_CONTRACT_VERSION = 1 as const;
export const MAX_PROVIDER_CAPABILITIES = 12;
export const MAX_PROVIDER_ACTIVITIES = 32;
export const MAX_PROVIDER_DIAGNOSTICS = 8;
export const MAX_PROVIDER_DIAGNOSTIC_FIELDS = 12;

export const ProviderIdSchema = z.enum(["claude", "codex"]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const ProviderObservationSourceSchema = z.enum([
  "native",
  "hook",
  "none",
]);
export type ProviderObservationSource = z.infer<
  typeof ProviderObservationSourceSchema
>;

export const ProviderEvidenceConfidenceSchema = z.enum([
  "confirmed",
  "high",
  "medium",
  "low",
]);
export type ProviderEvidenceConfidence = z.infer<
  typeof ProviderEvidenceConfidenceSchema
>;

export const ProviderCapabilityIdSchema = z.enum([
  "attention",
  "activity",
  "tools",
  "approvals",
  "questions",
  "plan",
  "usage",
  "completion",
]);
export type ProviderCapabilityId = z.infer<typeof ProviderCapabilityIdSchema>;

export const ProviderCapabilitySchema = z
  .object({
    id: ProviderCapabilityIdSchema,
    availability: z.enum(["supported", "unsupported", "unknown"]),
    source: ProviderObservationSourceSchema,
    confidence: ProviderEvidenceConfidenceSchema,
    detail: z.string().min(1).max(200),
  })
  .strict()
  .superRefine((capability, context) => {
    if (
      capability.availability === "supported" &&
      capability.source === "none"
    ) {
      context.addIssue({
        code: "custom",
        message: "A supported capability requires provider evidence.",
      });
    }
    if (
      capability.availability === "unknown" &&
      (capability.source !== "none" || capability.confidence !== "low")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "An unknown capability must remain low-confidence and unobserved.",
      });
    }
  });
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

export const ProviderHealthSchema = z
  .object({
    state: z.enum([
      "unavailable",
      "ready",
      "degraded",
      "failed",
      "unsupported",
    ]),
    source: ProviderObservationSourceSchema,
    confidence: ProviderEvidenceConfidenceSchema,
    detail: z.string().min(1).max(300),
  })
  .strict()
  .superRefine((health, context) => {
    if (health.state === "ready" && health.source === "none") {
      context.addIssue({
        code: "custom",
        message: "Ready provider health requires provider evidence.",
      });
    }
    if (
      health.state === "unavailable" &&
      (health.source !== "none" || health.confidence !== "low")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Unavailable provider health must remain low-confidence and unobserved.",
      });
    }
  });
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

export const ProviderAttentionSchema = z
  .object({
    state: z.enum([
      "working",
      "waiting",
      "needs_input",
      "finished",
      "failed",
      "unknown",
    ]),
    source: z.enum(["native", "hook"]),
    confidence: ProviderEvidenceConfidenceSchema,
    observedAt: z.string().datetime(),
    staleAfter: z.string().datetime(),
    reason: z.string().min(1).max(300),
  })
  .strict()
  .superRefine((attention, context) => {
    if (Date.parse(attention.staleAfter) < Date.parse(attention.observedAt)) {
      context.addIssue({
        code: "custom",
        message: "Provider attention cannot expire before it was observed.",
      });
    }
  });
export type ProviderAttention = z.infer<typeof ProviderAttentionSchema>;

export const ClaudeActivityExtensionSchema = z
  .object({
    provider: z.literal("claude"),
    eventType: z.enum([
      "session_start",
      "prompt_submit",
      "tool_start",
      "tool_complete",
      "permission_request",
      "question_request",
      "subagent_start",
      "subagent_stop",
      "task_update",
      "completion",
      "failure",
      "status",
    ]),
    providerSessionId: z.string().min(1).max(200).nullable(),
    toolName: z.string().min(1).max(120).nullable(),
    modelId: z.string().min(1).max(120).nullable(),
    contextUsedPercent: z.number().min(0).max(100).nullable(),
    totalCostUsd: z.number().finite().nonnegative().max(1_000_000).nullable(),
    totalInputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalOutputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict();

export const CodexActivityExtensionSchema = z
  .object({
    provider: z.literal("codex"),
    eventType: z.enum([
      "thread_start",
      "turn_start",
      "item_start",
      "item_complete",
      "plan_update",
      "approval_request",
      "question_request",
      "usage_update",
      "turn_complete",
      "failure",
    ]),
    threadId: z.string().min(1).max(200).nullable(),
    turnId: z.string().min(1).max(200).nullable(),
    itemType: z.string().min(1).max(120).nullable(),
    modelContextWindow: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalInputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalCachedInputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalOutputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalReasoningOutputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    totalTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict();

export const ProviderActivityExtensionSchema = z.discriminatedUnion(
  "provider",
  [ClaudeActivityExtensionSchema, CodexActivityExtensionSchema],
);
export type ProviderActivityExtension = z.infer<
  typeof ProviderActivityExtensionSchema
>;

export const ProviderActivityKindSchema = z.enum([
  "session_started",
  "prompt_submitted",
  "turn_started",
  "message",
  "tool_started",
  "tool_completed",
  "plan_updated",
  "approval_requested",
  "question_requested",
  "usage_updated",
  "turn_completed",
  "session_completed",
  "failed",
]);
export type ProviderActivityKind = z.infer<typeof ProviderActivityKindSchema>;

export const ProviderActivitySchema = z
  .object({
    id: z.string().min(1).max(160),
    kind: ProviderActivityKindSchema,
    source: z.enum(["native", "hook"]),
    confidence: ProviderEvidenceConfidenceSchema,
    occurredAt: z.string().datetime(),
    observedAt: z.string().datetime(),
    summary: z.string().min(1).max(300),
    extension: ProviderActivityExtensionSchema,
  })
  .strict()
  .superRefine((activity, context) => {
    if (Date.parse(activity.observedAt) < Date.parse(activity.occurredAt)) {
      context.addIssue({
        code: "custom",
        message: "Provider activity cannot be observed before it occurred.",
      });
    }
  });
export type ProviderActivity = z.infer<typeof ProviderActivitySchema>;

const ProviderDiagnosticScalarSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const SENSITIVE_DIAGNOSTIC_KEY =
  /(?:^|[_.-])(authorization|cookie|credential|env|environment|input|output|password|prompt|secret|token|transcript)(?:$|[_.-])/i;

export const ProviderDiagnosticFieldSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    value: ProviderDiagnosticScalarSchema,
  })
  .strict()
  .superRefine((field, context) => {
    if (SENSITIVE_DIAGNOSTIC_KEY.test(field.name)) {
      context.addIssue({
        code: "custom",
        message: "Secret-bearing provider diagnostic fields are prohibited.",
      });
    }
  });

export const ProviderDiagnosticSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1).max(300),
    observedAt: z.string().datetime(),
    fields: z
      .array(ProviderDiagnosticFieldSchema)
      .max(MAX_PROVIDER_DIAGNOSTIC_FIELDS),
  })
  .strict()
  .superRefine((diagnostic, context) => {
    rejectDuplicates(
      diagnostic.fields.map(({ name }) => name),
      "Provider diagnostic field names must be unique.",
      context,
    );
  });
export type ProviderDiagnostic = z.infer<typeof ProviderDiagnosticSchema>;

export const ProviderObservationSnapshotSchema = z
  .object({
    contractVersion: z.literal(PROVIDER_OBSERVATION_CONTRACT_VERSION),
    provider: ProviderIdSchema,
    adapterVersion: z.string().min(1).max(40),
    providerVersion: z.string().min(1).max(80).nullable(),
    health: ProviderHealthSchema,
    capabilities: z
      .array(ProviderCapabilitySchema)
      .max(MAX_PROVIDER_CAPABILITIES),
    attention: ProviderAttentionSchema.nullable(),
    activities: z.array(ProviderActivitySchema).max(MAX_PROVIDER_ACTIVITIES),
    diagnostics: z
      .array(ProviderDiagnosticSchema)
      .max(MAX_PROVIDER_DIAGNOSTICS),
    observedAt: z.string().datetime(),
    staleAfter: z.string().datetime(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (Date.parse(snapshot.staleAfter) < Date.parse(snapshot.observedAt)) {
      context.addIssue({
        code: "custom",
        message: "Provider snapshot cannot expire before it was observed.",
      });
    }
    rejectDuplicates(
      snapshot.capabilities.map(({ id }) => id),
      "Provider capability IDs must be unique.",
      context,
    );
    rejectDuplicates(
      snapshot.activities.map(({ id }) => id),
      "Provider activity IDs must be unique.",
      context,
    );
    for (const [index, activity] of snapshot.activities.entries()) {
      if (activity.extension.provider !== snapshot.provider) {
        context.addIssue({
          code: "custom",
          message: "Provider activity extension must match its snapshot.",
          path: ["activities", index, "extension", "provider"],
        });
      }
    }
  });
export type ProviderObservationSnapshot = z.infer<
  typeof ProviderObservationSnapshotSchema
>;

function rejectDuplicates(
  values: readonly string[],
  message: string,
  context: z.RefinementCtx,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message });
  }
}
