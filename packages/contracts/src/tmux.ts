import { z } from "zod";

export const MAX_TMUX_SESSIONS = 64;

export const TmuxServerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
export const TmuxSessionIdSchema = z.string().regex(/^\$[0-9]{1,12}$/);
const SafeTmuxTextSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => !hasControlCharacter(value), {
    message: "tmux text cannot contain control characters.",
  });

export const TmuxTargetSchema = z
  .object({
    serverId: TmuxServerIdSchema,
    sessionId: TmuxSessionIdSchema,
    sessionName: SafeTmuxTextSchema,
    observedAt: z.string().datetime(),
  })
  .strict();
export type TmuxTarget = z.infer<typeof TmuxTargetSchema>;

export const TmuxSessionSchema = z
  .object({
    target: TmuxTargetSchema,
    windows: z.number().int().positive().max(1_000),
    attachedClients: z.number().int().nonnegative().max(1_000),
    createdAt: z.string().datetime(),
    currentPath: z.string().min(1).max(4096).nullable(),
  })
  .strict();
export type TmuxSession = z.infer<typeof TmuxSessionSchema>;

export const TmuxCapabilitySchema = z
  .object({
    state: z.enum(["unconfigured", "unavailable", "ready"]),
    serverId: TmuxServerIdSchema.nullable(),
    executable: z.string().min(1).max(4096).nullable(),
    version: z.string().min(1).max(80).nullable(),
    detail: z.string().min(1).max(300),
  })
  .strict()
  .superRefine((capability, context) => {
    const ready = capability.state === "ready";
    if (
      ready !==
        (capability.serverId !== null &&
          capability.executable !== null &&
          capability.version !== null) ||
      (capability.state === "unconfigured" &&
        (capability.serverId !== null ||
          capability.executable !== null ||
          capability.version !== null))
    ) {
      context.addIssue({
        code: "custom",
        message: "tmux capability fields must match its state.",
      });
    }
  });
export type TmuxCapability = z.infer<typeof TmuxCapabilitySchema>;

export const TmuxSessionsObservationSchema = z
  .object({
    status: z.enum(["ready", "empty", "unconfigured", "unavailable", "error"]),
    serverId: TmuxServerIdSchema.nullable(),
    observedAt: z.string().datetime(),
    sessions: z.array(TmuxSessionSchema).max(MAX_TMUX_SESSIONS),
    error: z
      .object({
        code: z.enum([
          "not_configured",
          "tmux_unavailable",
          "socket_unavailable",
          "timeout",
          "invalid_output",
          "inspection_failed",
        ]),
        message: z.string().min(1).max(300),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const hasSessions = observation.sessions.length > 0;
    if (
      (observation.status === "ready") !== hasSessions ||
      (observation.status === "ready" || observation.status === "empty") !==
        (observation.serverId !== null && observation.error === null) ||
      (observation.status !== "ready" && observation.status !== "empty") !==
        (observation.sessions.length === 0 && observation.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "tmux observation evidence must match its status.",
      });
    }
    const ids = observation.sessions.map(({ target }) => target.sessionId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "tmux session IDs must be unique.",
      });
    }
  });
export type TmuxSessionsObservation = z.infer<
  typeof TmuxSessionsObservationSchema
>;

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}
