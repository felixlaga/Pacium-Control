import { z } from "zod";

import { ProviderIdSchema } from "./provider-observation.js";
import { TmuxTargetSchema } from "./tmux.js";

export const RELAUNCH_MANIFEST_SCHEMA_VERSION = 1 as const;
export const RELAUNCH_MANIFEST_STATE_SCHEMA_VERSION = 1 as const;
export const MAX_RELAUNCH_MANIFESTS = 100;
export const MAX_RELAUNCH_COMMAND_ARGUMENTS = 16;
export const MAX_RELAUNCH_ENVIRONMENT_KEYS = 32;

const SessionIdSchema = z.string().uuid();
const LaunchPresetIdSchema = z.enum(["shell", "codex", "claude"]);
const SafeEnvironmentKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Z_][A-Z0-9_]*$/);

export const RelaunchResumeReferenceSchema = z
  .object({
    provider: ProviderIdSchema,
    id: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => !containsControlCharacter(value), {
        message: "Provider resume reference cannot contain controls.",
      }),
    observedAt: z.string().datetime(),
  })
  .strict();

export const RelaunchManifestSchema = z
  .object({
    schemaVersion: z.literal(RELAUNCH_MANIFEST_SCHEMA_VERSION),
    id: z.string().uuid(),
    sessionId: SessionIdSchema,
    predecessorSessionId: SessionIdSchema.nullable(),
    displayName: z.string().min(1).max(120),
    launchPreset: LaunchPresetIdSchema,
    provider: ProviderIdSchema.nullable(),
    command: z
      .object({
        executable: z.string().min(1).max(4096),
        args: z.array(z.string().max(512)).max(MAX_RELAUNCH_COMMAND_ARGUMENTS),
      })
      .strict(),
    cwd: z.string().min(1).max(4096),
    repository: z
      .object({
        root: z.string().min(1).max(4096),
        name: z.string().min(1).max(255),
      })
      .strict()
      .nullable(),
    environmentKeys: z
      .array(SafeEnvironmentKeySchema)
      .max(MAX_RELAUNCH_ENVIRONMENT_KEYS),
    runtime: z.enum(["pty", "tmux"]),
    tmuxTarget: TmuxTargetSchema.nullable().optional(),
    resumeReference: RelaunchResumeReferenceSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (
      (manifest.launchPreset === "shell" && manifest.provider !== null) ||
      (manifest.launchPreset !== "shell" &&
        manifest.provider !== manifest.launchPreset)
    ) {
      context.addIssue({
        code: "custom",
        message: "Manifest provider must match its launch preset.",
        path: ["provider"],
      });
    }
    if (
      (manifest.runtime === "tmux") !==
      ((manifest.tmuxTarget ?? null) !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only a tmux manifest contains a tmux target.",
        path: ["tmuxTarget"],
      });
    }
    if (
      manifest.resumeReference !== null &&
      manifest.resumeReference.provider !== manifest.provider
    ) {
      context.addIssue({
        code: "custom",
        message: "Resume reference must match the manifest provider.",
        path: ["resumeReference"],
      });
    }
    if (
      new Set(manifest.environmentKeys).size !== manifest.environmentKeys.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Manifest environment keys must be unique.",
        path: ["environmentKeys"],
      });
    }
    if (Date.parse(manifest.updatedAt) < Date.parse(manifest.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "Manifest update cannot precede creation.",
        path: ["updatedAt"],
      });
    }
    if (
      manifest.predecessorSessionId !== null &&
      manifest.predecessorSessionId === manifest.sessionId
    ) {
      context.addIssue({
        code: "custom",
        message: "A manifest cannot name itself as predecessor.",
        path: ["predecessorSessionId"],
      });
    }
  });

export type RelaunchManifest = z.infer<typeof RelaunchManifestSchema>;

export const RelaunchManifestStateSchema = z
  .object({
    schemaVersion: z.literal(RELAUNCH_MANIFEST_STATE_SCHEMA_VERSION),
    manifests: z.array(RelaunchManifestSchema).max(MAX_RELAUNCH_MANIFESTS),
  })
  .strict()
  .superRefine((state, context) => {
    const ids = state.manifests.map(({ id }) => id);
    const sessionIds = state.manifests.map(({ sessionId }) => sessionId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Manifest IDs must be unique.",
        path: ["manifests"],
      });
    }
    if (new Set(sessionIds).size !== sessionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Manifest session IDs must be unique.",
        path: ["manifests"],
      });
    }
    for (let index = 1; index < state.manifests.length; index += 1) {
      const previous = state.manifests[index - 1];
      const current = state.manifests[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        previous.createdAt < current.createdAt
      ) {
        context.addIssue({
          code: "custom",
          message: "Manifests must be ordered newest first.",
          path: ["manifests", index],
        });
      }
    }
  });

export type RelaunchManifestState = z.infer<typeof RelaunchManifestStateSchema>;

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}
