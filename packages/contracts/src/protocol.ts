import { z } from "zod";

import {
  PaciumConfigObservationSchema,
  PaciumWorkspaceSchema,
} from "./pacium-config.js";
import { PaciumContextObservationSchema } from "./pacium-context.js";
import { ProviderObservationSnapshotSchema } from "./provider-observation.js";
import { RelaunchManifestSchema } from "./relaunch-manifest.js";
import {
  QueueApprovalDecisionPayloadSchema,
  QueueDecisionResultSchema,
  QueueItemDecisionStateSchema,
  QueueQuestionAnswerPayloadSchema,
} from "./queue-decision.js";
import {
  QueueDeliveryResultSchema,
  QueueDeliveryStateSchema,
} from "./queue-delivery.js";
import { QueueItemReconciliationSchema } from "./queue-item-reconciliation.js";
import {
  QueueItemInspectionIdentitySchema,
  QueueItemInspectionSchema,
} from "./queue-item-inspection.js";
import { QueueSourcesObservationSchema } from "./queue-observation.js";
import {
  QueueResolutionRequestSchema,
  QueueResolutionResultSchema,
} from "./queue-reconciliation.js";

export const PROTOCOL_VERSION = 22 as const;
export const MAX_APPLICATION_MESSAGE_BYTES = 128 * 1024;
export const MAX_TERMINAL_FRAME_BYTES = 256 * 1024;
export const MAX_TERMINAL_INPUT_CHARS = 64 * 1024;
export const MAX_TERMINAL_SNAPSHOT_CHARS = 512 * 1024;
export const MAX_GIT_DIFF_BYTES = 64 * 1024;
export const MAX_GIT_DIFF_LINES = 2_000;
export const MAX_GIT_DIFF_LINE_CHARS = 4_096;
export const MAX_GIT_HISTORY_COMMITS = 50;
export const MAX_GIT_HISTORY_AUTHOR_CHARS = 200;
export const MAX_GIT_HISTORY_SUBJECT_CHARS = 500;
export const MAX_GIT_HISTORY_PARENTS = 16;
export const MAX_VERIFICATION_PRESETS = 16;
export const MAX_VERIFICATION_ARGUMENTS = 32;
export const MAX_VERIFICATION_ARGUMENT_CHARS = 512;
export const MAX_VERIFICATION_OUTPUT_BYTES = 24 * 1024;

const RequestIdSchema = z.string().uuid();
const SessionIdSchema = z.string().uuid();
export const RepositoryRelativePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(isRepositoryRelativePath, {
    message: "Repository path must be relative and contained.",
  });

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

export const ConnectionAccessSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("local") }).strict(),
  z
    .object({
      kind: z.literal("tailscale"),
      login: z
        .string()
        .min(3)
        .max(254)
        .regex(/^[\x21-\x2b\x2d-\x7e]+$/)
        .refine(
          (value) =>
            value.indexOf("@") > 0 &&
            value.indexOf("@") === value.lastIndexOf("@") &&
            value.indexOf("@") < value.length - 1,
          { message: "Tailscale login must be one exact provider login." },
        ),
    })
    .strict(),
]);
export type ConnectionAccess = z.infer<typeof ConnectionAccessSchema>;

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
    path: RepositoryRelativePathSchema,
    previousPath: RepositoryRelativePathSchema.nullable(),
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

export const GitDiffStatusSchema = z.enum([
  "ready",
  "empty",
  "binary",
  "too_large",
  "not_found",
  "not_repository",
  "error",
]);
export const GitDiffSectionSourceSchema = z.enum([
  "combined",
  "staged",
  "unstaged",
  "untracked",
]);
export const GitDiffErrorCodeSchema = z.enum([
  "git_unavailable",
  "timeout",
  "inspection_failed",
  "invalid_output",
  "repository_unavailable",
  "unsafe_path",
]);

export const GitDiffSectionSchema = z
  .object({
    source: GitDiffSectionSourceSchema,
    patch: z.string().min(1).max(MAX_GIT_DIFF_BYTES),
    byteCount: z.number().int().positive().max(MAX_GIT_DIFF_BYTES),
    lineCount: z.number().int().positive().max(MAX_GIT_DIFF_LINES),
  })
  .strict()
  .superRefine((section, context) => {
    if (
      utf8ByteLength(section.patch) !== section.byteCount ||
      patchLineCount(section.patch) !== section.lineCount ||
      section.patch
        .split("\n")
        .some((line) => line.length > MAX_GIT_DIFF_LINE_CHARS)
    ) {
      context.addIssue({
        code: "custom",
        message: "Diff section counts and line bounds must match its patch.",
      });
    }
  });
