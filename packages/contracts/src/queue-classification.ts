import { z } from "zod";

export const MAX_QUEUE_CLASSIFICATION_DIAGNOSTICS = 4;
export const MAX_QUEUE_CLASSIFICATION_DIAGNOSTIC_CHARS = 160;
export const QUEUE_ITEM_BOUNDARY_VERSION = "whole_source_v1" as const;

export const QueueItemTypeSchema = z.enum([
  "question",
  "approval",
  "failure",
  "review",
  "unknown",
]);
export type QueueItemType = z.infer<typeof QueueItemTypeSchema>;

export const QueueItemConfidenceSchema = z.enum([
  "confirmed",
  "high",
  "medium",
  "low",
]);
export type QueueItemConfidence = z.infer<typeof QueueItemConfidenceSchema>;

export const QueueClassificationDiagnosticCodeSchema = z.enum([
  "blank_content",
  "legacy_marker",
  "question_heuristic",
  "unrecognized_format",
  "malformed_marker",
  "multiple_markers",
]);
export type QueueClassificationDiagnosticCode = z.infer<
  typeof QueueClassificationDiagnosticCodeSchema
>;

export const QUEUE_CLASSIFICATION_DIAGNOSTIC_MESSAGES = {
  blank_content: "The stable source contains only whitespace.",
  legacy_marker: "A supported plain-text legacy marker was used.",
  question_heuristic: "A final question mark suggests a question.",
  unrecognized_format: "No supported queue item marker was found.",
  malformed_marker: "A supported marker is missing a title or exact action.",
  multiple_markers: "Multiple queue items are not supported in one source yet.",
} as const satisfies Record<QueueClassificationDiagnosticCode, string>;

export const QueueClassificationDiagnosticSchema = z
  .object({
    code: QueueClassificationDiagnosticCodeSchema,
    message: z.string().min(1).max(MAX_QUEUE_CLASSIFICATION_DIAGNOSTIC_CHARS),
  })
  .strict()
  .superRefine((diagnostic, context) => {
    if (
      diagnostic.message !==
      QUEUE_CLASSIFICATION_DIAGNOSTIC_MESSAGES[diagnostic.code]
    ) {
      context.addIssue({
        code: "custom",
        message: "Queue classification diagnostics use fixed safe copy.",
      });
    }
  });
export type QueueClassificationDiagnostic = z.infer<
  typeof QueueClassificationDiagnosticSchema
>;

export const QueueItemCandidateSchema = z
  .object({
    itemId: z.string().regex(/^[0-9a-f]{64}$/),
    type: QueueItemTypeSchema,
    confidence: QueueItemConfidenceSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    if (
      candidate.type === "approval" &&
      candidate.confidence !== "confirmed" &&
      candidate.confidence !== "high"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Queue approvals require confirmed or high-confidence explicit markers.",
      });
    }
    if ((candidate.type === "unknown") !== (candidate.confidence === "low")) {
      context.addIssue({
        code: "custom",
        message: "Unknown queue items use low confidence exclusively.",
      });
    }
  });
export type QueueItemCandidate = z.infer<typeof QueueItemCandidateSchema>;

export const QueueSourceClassificationSchema = z
  .object({
    status: z.enum(["none", "candidate"]),
    boundary: z.literal(QUEUE_ITEM_BOUNDARY_VERSION),
    candidate: QueueItemCandidateSchema.nullable(),
    diagnostics: z
      .array(QueueClassificationDiagnosticSchema)
      .max(MAX_QUEUE_CLASSIFICATION_DIAGNOSTICS),
  })
  .strict()
  .superRefine((classification, context) => {
    if (
      (classification.status === "candidate") !==
      (classification.candidate !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Candidate queue classification requires exactly one candidate.",
      });
    }
    if (
      classification.status === "none" &&
      (classification.diagnostics.length !== 1 ||
        classification.diagnostics[0]?.code !== "blank_content")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "No-item queue classification requires the fixed blank diagnostic.",
      });
    }
    const codes = new Set<QueueClassificationDiagnosticCode>();
    for (const [index, diagnostic] of classification.diagnostics.entries()) {
      if (codes.has(diagnostic.code)) {
        context.addIssue({
          code: "custom",
          message: "Queue classification diagnostic codes must be unique.",
          path: ["diagnostics", index, "code"],
        });
      }
      codes.add(diagnostic.code);
    }
  });
export type QueueSourceClassification = z.infer<
  typeof QueueSourceClassificationSchema
>;

export function queueClassificationDiagnostic(
  code: QueueClassificationDiagnosticCode,
): QueueClassificationDiagnostic {
  return {
    code,
    message: QUEUE_CLASSIFICATION_DIAGNOSTIC_MESSAGES[code],
  };
}
