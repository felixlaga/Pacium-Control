import { z } from "zod";

export const PROTOCOL_VERSION = 5 as const;
export const MAX_APPLICATION_MESSAGE_BYTES = 128 * 1024;
export const MAX_TERMINAL_FRAME_BYTES = 256 * 1024;
export const MAX_TERMINAL_INPUT_CHARS = 64 * 1024;
export const MAX_TERMINAL_SNAPSHOT_CHARS = 512 * 1024;

const RequestIdSchema = z.string().uuid();
const SessionIdSchema = z.string().uuid();

export const LaunchPresetIdSchema = z.enum(["shell", "codex", "claude"]);
export type LaunchPresetId = z.infer<typeof LaunchPresetIdSchema>;

export const LaunchPresetCapabilitySchema = z.object({
  id: LaunchPresetIdSchema,
  label: z.string().min(1).max(40),
  available: z.boolean(),
  unavailableReason: z.string().min(1).max(200).nullable(),
});
export type LaunchPresetCapability = z.infer<
  typeof LaunchPresetCapabilitySchema
>;

export const ProcessStateSchema = z.enum([
  "creating",
  "live",
  "exited",
  "closing",
  "failed",
]);

export const AgentTypeSchema = z.enum(["shell", "codex", "claude", "unknown"]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentClassificationSourceSchema = z.enum([
  "launch_preset",
  "process_observed",
  "human_labelled",
]);
export type AgentClassificationSource = z.infer<
  typeof AgentClassificationSourceSchema
>;

export const EvidenceConfidenceSchema = z.enum([
  "confirmed",
  "high",
  "medium",
  "low",
]);
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>;

export const AgentClassificationSchema = z
  .object({
    type: AgentTypeSchema,
    label: z.string().min(1).max(40),
    source: AgentClassificationSourceSchema,
    confidence: EvidenceConfidenceSchema,
    observedAt: z.string().datetime(),
  })
  .strict();
export type AgentClassification = z.infer<typeof AgentClassificationSchema>;

export const RepositoryStatusSchema = z.enum([
  "ready",
  "not_repository",
  "error",
]);
export const RepositoryHeadStateSchema = z.enum([
  "branch",
  "detached",
  "unborn",
  "unknown",
]);
export const RepositoryWorktreeKindSchema = z.enum([
  "main",
  "linked",
  "unknown",
]);
export const RepositoryErrorCodeSchema = z.enum([
  "git_unavailable",
  "timeout",
  "inspection_failed",
  "invalid_output",
]);

export const RepositoryObservationSchema = z
  .object({
    status: RepositoryStatusSchema,
    root: z.string().min(1).max(4096).nullable(),
    name: z.string().min(1).max(255).nullable(),
    branch: z.string().min(1).max(512).nullable(),
    headCommit: z
      .string()
      .regex(/^[0-9a-f]{40,64}$/)
      .nullable(),
    headState: RepositoryHeadStateSchema,
    worktreeKind: RepositoryWorktreeKindSchema,
    observedAt: z.string().datetime(),
    error: z
      .object({
        code: RepositoryErrorCodeSchema,
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const rootPairValid =
      (observation.root === null && observation.name === null) ||
      (observation.root !== null && observation.name !== null);
    if (!rootPairValid) {
      context.addIssue({
        code: "custom",
        message: "Repository root and name must be present together.",
      });
    }

    if (observation.status === "not_repository") {
      if (
        observation.root !== null ||
        observation.branch !== null ||
        observation.headCommit !== null ||
        observation.headState !== "unknown" ||
        observation.worktreeKind !== "unknown" ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "A non-repository observation cannot contain Git evidence.",
        });
      }
      return;
    }

    if (observation.status === "error") {
      if (
        observation.branch !== null ||
        observation.headCommit !== null ||
        observation.headState !== "unknown" ||
        observation.error === null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "An error observation must contain only bounded error evidence.",
        });
      }
      return;
    }

    if (
      observation.root === null ||
      observation.worktreeKind === "unknown" ||
      observation.headState === "unknown" ||
      observation.error !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "A ready observation requires complete repository evidence.",
      });
      return;
    }
    const branchExpected =
      observation.headState === "branch" || observation.headState === "unborn";
    const commitExpected = observation.headState !== "unborn";
    if (
      (observation.branch !== null) !== branchExpected ||
      (observation.headCommit !== null) !== commitExpected
    ) {
      context.addIssue({
        code: "custom",
        message: "Branch and commit must match the repository head state.",
      });
    }
  });
export type RepositoryObservation = z.infer<typeof RepositoryObservationSchema>;

export const GitChangeKindSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
  "untracked",
  "conflicted",
]);