export type GitDiffSection = z.infer<typeof GitDiffSectionSchema>;

export const GitDiffObservationSchema = z
  .object({
    status: GitDiffStatusSchema,
    root: z.string().min(1).max(4096).nullable(),
    headCommit: z
      .string()
      .regex(/^[0-9a-f]{40,64}$/)
      .nullable(),
    path: RepositoryRelativePathSchema,
    previousPath: RepositoryRelativePathSchema.nullable(),
    observedAt: z.string().datetime(),
    sections: z.array(GitDiffSectionSchema).max(2),
    patchBytes: z.number().int().nonnegative().max(MAX_GIT_DIFF_BYTES),
    patchLines: z.number().int().nonnegative().max(MAX_GIT_DIFF_LINES),
    error: z
      .object({
        code: GitDiffErrorCodeSchema,
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const patchBytes = observation.sections.reduce(
      (sum, section) => sum + section.byteCount,
      0,
    );
    const patchLines = observation.sections.reduce(
      (sum, section) => sum + section.lineCount,
      0,
    );
    if (
      observation.patchBytes !== patchBytes ||
      observation.patchLines !== patchLines
    ) {
      context.addIssue({
        code: "custom",
        message: "Diff totals must match section evidence.",
      });
    }

    const sources = observation.sections.map(({ source }) => source);
    if (
      new Set(sources).size !== sources.length ||
      ((sources.includes("combined") || sources.includes("untracked")) &&
        sources.length !== 1)
    ) {
      context.addIssue({
        code: "custom",
        message: "Diff section sources must form one valid comparison.",
      });
    }
    if (
      observation.root === null &&
      (observation.headCommit !== null || observation.previousPath !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Diff repository evidence requires a known root.",
      });
    }

    if (observation.status === "ready") {
      if (
        observation.root === null ||
        observation.sections.length === 0 ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Ready diff evidence requires patch sections and a root.",
        });
      }
      if (
        (observation.headCommit === null && sources.includes("combined")) ||
        (observation.headCommit !== null &&
          sources.some(
            (source) => source === "staged" || source === "unstaged",
          ))
      ) {
        context.addIssue({
          code: "custom",
          message: "Diff sections must match whether HEAD exists.",
        });
      }
      return;
    }

    if (
      observation.sections.length !== 0 ||
      observation.patchBytes !== 0 ||
      observation.patchLines !== 0
    ) {
      context.addIssue({
        code: "custom",
        message: "A non-ready diff cannot contain patch evidence.",
      });
    }
    if ((observation.status === "error") !== (observation.error !== null)) {
      context.addIssue({
        code: "custom",
        message: "Diff error evidence must match status.",
      });
    }
    if (
      observation.status === "not_repository" &&
      (observation.root !== null ||
        observation.headCommit !== null ||
        observation.previousPath !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A non-repository diff cannot contain repository evidence.",
      });
    }
    if (
      observation.status !== "not_repository" &&
      observation.status !== "error" &&
      observation.root === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Known diff states require a repository root.",
      });
    }
  });
export type GitDiffObservation = z.infer<typeof GitDiffObservationSchema>;

const GitObjectIdSchema = z.string().regex(/^[0-9a-f]{40,64}$/);
const HistoryAuthorSchema = z
  .string()
  .min(1)
  .max(MAX_GIT_HISTORY_AUTHOR_CHARS)
  .refine((value) => !hasLayoutControlCharacter(value), {
    message: "Commit author cannot contain layout control characters.",
  });
const HistorySubjectSchema = z
  .string()
  .min(1)
  .max(MAX_GIT_HISTORY_SUBJECT_CHARS)
  .refine((value) => !hasLayoutControlCharacter(value), {
    message: "Commit subject cannot contain layout control characters.",
  });

