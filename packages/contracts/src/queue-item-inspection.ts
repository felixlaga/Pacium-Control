import { z } from "zod";

import { PaciumIdentifierSchema } from "./pacium-config.js";
import { MAX_QUEUE_SOURCE_BYTES } from "./queue-observation.js";

export const MAX_QUEUE_ITEM_TEXT_BASE64_CHARS =
  Math.ceil(MAX_QUEUE_SOURCE_BYTES / 3) * 4;

const QueueHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const QueueItemInspectionIdentitySchema = z
  .object({
    workspaceRevision: z.number().int().positive().safe(),
    sourceId: PaciumIdentifierSchema,
    observationRevision: z.number().int().positive().safe(),
    contentHash: QueueHashSchema,
    itemId: QueueHashSchema,
  })
  .strict();
export type QueueItemInspectionIdentity = z.infer<
  typeof QueueItemInspectionIdentitySchema
>;

export const QueueItemInspectionErrorCodeSchema = z.enum([
  "ITEM_STALE",
  "QUEUE_UNAVAILABLE",
]);
export type QueueItemInspectionErrorCode = z.infer<
  typeof QueueItemInspectionErrorCodeSchema
>;

export const QUEUE_ITEM_INSPECTION_ERROR_MESSAGES = {
  ITEM_STALE:
    "This queue item is no longer current. The source file and terminals were not changed.",
  QUEUE_UNAVAILABLE:
    "Current queue evidence is unavailable. The source file and terminals were not changed.",
} as const satisfies Record<QueueItemInspectionErrorCode, string>;

export const QueueItemInspectionErrorSchema = z
  .object({
    code: QueueItemInspectionErrorCodeSchema,
    message: z.string().min(1).max(160),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.message !== QUEUE_ITEM_INSPECTION_ERROR_MESSAGES[error.code]) {
      context.addIssue({
        code: "custom",
        message: "Queue item inspection errors use fixed safe copy.",
      });
    }
  });

const QueueItemInspectionIdentityShape =
  QueueItemInspectionIdentitySchema.shape;

const ReadyQueueItemInspectionSchema = z
  .object({
    status: z.literal("ready"),
    ...QueueItemInspectionIdentityShape,
    sourceObservedAt: z.string().datetime(),
    firstObservedAt: z.string().datetime(),
    byteLength: z.number().int().positive().max(MAX_QUEUE_SOURCE_BYTES),
    encoding: z.literal("utf8_base64"),
    originalTextBase64: z
      .string()
      .min(1)
      .max(MAX_QUEUE_ITEM_TEXT_BASE64_CHARS)
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      ),
    error: z.null(),
  })
  .strict();

const UnavailableQueueItemInspectionSchema = z
  .object({
    status: z.enum(["stale", "unavailable"]),
    ...QueueItemInspectionIdentityShape,
    sourceObservedAt: z.string().datetime(),
    firstObservedAt: z.null(),
    byteLength: z.null(),
    encoding: z.null(),
    originalTextBase64: z.null(),
    error: QueueItemInspectionErrorSchema,
  })
  .strict()
  .superRefine((inspection, context) => {
    const expectedCode =
      inspection.status === "stale" ? "ITEM_STALE" : "QUEUE_UNAVAILABLE";
    if (inspection.error.code !== expectedCode) {
      context.addIssue({
        code: "custom",
        message: "Queue item inspection status and error code must agree.",
      });
    }
  });

export const QueueItemInspectionSchema = z.discriminatedUnion("status", [
  ReadyQueueItemInspectionSchema,
  UnavailableQueueItemInspectionSchema,
]);
export type QueueItemInspection = z.infer<typeof QueueItemInspectionSchema>;

export function queueItemInspectionError(code: QueueItemInspectionErrorCode): {
  code: QueueItemInspectionErrorCode;
  message: (typeof QUEUE_ITEM_INSPECTION_ERROR_MESSAGES)[QueueItemInspectionErrorCode];
} {
  return {
    code,
    message: QUEUE_ITEM_INSPECTION_ERROR_MESSAGES[code],
  };
}
