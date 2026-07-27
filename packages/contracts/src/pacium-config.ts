import { z } from "zod";

export const PACIUM_CONFIG_SCHEMA_VERSION = 1 as const;
export const MAX_PACIUM_CONFIG_BYTES = 128 * 1024;
export const MAX_PACIUM_IDENTIFIER_CHARS = 64;
export const MAX_PACIUM_LABEL_CHARS = 120;
export const MAX_PACIUM_PATH_CHARS = 4096;
export const MAX_PACIUM_REPOSITORIES = 32;
export const MAX_PACIUM_QUEUE_SOURCES = 32;
export const MAX_PACIUM_WORKERS = 64;
export const MAX_PACIUM_DELIVERY_METHODS = 16;
export const MAX_PACIUM_VERIFICATION_REFERENCES = 16;

export const PaciumIdentifierSchema = z
  .string()
  .min(1)
  .max(MAX_PACIUM_IDENTIFIER_CHARS)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/);

export const PaciumLabelSchema = z
  .string()
  .min(1)
  .max(MAX_PACIUM_LABEL_CHARS)
  .refine((value) => !hasControlCharacter(value), {
    message: "Label contains control characters.",
  });

export const PaciumAbsolutePathSchema = z
  .string()
  .min(1)
  .max(MAX_PACIUM_PATH_CHARS)
  .startsWith("/")
  .refine((value) => !hasControlCharacter(value), {
    message: "Path contains control characters.",
  });

export const PaciumSessionBindingSchema = z
  .object({
    type: z.literal("session"),
    sessionId: z.string().uuid(),
  })
  .strict();

export const PaciumLaunchPresetBindingSchema = z
  .object({
    type: z.literal("launch_preset"),
    launchPreset: z.enum(["shell", "codex", "claude"]),
    repositoryId: PaciumIdentifierSchema.nullable(),
  })
  .strict();

export const PaciumBindingSchema = z.discriminatedUnion("type", [
  PaciumSessionBindingSchema,
  PaciumLaunchPresetBindingSchema,
]);
export type PaciumBinding = z.infer<typeof PaciumBindingSchema>;

export const PaciumRepositorySchema = z
  .object({
    id: PaciumIdentifierSchema,
    label: PaciumLabelSchema,
    root: PaciumAbsolutePathSchema,
    verificationPresetIds: z
      .array(PaciumIdentifierSchema)
      .max(MAX_PACIUM_VERIFICATION_REFERENCES),
  })
  .strict()
  .superRefine(({ verificationPresetIds }, context) => {
    addDuplicateIssues(
      verificationPresetIds,
      context,
      "verificationPresetIds",
      "Verification preset references must be unique.",
    );
  });
export type PaciumRepository = z.infer<typeof PaciumRepositorySchema>;

export const PaciumRolesSchema = z
  .object({
    meta: PaciumBindingSchema.nullable(),
    orchestrator: PaciumBindingSchema.nullable(),
  })
  .strict();
export type PaciumRoles = z.infer<typeof PaciumRolesSchema>;

export const PaciumWorkerSchema = z
  .object({
    id: PaciumIdentifierSchema,
    label: PaciumLabelSchema,
    binding: PaciumBindingSchema,
  })
  .strict();
export type PaciumWorker = z.infer<typeof PaciumWorkerSchema>;

export const PaciumRoleIdSchema = z.enum(["meta", "orchestrator"]);
export type PaciumRoleId = z.infer<typeof PaciumRoleIdSchema>;

const PaciumDeliveryBaseShape = {
  id: PaciumIdentifierSchema,
  label: PaciumLabelSchema,
};

export const PaciumAnswerFileDeliverySchema = z
  .object({
    ...PaciumDeliveryBaseShape,
    type: z.literal("answer_file"),
    path: PaciumAbsolutePathSchema,
  })
  .strict();

export const PaciumRolePromptDeliverySchema = z
  .object({
    ...PaciumDeliveryBaseShape,
    type: z.literal("role_prompt"),
    role: PaciumRoleIdSchema,
  })
  .strict();

export const PaciumDeliveryMethodSchema = z.discriminatedUnion("type", [
  PaciumAnswerFileDeliverySchema,
  PaciumRolePromptDeliverySchema,
]);
export type PaciumDeliveryMethod = z.infer<typeof PaciumDeliveryMethodSchema>;

export const PaciumQueueSourceSchema = z
  .object({
    id: PaciumIdentifierSchema,
    label: PaciumLabelSchema,
    path: PaciumAbsolutePathSchema,
    format: z.literal("plain_text"),
    requestingRole: PaciumRoleIdSchema.or(z.literal("unknown")),
    deliveryMethodId: PaciumIdentifierSchema.nullable(),
  })
  .strict();
export type PaciumQueueSource = z.infer<typeof PaciumQueueSourceSchema>;

export const PaciumContextSourceSchema = z
  .object({
    format: z.literal("plain_text"),
    path: PaciumAbsolutePathSchema,
  })
  .strict();
export type PaciumContextSource = z.infer<typeof PaciumContextSourceSchema>;

export const PaciumContextSchema = z
  .object({
    objective: PaciumContextSourceSchema.nullable(),
    plan: PaciumContextSourceSchema.nullable(),
  })
  .strict();
export type PaciumContext = z.infer<typeof PaciumContextSchema>;

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function addDuplicateIssues(
  values: readonly string[],
  context: z.RefinementCtx,
  path: string,
  message: string,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        path: [path, index],
        message,
      });
    }
    seen.add(value);
  }
}