export const GitCommitRecordSchema = z
  .object({
    id: GitObjectIdSchema,
    parents: z.array(GitObjectIdSchema).max(MAX_GIT_HISTORY_PARENTS),
    authorName: HistoryAuthorSchema,
    authoredAt: z.string().datetime({ offset: true }),
    subject: HistorySubjectSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (
      record.parents.includes(record.id) ||
      new Set(record.parents).size !== record.parents.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Commit parents must be unique and cannot contain the commit.",
      });
    }
  });
export type GitCommitRecord = z.infer<typeof GitCommitRecordSchema>;

export const GitHistoryStatusSchema = z.enum([
  "ready",
  "empty",
  "not_repository",
  "error",
]);
export const GitHistoryErrorCodeSchema = z.enum([
  "git_unavailable",
  "timeout",
  "inspection_failed",
  "invalid_output",
  "repository_unavailable",
]);

export const GitHistoryObservationSchema = z
  .object({
    status: GitHistoryStatusSchema,
    root: z.string().min(1).max(4096).nullable(),
    headCommit: GitObjectIdSchema.nullable(),
    observedAt: z.string().datetime(),
    commits: z.array(GitCommitRecordSchema).max(MAX_GIT_HISTORY_COMMITS),
    truncated: z.boolean(),
    error: z
      .object({
        code: GitHistoryErrorCodeSchema,
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const commitIds = observation.commits.map(({ id }) => id);
    if (new Set(commitIds).size !== commitIds.length) {
      context.addIssue({
        code: "custom",
        message: "Commit history cannot contain duplicate commits.",
      });
    }
    if (
      observation.headCommit !== null &&
      observation.commits.length > 0 &&
      observation.commits[0]?.id !== observation.headCommit
    ) {
      context.addIssue({
        code: "custom",
        message: "Commit history must begin at the observed HEAD.",
      });
    }
    if (
      observation.truncated &&
      (observation.status !== "ready" ||
        observation.commits.length !== MAX_GIT_HISTORY_COMMITS)
    ) {
      context.addIssue({
        code: "custom",
        message: "Truncated history must contain the maximum ready records.",
      });
    }

    if (observation.status === "ready") {
      if (
        observation.root === null ||
        observation.headCommit === null ||
        observation.commits.length === 0 ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Ready history requires a root, HEAD, commits, and no error.",
        });
      }
      return;
    }

    if (observation.commits.length !== 0 || observation.truncated) {
      context.addIssue({
        code: "custom",
        message: "Unavailable history cannot contain commit evidence.",
      });
    }
    if ((observation.status === "error") !== (observation.error !== null)) {
      context.addIssue({
        code: "custom",
        message: "History error evidence must match status.",
      });
    }
    if (
      observation.status === "empty" &&
      (observation.root === null || observation.headCommit !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Empty history requires a repository with unborn HEAD.",
      });
    }
    if (
      observation.status === "not_repository" &&
      (observation.root !== null || observation.headCommit !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Non-repository history cannot contain repository evidence.",
      });
    }
    if (observation.root === null && observation.headCommit !== null) {
      context.addIssue({
        code: "custom",
        message: "History HEAD evidence requires a known repository root.",
      });
    }
  });
export type GitHistoryObservation = z.infer<typeof GitHistoryObservationSchema>;

const VerificationPresetIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/);
const VerificationDisplayTextSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => !hasLayoutControlCharacter(value));
const VerificationArgumentSchema = z
  .string()
  .max(MAX_VERIFICATION_ARGUMENT_CHARS)
  .refine((value) => !hasLayoutControlCharacter(value));
const VerificationOutputSchema = z
  .string()
  .refine((value) => !hasUnsafeOutputControlCharacter(value), {
    message: "Verification output contains unsafe control characters.",
  })
  .refine(
    (value) => utf8ByteLength(value) <= MAX_VERIFICATION_OUTPUT_BYTES,
    "Verification output exceeds its UTF-8 byte bound.",
  );

export const VerificationPresetSchema = z
  .object({
    id: VerificationPresetIdSchema,
    label: VerificationDisplayTextSchema(80),
    description: VerificationDisplayTextSchema(240),
    executable: z
      .string()
      .min(1)
      .max(4096)
      .startsWith("/")
      .refine((value) => !hasLayoutControlCharacter(value)),
    args: z.array(VerificationArgumentSchema).max(MAX_VERIFICATION_ARGUMENTS),
    timeoutMs: z
      .number()
      .int()
      .min(1000)
      .max(10 * 60 * 1000),
  })
  .strict();
