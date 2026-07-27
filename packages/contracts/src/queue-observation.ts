import { z } from "zod";

import {
  MAX_PACIUM_QUEUE_SOURCES,
  PaciumIdentifierSchema,
} from "./pacium-config.js";
import { QueueSourceClassificationSchema } from "./queue-classification.js";

export const MAX_QUEUE_SOURCE_BYTES = 64 * 1024;
export const MAX_QUEUE_OBSERVATION_ERROR_CHARS = 240;

export const QueueSourceObservationStatusSchema = z.enum([
  "pending",
  "stable",
  "empty",
  "missing",
  "changing",
  "oversized",
  "invalid_utf8",
  "unsafe_type",
  "read_error",
  "watch_error",
]);
export type QueueSourceObservationStatus = z.infer<
  typeof QueueSourceObservationStatusSchema
>;

export const QueueObservationErrorSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    message: z.string().min(1).max(MAX_QUEUE_OBSERVATION_ERROR_CHARS),
  })
  .strict();
export type QueueObservationError = z.infer<typeof QueueObservationErrorSchema>;

export const QueueSourceObservationSchema = z
  .object({
    sourceId: PaciumIdentifierSchema,
    observationRevision: z.number().int().positive().safe(),
    status: QueueSourceObservationStatusSchema,
    observedAt: z.string().datetime(),
    byteLength: z.number().int().nonnegative().safe().nullable(),
    modifiedAt: z.string().datetime().nullable(),
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    classification: QueueSourceClassificationSchema.nullable(),
    error: QueueObservationErrorSchema.nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const complete =
      observation.status === "stable" || observation.status === "empty";
    if (
      complete &&
      (observation.byteLength === null ||
        observation.modifiedAt === null ||
        observation.contentHash === null ||
        observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Complete queue observations require byte, modification, and hash evidence without an error.",
      });
    }
    if (
      (observation.status === "empty" && observation.byteLength !== 0) ||
      (observation.status === "stable" &&
        (observation.byteLength === null || observation.byteLength === 0))
    ) {
      context.addIssue({
        code: "custom",
        message: "Stable and empty queue observations require matching bytes.",
      });
    }
    if (!complete && observation.contentHash !== null) {
      context.addIssue({
        code: "custom",
        message: "Only complete queue observations can contain a content hash.",
      });
    }
    if (
      (observation.status === "stable") !==
      (observation.classification !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Only stable nonempty queue observations contain classification evidence.",
      });
    }
    const errorExpected =
      observation.status === "read_error" ||
      observation.status === "watch_error";
    if ((observation.error !== null) !== errorExpected) {
      context.addIssue({
        code: "custom",
        message:
          "Only queue read and watcher failures contain bounded error evidence.",
      });
    }
  });
export type QueueSourceObservation = z.infer<
  typeof QueueSourceObservationSchema
>;

export const QueueSourcesObservationSchema = z
  .object({
    status: z.enum(["unconfigured", "config_error", "ready"]),
    workspaceRevision: z.number().int().positive().safe().nullable(),
    observedAt: z.string().datetime(),
    sources: z
      .array(QueueSourceObservationSchema)
      .max(MAX_PACIUM_QUEUE_SOURCES),
    error: QueueObservationErrorSchema.nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const ready = observation.status === "ready";
    if (
      ready &&
      (observation.workspaceRevision === null || observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Ready queue observation requires a workspace revision and no error.",
      });
    }
    if (
      !ready &&
      (observation.workspaceRevision !== null || observation.sources.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Unavailable queue observation cannot contain workspace or source evidence.",
      });
    }
    if (
      (observation.status === "config_error") !==
      (observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Only queue configuration errors contain aggregate error evidence.",
      });
    }
    const sourceIds = new Set<string>();
    for (const [index, source] of observation.sources.entries()) {
      if (sourceIds.has(source.sourceId)) {
        context.addIssue({
          code: "custom",
          message: "Queue observation source identities must be unique.",
          path: ["sources", index, "sourceId"],
        });
      }
      sourceIds.add(source.sourceId);
    }
  });
export type QueueSourcesObservation = z.infer<
  typeof QueueSourcesObservationSchema
>;
