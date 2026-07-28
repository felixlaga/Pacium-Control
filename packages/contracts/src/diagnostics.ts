import { z } from "zod";

export const DIAGNOSTICS_SCHEMA_VERSION = 1 as const;
export const MAX_DIAGNOSTICS_COMPONENTS = 12;
export const MAX_DIAGNOSTICS_SESSIONS = 100;
export const MAX_DIAGNOSTIC_CODES = 24;
export const MAX_DIAGNOSTICS_MANIFEST_ITEMS = 16;
export const MAX_DIAGNOSTICS_JSON_CHARS = 256 * 1024;

const VersionTextSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => !hasControlCharacter(value), {
    message: "Diagnostic versions cannot contain control characters.",
  });

const FixedTextSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !hasControlCharacter(value), {
    message: "Diagnostic text cannot contain control characters.",
  });

export const DiagnosticsHealthStateSchema = z.enum([
  "healthy",
  "degraded",
  "unavailable",
  "unknown",
]);
export type DiagnosticsHealthState = z.infer<
  typeof DiagnosticsHealthStateSchema
>;

export const DiagnosticsComponentIdSchema = z.enum([
  "local_server",
  "http_transport",
  "pty_runtime",
  "local_state",
  "claude_observer",
  "codex_observer",
  "queue_observer",
  "tmux_adapter",
]);
export type DiagnosticsComponentId = z.infer<
  typeof DiagnosticsComponentIdSchema
>;

export const DiagnosticsComponentSchema = z
  .object({
    id: DiagnosticsComponentIdSchema,
    state: DiagnosticsHealthStateSchema,
    summary: FixedTextSchema,
    operatorAction: FixedTextSchema.nullable(),
  })
  .strict();
export type DiagnosticsComponent = z.infer<typeof DiagnosticsComponentSchema>;

export const DiagnosticsProviderSchema = z
  .object({
    id: z.enum(["claude", "codex"]),
    health: z.enum([
      "unavailable",
      "ready",
      "degraded",
      "failed",
      "unsupported",
    ]),
    adapterVersion: VersionTextSchema,
    providerVersion: VersionTextSchema.nullable(),
    diagnosticCount: z.number().int().nonnegative().max(8),
  })
  .strict();
export type DiagnosticsProvider = z.infer<typeof DiagnosticsProviderSchema>;

export const DiagnosticsSessionSchema = z
  .object({
    label: z.string().regex(/^Terminal (?:[1-9]|[1-9][0-9]|100)$/),
    launchPreset: z.enum(["shell", "codex", "claude"]),
    runtime: z.enum(["pty", "tmux"]),
    tmuxMode: z.enum(["attached", "keep_alive"]).nullable(),
    processState: z.enum(["creating", "live", "closing", "exited", "failed"]),
    cols: z.number().int().min(1).max(1_000),
    rows: z.number().int().min(1).max(1_000),
    exitCode: z.number().int().min(-1).max(255).nullable(),
    exitSignal: z.number().int().min(0).max(255).nullable(),
    repositoryPresent: z.boolean(),
    provider: DiagnosticsProviderSchema.nullable(),
  })
  .strict()
  .superRefine((session, context) => {
    if (
      (session.runtime === "tmux") !== (session.tmuxMode !== null) ||
      (session.processState === "exited") !==
        (session.exitCode !== null && session.exitSignal !== null) ||
      (session.launchPreset === "shell") !== (session.provider === null) ||
      (session.provider !== null &&
        session.provider.id !== session.launchPreset)
    ) {
      context.addIssue({
        code: "custom",
        message: "Sanitized session diagnostics fields must agree.",
      });
    }
  });
export type DiagnosticsSession = z.infer<typeof DiagnosticsSessionSchema>;

export const DiagnosticsCodeSchema = z
  .object({
    component: DiagnosticsComponentIdSchema,
    code: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_.-]+$/),
    severity: z.enum(["info", "warning", "error"]),
    count: z.number().int().positive().max(1_000_000),
  })
  .strict();
export type DiagnosticsCode = z.infer<typeof DiagnosticsCodeSchema>;

export const DiagnosticsIncludedCategorySchema = z.enum([
  "application_versions",
  "runtime_platform",
  "component_health",
  "session_state",
  "provider_health",
  "queue_status",
  "tmux_status",
  "diagnostic_codes",
]);

export const DiagnosticsOmittedCategorySchema = z.enum([
  "terminal_content",
  "terminal_input",
  "terminal_titles",
  "session_identifiers",
  "process_identifiers",
  "commands_and_arguments",
  "paths_and_repositories",
  "git_content",
  "queue_content_and_decisions",
  "provider_content_and_fields",
  "environment_and_credentials",
  "host_and_operator_identity",
  "relaunch_metadata",
]);