export const GitChangedFileSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(4096)
      .refine((value) => !value.includes("\0")),
    previousPath: z
      .string()
      .min(1)
      .max(4096)
      .refine((value) => !value.includes("\0"))
      .nullable(),
    kind: GitChangeKindSchema,
    staged: z.boolean(),
    unstaged: z.boolean(),
    untracked: z.boolean(),
    conflicted: z.boolean(),
    additions: z.number().int().nonnegative().nullable(),
    deletions: z.number().int().nonnegative().nullable(),
    binary: z.boolean(),
    large: z.boolean(),
    sizeBytes: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict()
  .superRefine((file, context) => {
    if (!file.staged && !file.unstaged && !file.untracked && !file.conflicted) {
      context.addIssue({
        code: "custom",
        message: "A changed file requires at least one status source.",
      });
    }
    if (
      file.untracked &&
      (file.kind !== "untracked" ||
        file.staged ||
        file.unstaged ||
        file.conflicted)
    ) {
      context.addIssue({
        code: "custom",
        message: "Untracked evidence cannot contain tracked status.",
      });
    }
    if (file.conflicted && file.kind !== "conflicted") {
      context.addIssue({
        code: "custom",
        message: "Conflicted evidence requires the conflicted kind.",
      });
    }
    const carriesPreviousPath =
      file.kind === "renamed" || file.kind === "copied";
    if ((file.previousPath !== null) !== carriesPreviousPath) {
      context.addIssue({
        code: "custom",
        message: "Only renamed or copied files carry a previous path.",
      });
    }
    if (
      (file.additions === null) !== (file.deletions === null) ||
      (file.binary && (file.additions !== null || file.deletions !== null))
    ) {
      context.addIssue({
        code: "custom",
        message: "Line counts must be a complete numeric pair or unavailable.",
      });
    }
  });
export type GitChangedFile = z.infer<typeof GitChangedFileSchema>;

export const GitChangesStatusSchema = z.enum([
  "ready",
  "not_repository",
  "error",
]);
export const GitChangesErrorCodeSchema = z.enum([
  "git_unavailable",
  "timeout",
  "inspection_failed",
  "invalid_output",
  "repository_unavailable",
]);

export const GitChangesObservationSchema = z
  .object({
    status: GitChangesStatusSchema,
    root: z.string().min(1).max(4096).nullable(),
    headCommit: z
      .string()
      .regex(/^[0-9a-f]{40,64}$/)
      .nullable(),
    observedAt: z.string().datetime(),
    files: z.array(GitChangedFileSchema).max(500),
    totals: z
      .object({
        fileCount: z.number().int().min(0).max(500),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
        unavailableLineCount: z.number().int().min(0).max(500),
        conflictCount: z.number().int().min(0).max(500),
      })
      .strict(),
    truncated: z.boolean(),
    error: z
      .object({
        code: GitChangesErrorCodeSchema,
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const expected = {
      fileCount: observation.files.length,
      additions: observation.files.reduce(
        (sum, file) => sum + (file.additions ?? 0),
        0,
      ),
      deletions: observation.files.reduce(
        (sum, file) => sum + (file.deletions ?? 0),
        0,
      ),
      unavailableLineCount: observation.files.filter(
        (file) => file.additions === null,
      ).length,
      conflictCount: observation.files.filter((file) => file.conflicted).length,
    };
    if (
      Object.entries(expected).some(
        ([key, value]) =>
          observation.totals[key as keyof typeof expected] !== value,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Changed-file totals must match the file evidence.",
      });
    }

    if (observation.status === "ready") {
      if (observation.root === null || observation.error !== null) {
        context.addIssue({
          code: "custom",
          message: "Ready changes require a root and no error.",
        });
      }
      return;
    }

    if (
      observation.files.length !== 0 ||
      observation.truncated ||
      observation.headCommit !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Unavailable changes cannot contain file evidence.",
      });
    }
    if (
      (observation.status === "error") !== (observation.error !== null) ||
      (observation.status === "not_repository" && observation.root !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Changed-file error evidence must match status.",
      });
    }
  });
export type GitChangesObservation = z.infer<typeof GitChangesObservationSchema>;