export type VerificationPreset = z.infer<typeof VerificationPresetSchema>;

export const VerificationRunStatusSchema = z.enum([
  "running",
  "cancelling",
  "passed",
  "failed",
  "timed_out",
  "cancelled",
  "error",
]);
export const VerificationHeadComparisonSchema = z.enum([
  "same",
  "changed",
  "unavailable",
]);
export const VerificationRunErrorCodeSchema = z.enum([
  "spawn_failed",
  "process_error",
  "invalid_result",
]);

export const VerificationRunSchema = z
  .object({
    runId: z.string().uuid(),
    presetId: VerificationPresetIdSchema,
    status: VerificationRunStatusSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(15 * 60 * 1000)
      .nullable(),
    headCommitAtStart: GitObjectIdSchema.nullable(),
    headCommitAtEnd: GitObjectIdSchema.nullable(),
    headComparison: VerificationHeadComparisonSchema.nullable(),
    exitCode: z.number().int().nullable(),
    signal: z
      .string()
      .regex(/^SIG[A-Z0-9]+$/)
      .max(32)
      .nullable(),
    terminationForced: z.boolean(),
    stdout: VerificationOutputSchema,
    stderr: VerificationOutputSchema,
    stdoutTruncated: z.boolean(),
    stderrTruncated: z.boolean(),
    error: z
      .object({
        code: VerificationRunErrorCodeSchema,
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((run, context) => {
    const active = run.status === "running" || run.status === "cancelling";
    if (active) {
      if (
        run.completedAt !== null ||
        run.durationMs !== null ||
        run.headCommitAtEnd !== null ||
        run.headComparison !== null ||
        run.exitCode !== null ||
        run.signal !== null ||
        run.terminationForced ||
        run.stdout.length > 0 ||
        run.stderr.length > 0 ||
        run.stdoutTruncated ||
        run.stderrTruncated ||
        run.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "An active verification run cannot contain result evidence.",
        });
      }
      return;
    }

    if (
      run.completedAt === null ||
      run.durationMs === null ||
      run.headComparison === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A completed verification run requires completion evidence.",
      });
      return;
    }

    const bothHeadsKnown =
      run.headCommitAtStart !== null && run.headCommitAtEnd !== null;
    if (
      (bothHeadsKnown && run.headComparison === "unavailable") ||
      (!bothHeadsKnown && run.headComparison !== "unavailable") ||
      (bothHeadsKnown &&
        run.headComparison === "same" &&
        run.headCommitAtStart !== run.headCommitAtEnd) ||
      (bothHeadsKnown &&
        run.headComparison === "changed" &&
        run.headCommitAtStart === run.headCommitAtEnd)
    ) {
      context.addIssue({
        code: "custom",
        message: "HEAD comparison must match the observed commits.",
      });
    }

    if (
      run.status === "passed" &&
      (run.exitCode !== 0 ||
        run.signal !== null ||
        run.terminationForced ||
        run.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A passing run requires a clean zero exit.",
      });
    }
    if (
      run.status === "failed" &&
      ((run.exitCode === null && run.signal === null) ||
        run.exitCode === 0 ||
        run.terminationForced ||
        run.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A failed run requires nonzero exit or signal evidence.",
      });
    }
    if (
      (run.status === "timed_out" || run.status === "cancelled") &&
      run.error !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Termination outcomes cannot contain execution errors.",
      });
    }
    if (
      run.status === "error" &&
      (run.error === null || run.terminationForced)
    ) {
      context.addIssue({
        code: "custom",
        message: "An execution error requires bounded error evidence.",
      });
    }
    if (run.status !== "error" && run.error !== null) {
      context.addIssue({
        code: "custom",
        message: "Only execution errors carry error evidence.",
      });
    }
  });
export type VerificationRun = z.infer<typeof VerificationRunSchema>;

