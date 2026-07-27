import { lstatSync, realpathSync, statSync, type Stats } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

import {
  PaciumWorkspaceSchema,
  type LaunchPresetId,
  type PaciumWorkspace,
} from "@pacium/contracts";

import {
  verificationPresetsForRepository,
  type VerificationCatalog,
} from "./verification-config.js";

export class PaciumConfigValidationError extends Error {}

export interface PaciumWorkspaceValidationContext {
  dataDirectory: string;
  sessionExists(sessionId: string): boolean;
  launchPresetExists(launchPreset: LaunchPresetId): boolean;
  verificationCatalog: VerificationCatalog;
}

export type PersistedPaciumWorkspaceValidationContext = Omit<
  PaciumWorkspaceValidationContext,
  "sessionExists"
>;

export function normalizePaciumWorkspace(
  candidate: PaciumWorkspace,
  context: PaciumWorkspaceValidationContext,
): PaciumWorkspace {
  const normalized = normalizePaciumWorkspacePaths(
    candidate,
    context.dataDirectory,
  );
  validateBindings(normalized, context);
  validateVerificationReferences(normalized, context.verificationCatalog);
  return normalized;
}

export function normalizePaciumWorkspacePaths(
  candidate: PaciumWorkspace,
  dataDirectory: string,
): PaciumWorkspace {
  const parsed = PaciumWorkspaceSchema.parse(candidate);
  const normalizedDataDirectory = canonicalPotentialDirectory(dataDirectory);
  const repositories = parsed.repositories.map((repository) => ({
    ...repository,
    root: canonicalExistingDirectory(repository.root, "Repository root"),
  }));

  for (const repository of repositories) {
    if (isWithin(repository.root, normalizedDataDirectory)) {
      throw new PaciumConfigValidationError(
        "Pacium data directory must be outside configured repositories.",
      );
    }
  }

  const normalized: PaciumWorkspace = {
    ...parsed,
    repositories,
    queueSources: parsed.queueSources.map((source) => ({
      ...source,
      path: canonicalMetadataFile(source.path, "Queue source"),
    })),
    deliveryMethods: parsed.deliveryMethods.map((method) =>
      method.type === "answer_file"
        ? {
            ...method,
            path: canonicalMetadataFile(method.path, "Answer file"),
          }
        : method,
    ),
    context: {
      objective:
        parsed.context.objective === null
          ? null
          : {
              ...parsed.context.objective,
              path: canonicalMetadataFile(
                parsed.context.objective.path,
                "Objective source",
              ),
            },
      plan:
        parsed.context.plan === null
          ? null
          : {
              ...parsed.context.plan,
              path: canonicalMetadataFile(
                parsed.context.plan.path,
                "Plan source",
              ),
            },
    },
  };

  const result = PaciumWorkspaceSchema.safeParse(normalized);
  if (!result.success) {
    throw new PaciumConfigValidationError(
      "Canonical Pacium paths create duplicate or conflicting references.",
    );
  }
  return result.data;
}

export function validatePersistedPaciumWorkspace(
  workspace: PaciumWorkspace,
  context: PersistedPaciumWorkspaceValidationContext,
): void {
  const normalized = normalizePaciumWorkspace(workspace, {
    ...context,
    sessionExists: () => true,
  });
  if (JSON.stringify(normalized) !== JSON.stringify(workspace)) {
    throw new PaciumConfigValidationError(
      "Persisted Pacium workspace paths are not canonical.",
    );
  }
}

function validateBindings(
  workspace: PaciumWorkspace,
  context: PaciumWorkspaceValidationContext,
): void {
  const bindings = [
    workspace.roles.meta,
    workspace.roles.orchestrator,
    ...workspace.workers.map(({ binding }) => binding),
  ].filter((binding) => binding !== null);
  for (const binding of bindings) {
    if (
      binding.type === "session" &&
      !context.sessionExists(binding.sessionId)
    ) {
      throw new PaciumConfigValidationError(
        "Pacium binding references a session that is not live in this server.",
      );
    }
    if (
      binding.type === "launch_preset" &&
      !context.launchPresetExists(binding.launchPreset)
    ) {
      throw new PaciumConfigValidationError(
        "Pacium binding references an unknown launch preset.",
      );
    }
  }
}

function validateVerificationReferences(
  workspace: PaciumWorkspace,
  catalog: VerificationCatalog,
): void {
  for (const repository of workspace.repositories) {
    const knownIds = new Set(
      verificationPresetsForRepository(catalog, repository.root).map(
        ({ id }) => id,
      ),
    );
    if (
      repository.verificationPresetIds.some(
        (presetId) => !knownIds.has(presetId),
      )
    ) {
      throw new PaciumConfigValidationError(
        "Pacium repository references an unknown verification preset.",
      );
    }
  }
}

export function canonicalPotentialDirectory(path: string): string {
  if (!isAbsolute(path)) {
    throw new PaciumConfigValidationError(
      "Pacium data directory must be absolute.",
    );
  }
  const existing = firstExistingAncestor(path);
  const canonicalAncestor = realpathSync(existing.path);
  if (!statSync(canonicalAncestor).isDirectory()) {
    throw new PaciumConfigValidationError(
      "Pacium data directory ancestor is not a directory.",
    );
  }
  return existing.missingSegments.reduce(
    (parent, segment) => join(parent, segment),
    canonicalAncestor,
  );
}

function canonicalExistingDirectory(path: string, label: string): string {
  let canonical: string;
  try {
    canonical = realpathSync(path);
  } catch {
    throw new PaciumConfigValidationError(
      `${label} must be an existing directory.`,
    );
  }
  if (!statSync(canonical).isDirectory()) {
    throw new PaciumConfigValidationError(`${label} must be a directory.`);
  }
  return canonical;
}

function canonicalMetadataFile(path: string, label: string): string {
  let status: Stats;
  try {
    status = lstatSync(path);
  } catch (error) {
    if (!isMissing(error)) {
      throw new PaciumConfigValidationError(
        `${label} metadata could not be inspected.`,
      );
    }
    const parent = canonicalExistingDirectory(dirname(path), `${label} parent`);
    return join(parent, basename(path));
  }
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new PaciumConfigValidationError(
      `${label} must be a regular non-symlink file or a missing leaf.`,
    );
  }
  return realpathSync(path);
}

function firstExistingAncestor(path: string): {
  path: string;
  missingSegments: string[];
} {
  const missingSegments: string[] = [];
  let candidate = path;
  while (true) {
    try {
      lstatSync(candidate);
      return { path: candidate, missingSegments };
    } catch (error) {
      if (!isMissing(error)) {
        throw new PaciumConfigValidationError(
          "Pacium data directory metadata could not be inspected.",
        );
      }
    }
    const parent = dirname(candidate);
    if (parent === candidate) {
      throw new PaciumConfigValidationError(
        "Pacium data directory has no existing ancestor.",
      );
    }
    missingSegments.unshift(basename(candidate));
    candidate = parent;
  }
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

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