export const SessionSummarySchema = z.object({
  id: SessionIdSchema,
  epoch: z.number().int().positive(),
  displayName: z.string().min(1).max(120),
  cwd: z.string().min(1).max(4096),
  shell: z.string().min(1).max(4096),
  launchPreset: LaunchPresetIdSchema,
  commandLabel: z.string().min(1).max(40),
  agentClassification: AgentClassificationSchema,
  repository: RepositoryObservationSchema,
  runtime: z.literal("pty"),
  processState: ProcessStateSchema,
  pid: z.number().int().positive().nullable(),
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(1).max(300),
  createdAt: z.string().datetime(),
  exitedAt: z.string().datetime().nullable(),
  exitCode: z.number().int().nullable(),
  exitSignal: z.number().int().nullable(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type ProcessState = z.infer<typeof ProcessStateSchema>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.list"),
    requestId: RequestIdSchema,
  }),
  z.object({
    type: z.literal("session.create"),
    requestId: RequestIdSchema,
    payload: z
      .object({
        displayName: z.string().trim().min(1).max(120).optional(),
        launchPreset: LaunchPresetIdSchema,
        cwd: z.string().trim().min(1).max(4096),
        cols: z.number().int().min(2).max(500),
        rows: z.number().int().min(1).max(300),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("terminal.attach"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
  }),
  z.object({
    type: z.literal("terminal.input"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
    data: z.string().max(MAX_TERMINAL_INPUT_CHARS),
  }),
  z.object({
    type: z.literal("terminal.resize"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
    cols: z.number().int().min(2).max(500),
    rows: z.number().int().min(1).max(300),
  }),
  z.object({
    type: z.literal("terminal.interrupt"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
  }),
  z
    .object({
      type: z.literal("session.rename"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      displayName: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("session.revealRepository"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("session.refreshRepository"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
    })
    .strict(),
  z.object({
    type: z.literal("session.close"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
    force: z.boolean(),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("server.welcome"),
    protocolVersion: z.literal(PROTOCOL_VERSION),
    serverId: z.string().uuid(),
    platform: z.string(),
    defaultCwd: z.string(),
    capabilities: z.object({
      directPty: z.literal(true),
      reconnectSnapshot: z.literal(true),
      tmux: z.literal(false),
      launchPresets: z.array(LaunchPresetCapabilitySchema).length(3),
    }),
  }),
  z.object({
    type: z.literal("session.list"),
    requestId: RequestIdSchema,
    sessions: z.array(SessionSummarySchema),
  }),
  z.object({
    type: z.literal("session.created"),
    requestId: RequestIdSchema,
    session: SessionSummarySchema,
  }),
  z.object({
    type: z.literal("session.updated"),
    session: SessionSummarySchema,
  }),
  z.object({
    type: z.literal("terminal.snapshot"),
    requestId: RequestIdSchema,
    sessionId: SessionIdSchema,
    epoch: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
    data: z.string().max(MAX_TERMINAL_SNAPSHOT_CHARS),
    cols: z.number().int().min(2).max(500),
    rows: z.number().int().min(1).max(300),
    truncated: z.boolean(),
  }),
  z.object({
    type: z.literal("session.exited"),
    session: SessionSummarySchema,
  }),
  z.object({
    type: z.literal("session.closed"),
    requestId: RequestIdSchema.optional(),
    sessionId: SessionIdSchema,
  }),
  z.object({
    type: z.literal("command.result"),
    requestId: RequestIdSchema,
    ok: z.literal(true),
  }),
  z.object({
    type: z.literal("error"),
    requestId: RequestIdSchema.optional(),
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(1000),
    retryable: z.boolean(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

const TERMINAL_DATA_KIND = 0x01;
const SESSION_ID_BYTES = 36;
const EPOCH_BYTES = 4;
const SEQUENCE_BYTES = 4;
const HEADER_BYTES = 1 + SESSION_ID_BYTES + EPOCH_BYTES + SEQUENCE_BYTES;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface TerminalDataFrame {
  sessionId: string;
  epoch: number;
  sequence: number;
  data: string;
}

export function encodeTerminalDataFrame(
  sessionId: string,
  epoch: number,
  sequence: number,
  data: string,
): Uint8Array {
  const sessionBytes = textEncoder.encode(sessionId);
  if (sessionBytes.byteLength !== SESSION_ID_BYTES) {
    throw new Error("Terminal frame session ID must be a UUID");
  }
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > 0xffffffff) {
    throw new Error("Terminal frame epoch is invalid");
  }
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 0xffffffff) {
    throw new Error("Terminal frame sequence is invalid");
  }

  const dataBytes = textEncoder.encode(data);
  const frameLength = HEADER_BYTES + dataBytes.byteLength;
  if (frameLength > MAX_TERMINAL_FRAME_BYTES) {
    throw new Error("Terminal frame exceeds the configured maximum");
  }

  const frame = new Uint8Array(frameLength);
  frame[0] = TERMINAL_DATA_KIND;
  frame.set(sessionBytes, 1);
  const view = new DataView(frame.buffer);
  view.setUint32(1 + SESSION_ID_BYTES, epoch);
  view.setUint32(1 + SESSION_ID_BYTES + EPOCH_BYTES, sequence);
  frame.set(dataBytes, HEADER_BYTES);
  return frame;
}

export function decodeTerminalDataFrame(
  input: ArrayBuffer | Uint8Array,
): TerminalDataFrame {
  const frame = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (
    frame.byteLength < HEADER_BYTES ||
    frame.byteLength > MAX_TERMINAL_FRAME_BYTES
  ) {
    throw new Error("Invalid terminal frame size");
  }
  if (frame[0] !== TERMINAL_DATA_KIND) {
    throw new Error("Unknown terminal frame kind");
  }

  const sessionIdEnd = 1 + SESSION_ID_BYTES;
  const sessionId = textDecoder.decode(frame.subarray(1, sessionIdEnd));
  const parsedSessionId = SessionIdSchema.safeParse(sessionId);
  if (!parsedSessionId.success) {
    throw new Error("Invalid terminal frame session ID");
  }

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);

  return {
    sessionId,
    epoch: view.getUint32(sessionIdEnd),
    sequence: view.getUint32(sessionIdEnd + EPOCH_BYTES),
    data: textDecoder.decode(frame.subarray(HEADER_BYTES)),
  };
}