export const VerificationObservationStatusSchema = z.enum([
  "unconfigured",
  "not_repository",
  "no_presets",
  "ready",
  "error",
]);
export const VerificationObservationSchema = z
  .object({
    status: VerificationObservationStatusSchema,
    configured: z.boolean(),
    root: z.string().min(1).max(4096).nullable(),
    observedAt: z.string().datetime(),
    presets: z.array(VerificationPresetSchema).max(MAX_VERIFICATION_PRESETS),
    run: VerificationRunSchema.nullable(),
    error: z
      .object({
        code: z.enum(["repository_unavailable", "invalid_state"]),
        message: z.string().min(1).max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((observation, context) => {
    const presetIds = observation.presets.map(({ id }) => id);
    if (new Set(presetIds).size !== presetIds.length) {
      context.addIssue({
        code: "custom",
        message: "Verification preset IDs must be unique.",
      });
    }
    if (
      observation.run !== null &&
      !presetIds.includes(observation.run.presetId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Verification run must reference an advertised preset.",
      });
    }

    if (observation.status === "unconfigured") {
      if (
        observation.configured ||
        observation.root !== null ||
        observation.presets.length > 0 ||
        observation.run !== null ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Unconfigured verification cannot contain repository state.",
        });
      }
      return;
    }
    if (observation.status === "not_repository") {
      if (
        observation.root !== null ||
        observation.presets.length > 0 ||
        observation.run !== null ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Non-repository verification cannot contain run evidence.",
        });
      }
      return;
    }
    if (observation.status === "no_presets") {
      if (
        !observation.configured ||
        observation.root === null ||
        observation.presets.length > 0 ||
        observation.run !== null ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "A no-presets state requires one configured repository.",
        });
      }
      return;
    }
    if (observation.status === "ready") {
      if (
        !observation.configured ||
        observation.root === null ||
        observation.presets.length === 0 ||
        observation.error !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Ready verification requires configured presets and a root.",
        });
      }
      return;
    }
    if (
      observation.presets.length > 0 ||
      observation.run !== null ||
      observation.error === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Verification errors contain only bounded failure evidence.",
      });
    }
  });
export type VerificationObservation = z.infer<
  typeof VerificationObservationSchema
>;