export const DiagnosticsSnapshotSchema = z
  .object({
    schemaVersion: z.literal(DIAGNOSTICS_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    application: z
      .object({
        paciumVersion: VersionTextSchema,
        protocolVersion: z.number().int().positive().max(10_000),
        nodeVersion: VersionTextSchema,
        platform: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9_-]+$/i),
        architecture: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9_-]+$/i),
        dependencyVersions: z
          .object({
            nodePty: VersionTextSchema,
            xtermHeadless: VersionTextSchema,
            xtermBrowser: VersionTextSchema,
            react: VersionTextSchema,
            ws: VersionTextSchema,
            zod: VersionTextSchema,
          })
          .strict(),
      })
      .strict(),
    overview: z
      .object({
        state: DiagnosticsHealthStateSchema,
        sessions: z
          .object({
            total: z.number().int().nonnegative().max(100_000),
            creating: z.number().int().nonnegative().max(100_000),
            live: z.number().int().nonnegative().max(100_000),
            closing: z.number().int().nonnegative().max(100_000),
            exited: z.number().int().nonnegative().max(100_000),
            failed: z.number().int().nonnegative().max(100_000),
            directPty: z.number().int().nonnegative().max(100_000),
            tmux: z.number().int().nonnegative().max(100_000),
          })
          .strict(),
        queueStatus: z.enum(["unconfigured", "config_error", "ready"]),
        queueSources: z.number().int().nonnegative().max(1_000),
        queueItems: z
          .object({
            question: z.number().int().nonnegative().max(1_000),
            approval: z.number().int().nonnegative().max(1_000),
            failure: z.number().int().nonnegative().max(1_000),
            review: z.number().int().nonnegative().max(1_000),
            unknown: z.number().int().nonnegative().max(1_000),
          })
          .strict(),
        queueConflicts: z.number().int().nonnegative().max(10_000),
        tmuxStatus: z.enum(["unconfigured", "unavailable", "ready"]),
        tmuxVersion: VersionTextSchema.nullable(),
      })
      .strict(),
    components: z
      .array(DiagnosticsComponentSchema)
      .max(MAX_DIAGNOSTICS_COMPONENTS),
    sessions: z.array(DiagnosticsSessionSchema).max(MAX_DIAGNOSTICS_SESSIONS),
    sessionsTruncated: z.boolean(),
    diagnostics: z.array(DiagnosticsCodeSchema).max(MAX_DIAGNOSTIC_CODES),
    diagnosticsTruncated: z.boolean(),
    redactionManifest: z
      .object({
        included: z
          .array(DiagnosticsIncludedCategorySchema)
          .max(MAX_DIAGNOSTICS_MANIFEST_ITEMS),
        omitted: z
          .array(DiagnosticsOmittedCategorySchema)
          .max(MAX_DIAGNOSTICS_MANIFEST_ITEMS),
      })
      .strict(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    rejectDuplicates(
      snapshot.components.map(({ id }) => id),
      "Diagnostic component IDs must be unique.",
      context,
    );
    rejectDuplicates(
      snapshot.sessions.map(({ label }) => label),
      "Diagnostic session labels must be unique.",
      context,
    );
    rejectDuplicates(
      snapshot.diagnostics.map(
        ({ component, code }) => `${component}\u0000${code}`,
      ),
      "Diagnostic component/code pairs must be unique.",
      context,
    );
    rejectDuplicates(
      snapshot.redactionManifest.included,
      "Included diagnostic categories must be unique.",
      context,
    );
    rejectDuplicates(
      snapshot.redactionManifest.omitted,
      "Omitted diagnostic categories must be unique.",
      context,
    );
    const { sessions } = snapshot.overview;
    if (
      sessions.total !==
        sessions.creating +
          sessions.live +
          sessions.closing +
          sessions.exited +
          sessions.failed ||
      sessions.total !== sessions.directPty + sessions.tmux ||
      snapshot.sessions.length > sessions.total ||
      snapshot.sessionsTruncated !==
        sessions.total > MAX_DIAGNOSTICS_SESSIONS ||
      (snapshot.overview.tmuxStatus === "ready") !==
        (snapshot.overview.tmuxVersion !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Diagnostic session totals and truncation must agree.",
      });
    }
    if (JSON.stringify(snapshot).length > MAX_DIAGNOSTICS_JSON_CHARS) {
      context.addIssue({
        code: "custom",
        message: "Diagnostic snapshots must remain within the response bound.",
      });
    }
  });
export type DiagnosticsSnapshot = z.infer<typeof DiagnosticsSnapshotSchema>;

function rejectDuplicates(
  values: readonly string[],
  message: string,
  context: z.RefinementCtx,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message });
  }
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}
