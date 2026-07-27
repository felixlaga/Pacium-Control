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

export const PaciumWorkspaceSchema = z
  .object({
    id: PaciumIdentifierSchema,
    label: PaciumLabelSchema,
    repositories: z.array(PaciumRepositorySchema).max(MAX_PACIUM_REPOSITORIES),
    roles: PaciumRolesSchema,
    workers: z.array(PaciumWorkerSchema).max(MAX_PACIUM_WORKERS),
    queueSources: z
      .array(PaciumQueueSourceSchema)
      .max(MAX_PACIUM_QUEUE_SOURCES),
    deliveryMethods: z
      .array(PaciumDeliveryMethodSchema)
      .max(MAX_PACIUM_DELIVERY_METHODS),
    context: PaciumContextSchema,
  })
  .strict()
  .superRefine(validateWorkspaceGraph);
export type PaciumWorkspace = z.infer<typeof PaciumWorkspaceSchema>;

export const PaciumConfigDocumentSchema = z
  .object({
    schemaVersion: z.literal(PACIUM_CONFIG_SCHEMA_VERSION),
    revision: z.number().int().positive().safe(),
    workspace: PaciumWorkspaceSchema,
  })
  .strict();
export type PaciumConfigDocument = z.infer<typeof PaciumConfigDocumentSchema>;

export const PaciumConfigReplaceSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative().safe(),
    workspace: PaciumWorkspaceSchema,
  })
  .strict();
export type PaciumConfigReplace = z.infer<typeof PaciumConfigReplaceSchema>;

export const PaciumConfigObservationSchema = z
  .object({
    status: z.enum(["unconfigured", "ready", "error"]),
    revision: z.number().int().positive().safe().nullable(),
    workspace: PaciumWorkspaceSchema.nullable(),
    error: z
      .object({
        code: z.enum([
          "invalid_file",
          "unsupported_version",
          "unsafe_permissions",
          "filesystem_error",
        ]),
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    if (
      observation.status === "ready" &&
      (observation.revision === null ||
        observation.workspace === null ||
        observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Ready Pacium config requires revision and workspace evidence.",
      });
    }
    if (
      observation.status === "unconfigured" &&
      (observation.revision !== null ||
        observation.workspace !== null ||
        observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Unconfigured Pacium config cannot contain state evidence.",
      });
    }
    if (
      observation.status === "error" &&
      (observation.revision !== null ||
        observation.workspace !== null ||
        observation.error === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Pacium config errors contain only bounded error evidence.",
      });
    }
  });
export type PaciumConfigObservation = z.infer<
  typeof PaciumConfigObservationSchema
>;

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

function validateWorkspaceGraph(
  workspace: {
    repositories: readonly PaciumRepository[];
    roles: PaciumRoles;
    workers: readonly PaciumWorker[];
    queueSources: readonly PaciumQueueSource[];
    deliveryMethods: readonly PaciumDeliveryMethod[];
    context: PaciumContext;
  },
  context: z.RefinementCtx,
): void {
  addDuplicateObjectIssues(
    workspace.repositories,
    ({ id }) => id,
    context,
    "repositories",
    "Repository IDs must be unique.",
  );
  addDuplicateObjectIssues(
    workspace.repositories,
    ({ root }) => root,
    context,
    "repositories",
    "Repository roots must be unique.",
  );
  addDuplicateObjectIssues(
    workspace.workers,
    ({ id }) => id,
    context,
    "workers",
    "Worker IDs must be unique.",
  );
  addDuplicateObjectIssues(
    workspace.queueSources,
    ({ id }) => id,
    context,
    "queueSources",
    "Queue source IDs must be unique.",
  );
  addDuplicateObjectIssues(
    workspace.queueSources,
    ({ path }) => path,
    context,
    "queueSources",
    "Queue source paths must be unique.",
  );
  addDuplicateObjectIssues(
    workspace.deliveryMethods,
    ({ id }) => id,
    context,
    "deliveryMethods",
    "Delivery method IDs must be unique.",
  );
  const answerMethods = workspace.deliveryMethods.filter(
    (
      method,
    ): method is Extract<PaciumDeliveryMethod, { type: "answer_file" }> =>
      method.type === "answer_file",
  );
  addDuplicateObjectIssues(
    answerMethods,
    ({ path }) => path,
    context,
    "deliveryMethods",
    "Answer-file paths must be unique.",
  );

  const repositoryIds = new Set(workspace.repositories.map(({ id }) => id));
  const deliveryIds = new Set(workspace.deliveryMethods.map(({ id }) => id));
  for (const [index, source] of workspace.queueSources.entries()) {
    if (
      source.deliveryMethodId !== null &&
      !deliveryIds.has(source.deliveryMethodId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["queueSources", index, "deliveryMethodId"],
        message: "Queue source references an unknown delivery method.",
      });
    }
  }

  const bindings = [
    ...(workspace.roles.meta === null
      ? []
      : [{ path: ["roles", "meta"], binding: workspace.roles.meta }]),
    ...(workspace.roles.orchestrator === null
      ? []
      : [
          {
            path: ["roles", "orchestrator"],
            binding: workspace.roles.orchestrator,
          },
        ]),
    ...workspace.workers.map(({ binding }, index) => ({
      path: ["workers", index, "binding"],
      binding,
    })),
  ];
  const sessionBindings = new Set<string>();
  for (const { binding, path } of bindings) {
    if (
      binding.type === "launch_preset" &&
      binding.repositoryId !== null &&
      !repositoryIds.has(binding.repositoryId)
    ) {
      context.addIssue({
        code: "custom",
        path: [...path, "repositoryId"],
        message: "Binding references an unknown repository.",
      });
    }
    if (binding.type !== "session") {
      continue;
    }
    if (sessionBindings.has(binding.sessionId)) {
      context.addIssue({
        code: "custom",
        path: [...path, "sessionId"],
        message: "A live session can occupy only one Pacium slot.",
      });
    }
    sessionBindings.add(binding.sessionId);
  }

  const configuredRoles = new Set<PaciumRoleId>();
  if (workspace.roles.meta !== null) {
    configuredRoles.add("meta");
  }
  if (workspace.roles.orchestrator !== null) {
    configuredRoles.add("orchestrator");
  }
  for (const [index, method] of workspace.deliveryMethods.entries()) {
    if (method.type === "role_prompt" && !configuredRoles.has(method.role)) {
      context.addIssue({
        code: "custom",
        path: ["deliveryMethods", index, "role"],
        message: "Role-prompt delivery requires a configured role.",
      });
    }
  }

  const sourcePaths = new Set(workspace.queueSources.map(({ path }) => path));
  for (const [index, method] of workspace.deliveryMethods.entries()) {
    if (method.type === "answer_file" && sourcePaths.has(method.path)) {
      context.addIssue({
        code: "custom",
        path: ["deliveryMethods", index, "path"],
        message: "An answer file cannot also be a queue source.",
      });
    }
  }

  if (
    workspace.context.objective !== null &&
    workspace.context.plan !== null &&
    workspace.context.objective.path === workspace.context.plan.path
  ) {
    context.addIssue({
      code: "custom",
      path: ["context", "plan", "path"],
      message: "Objective and plan sources must use distinct paths.",
    });
  }
}

function addDuplicateObjectIssues<T>(
  values: readonly T[],
  key: (value: T) => string,
  context: z.RefinementCtx,
  path: string,
  message: string,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const identity = key(value);
    if (seen.has(identity)) {
      context.addIssue({
        code: "custom",
        path: [path, index],
        message,
      });
    }
    seen.add(identity);
  }
}