export const SessionSummarySchema = z
  .object({
    id: SessionIdSchema,
    epoch: z.number().int().positive(),
    displayName: z.string().min(1).max(120),
    cwd: z.string().min(1).max(4096),
    shell: z.string().min(1).max(4096),
    launchPreset: LaunchPresetIdSchema,
    commandLabel: z.string().min(1).max(40),
    agentClassification: AgentClassificationSchema,
    providerObservation: ProviderObservationSnapshotSchema.nullable(),
    relaunchManifest: RelaunchManifestSchema,
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
  })
  .superRefine((session, context) => {
    if (
      (session.launchPreset === "shell" &&
        session.providerObservation !== null) ||
      (session.launchPreset !== "shell" &&
        session.providerObservation?.provider !== session.launchPreset)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Provider observation must match the server-owned launch preset.",
        path: ["providerObservation"],
      });
    }
    if (
      session.relaunchManifest.sessionId !== session.id ||
      session.relaunchManifest.launchPreset !== session.launchPreset ||
      session.relaunchManifest.cwd !== session.cwd
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Relaunch manifest identity and launch context must match the session.",
        path: ["relaunchManifest"],
      });
    }
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
  z
    .object({
      type: z.literal("relaunch.manifest.list"),
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("session.relaunch"),
      requestId: RequestIdSchema,
      manifestId: z.string().uuid(),
      cols: z.number().int().min(2).max(500),
      rows: z.number().int().min(1).max(300),
    })
    .strict(),
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
  z
    .object({
      type: z.literal("repository.changes"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.diff"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      path: RepositoryRelativePathSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.history"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.verification.inspect"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.verification.run"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      presetId: VerificationPresetIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.verification.cancel"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      runId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.config.get"),
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.config.replace"),
      requestId: RequestIdSchema,
      expectedRevision: z.number().int().nonnegative().safe(),
      workspace: PaciumWorkspaceSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.context.inspect"),
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.observe"),
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.item.inspect"),
      requestId: RequestIdSchema,
      ...QueueItemInspectionIdentitySchema.shape,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.question.answer"),
      requestId: RequestIdSchema,
      ...QueueItemInspectionIdentitySchema.shape,
      payload: QueueQuestionAnswerPayloadSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.approval.decide"),
      requestId: RequestIdSchema,
      ...QueueItemInspectionIdentitySchema.shape,
      payload: QueueApprovalDecisionPayloadSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.decision.deliver"),
      requestId: RequestIdSchema,
      decisionId: z.string().uuid(),
      decisionHash: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.decision.resolve"),
      requestId: RequestIdSchema,
      ...QueueResolutionRequestSchema.shape,
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
  z
    .object({
      type: z.literal("server.welcome"),
      protocolVersion: z.literal(PROTOCOL_VERSION),
      serverId: z.string().uuid(),
      platform: z.string(),
      defaultCwd: z.string(),
      connection: ConnectionAccessSchema,
      capabilities: z.object({
        directPty: z.literal(true),
        reconnectSnapshot: z.literal(true),
        tmux: z.literal(false),
        launchPresets: z.array(LaunchPresetCapabilitySchema).length(3),
      }),
    })
    .strict(),
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
  z
    .object({
      type: z.literal("relaunch.manifest.list"),
      requestId: RequestIdSchema,
      manifests: z.array(RelaunchManifestSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("relaunch.manifest.updated"),
      manifest: RelaunchManifestSchema,
    })
    .strict(),
  z.object({
    type: z.literal("session.updated"),
    session: SessionSummarySchema,
  }),
  z
    .object({
      type: z.literal("repository.changes"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      observation: GitChangesObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.diff"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      observation: GitDiffObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.history"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      observation: GitHistoryObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.verification"),
      requestId: RequestIdSchema,
      sessionId: SessionIdSchema,
      observation: VerificationObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("repository.verification.updated"),
      sessionId: SessionIdSchema,
      observation: VerificationObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.config"),
      requestId: RequestIdSchema,
      observation: PaciumConfigObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.context"),
      requestId: RequestIdSchema,
      observation: PaciumContextObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.sources"),
      requestId: RequestIdSchema,
      observation: QueueSourcesObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.sources.updated"),
      observation: QueueSourcesObservationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.item"),
      requestId: RequestIdSchema,
      inspection: QueueItemInspectionSchema,
      decisionState: QueueItemDecisionStateSchema.nullable(),
      deliveryState: QueueDeliveryStateSchema.nullable(),
      reconciliation: QueueItemReconciliationSchema.nullable(),
    })
    .strict()
    .superRefine((message, context) => {
      if (
        (message.inspection.status === "ready") !==
        (message.decisionState !== null)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Only a ready queue item inspection contains decision state.",
        });
      }
      const decided =
        message.inspection.status === "ready" &&
        message.decisionState?.status === "decided";
      if (decided !== (message.deliveryState !== null)) {
        context.addIssue({
          code: "custom",
          message:
            "Only a decided queue item inspection contains delivery state.",
        });
      }
      if (decided !== (message.reconciliation !== null)) {
        context.addIssue({
          code: "custom",
          message:
            "Only a decided queue item inspection contains reconciliation state.",
        });
      }
      if (
        message.decisionState?.status === "decided" &&
        message.decisionState.decision !== null &&
        message.deliveryState !== null &&
        (message.deliveryState.decisionId !==
          message.decisionState.decision.decisionId ||
          message.deliveryState.decisionHash !==
            message.decisionState.decision.decisionHash)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Queue item delivery state must reference its immutable decision.",
        });
      }
      if (
        message.decisionState?.status === "decided" &&
        message.decisionState.decision !== null &&
        message.reconciliation !== null &&
        (message.reconciliation.decisionId !==
          message.decisionState.decision.decisionId ||
          message.reconciliation.decisionHash !==
            message.decisionState.decision.decisionHash)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Queue item reconciliation must reference its immutable decision.",
        });
      }
    }),
  z
    .object({
      type: z.literal("pacium.queue.decision"),
      requestId: RequestIdSchema,
      result: QueueDecisionResultSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.delivery"),
      requestId: RequestIdSchema,
      result: QueueDeliveryResultSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("pacium.queue.resolution"),
      requestId: RequestIdSchema,
      result: QueueResolutionResultSchema,
    })
    .strict(),
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

function isRepositoryRelativePath(value: string): boolean {
  const segments = value.split(/[\\/]/);
  return (
    !value.includes("\0") &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !segments.includes("..")
  );
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function patchLineCount(value: string): number {
  const lines = value.split("\n");
  return value.endsWith("\n") ? lines.length - 1 : lines.length;
}

function hasLayoutControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function hasUnsafeOutputControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      codePoint !== 0x09 &&
      codePoint !== 0x0a &&
      (codePoint <= 0x1f || codePoint === 0x7f)
    );
  });
}

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
