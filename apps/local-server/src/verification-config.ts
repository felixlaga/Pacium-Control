import {
  accessSync,
  constants,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

import { z } from "zod";

export const MAX_VERIFICATION_CONFIG_BYTES = 64 * 1024;
export const MAX_VERIFICATION_REPOSITORIES = 32;
export const MAX_VERIFICATION_PRESETS_PER_REPOSITORY = 16;
export const MAX_VERIFICATION_ARGUMENTS = 32;
export const MAX_VERIFICATION_ARGUMENT_LENGTH = 512;
export const MAX_VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

const IdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/);
const DisplayTextSchema = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
const PathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => isAbsolute(value), "Path must be absolute.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    "Path contains control characters.",
  );
const ArgumentSchema = z
  .string()
  .max(MAX_VERIFICATION_ARGUMENT_LENGTH)
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    "Argument contains control characters.",
  );

const VerificationPresetFileSchema = z
  .object({
    id: IdentifierSchema,
    label: DisplayTextSchema(80),
    description: DisplayTextSchema(240),
    executable: PathSchema,
    args: z.array(ArgumentSchema).max(MAX_VERIFICATION_ARGUMENTS),
    timeoutMs: z.number().int().min(1000).max(MAX_VERIFICATION_TIMEOUT_MS),
  })
  .strict();

const VerificationRepositoryFileSchema = z
  .object({
    root: PathSchema,
    presets: z
      .array(VerificationPresetFileSchema)
      .min(1)
      .max(MAX_VERIFICATION_PRESETS_PER_REPOSITORY),
  })
  .strict()
  .superRefine(({ presets }, context) => {
    const seenIds = new Set<string>();
    for (const [index, preset] of presets.entries()) {
      if (seenIds.has(preset.id)) {
        context.addIssue({
          code: "custom",
          path: ["presets", index, "id"],
          message: "Preset IDs must be unique within a repository.",
        });
      }
      seenIds.add(preset.id);
    }
  });

const VerificationConfigFileSchema = z
  .object({
    version: z.literal(1),
    repositories: z
      .array(VerificationRepositoryFileSchema)
      .max(MAX_VERIFICATION_REPOSITORIES),
  })
  .strict();

export interface VerificationPresetDefinition {
  id: string;
  label: string;
  description: string;
  executable: string;
  args: readonly string[];
  timeoutMs: number;
}

export interface VerificationRepositoryDefinition {
  root: string;
  presets: readonly VerificationPresetDefinition[];
}

export interface VerificationCatalog {
  configured: boolean;
  repositories: readonly VerificationRepositoryDefinition[];
}

export function loadVerificationCatalog(
  configuredPath: string | undefined,
): VerificationCatalog {
  if (configuredPath === undefined) {
    return { configured: false, repositories: [] };
  }
  if (!isAbsolute(configuredPath)) {
    throw new Error("PACIUM_VERIFICATION_CONFIG must be an absolute path.");
  }

  const fileStatus = lstatSync(configuredPath);
  if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
    throw new Error(
      "PACIUM_VERIFICATION_CONFIG must name a regular non-symlink file.",
    );
  }
  if (
    fileStatus.size === 0 ||
    fileStatus.size > MAX_VERIFICATION_CONFIG_BYTES
  ) {
    throw new Error(
      `PACIUM_VERIFICATION_CONFIG must be between 1 and ${MAX_VERIFICATION_CONFIG_BYTES} bytes.`,
    );
  }

  const configPath = realpathSync(configuredPath);
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new Error("PACIUM_VERIFICATION_CONFIG must contain valid JSON.");
  }

  const parsed = VerificationConfigFileSchema.parse(document);
  const seenRoots = new Set<string>();
  const repositories = parsed.repositories.map((repository) => {
    const root = canonicalDirectory(repository.root);
    if (seenRoots.has(root)) {
      throw new Error(
        "PACIUM_VERIFICATION_CONFIG contains duplicate canonical repository roots.",
      );
    }
    seenRoots.add(root);
    if (isWithin(root, configPath)) {
      throw new Error(
        "PACIUM_VERIFICATION_CONFIG must be outside every configured repository.",
      );
    }

    return {
      root,
      presets: repository.presets.map((preset) => ({
        ...preset,
        executable: canonicalExecutable(preset.executable),
      })),
    };
  });

  return { configured: true, repositories };
}

export function verificationPresetsForRepository(
  catalog: VerificationCatalog,
  repositoryRoot: string,
): readonly VerificationPresetDefinition[] {
  return (
    catalog.repositories.find(
      (repository) => repository.root === repositoryRoot,
    )?.presets ?? []
  );
}

function canonicalDirectory(path: string): string {
  const canonical = realpathSync(path);
  if (!statSync(canonical).isDirectory()) {
    throw new Error(
      "Configured verification repository root is not a directory.",
    );
  }
  return canonical;
}

function canonicalExecutable(path: string): string {
  accessSync(path, constants.X_OK);
  const canonical = realpathSync(path);
  if (!statSync(canonical).isFile()) {
    throw new Error("Configured verification executable is not a file.");
  }
  return canonical;
}

function isWithin(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== ".." &&
      !isAbsolute(pathFromParent))
  );
}
