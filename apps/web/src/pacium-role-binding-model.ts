import type {
  LaunchPresetCapability,
  LaunchPresetId,
  PaciumBinding,
  PaciumRoleId,
  PaciumWorkspace,
  SessionSummary,
} from "@pacium/contracts";

export interface PaciumRoleSessionOption {
  id: string;
  label: string;
  detail: string;
}

export interface PaciumRolePresetOption {
  id: LaunchPresetId;
  label: string;
  available: boolean;
  unavailableReason: string | null;
}

export interface PaciumRoleRepositoryOption {
  id: string;
  label: string;
  root: string;
}

export interface PaciumRoleBindingOptions {
  sessions: PaciumRoleSessionOption[];
  presets: PaciumRolePresetOption[];
  repositories: PaciumRoleRepositoryOption[];
}

export type PaciumRoleBindingDraft =
  | {
      type: "session";
      sessionId: string;
    }
  | {
      type: "launch_preset";
      launchPreset: LaunchPresetId;
      repositoryId: string | null;
    };

export function buildPaciumRoleBindingOptions(input: {
  role: PaciumRoleId;
  workspace: PaciumWorkspace | null;
  sessions: readonly SessionSummary[];
  launchPresets: readonly LaunchPresetCapability[];
}): PaciumRoleBindingOptions {
  const occupied = occupiedSessionIds(input.workspace, input.role);
  return {
    sessions: input.sessions
      .filter(
        (session) =>
          session.processState === "live" && !occupied.has(session.id),
      )
      .map((session) => ({
        id: session.id,
        label: session.displayName,
        detail: `${session.commandLabel} · ${session.cwd}`,
      })),
    presets: input.launchPresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      available: preset.available,
      unavailableReason: preset.unavailableReason,
    })),
    repositories:
      input.workspace?.repositories.map((repository) => ({
        id: repository.id,
        label: repository.label,
        root: repository.root,
      })) ?? [],
  };
}

export function initialPaciumRoleBindingDraft(
  binding: PaciumBinding | null,
  options: PaciumRoleBindingOptions,
): PaciumRoleBindingDraft | null {
  if (
    binding?.type === "session" &&
    options.sessions.some((option) => option.id === binding.sessionId)
  ) {
    return binding;
  }
  if (
    binding?.type === "launch_preset" &&
    options.presets.some(
      (option) => option.id === binding.launchPreset && option.available,
    ) &&
    (binding.repositoryId === null ||
      options.repositories.some((option) => option.id === binding.repositoryId))
  ) {
    return binding;
  }
  const firstSession = options.sessions[0];
  if (firstSession !== undefined) {
    return { type: "session", sessionId: firstSession.id };
  }
  const firstPreset = options.presets.find((option) => option.available);
  return firstPreset === undefined
    ? null
    : {
        type: "launch_preset",
        launchPreset: firstPreset.id,
        repositoryId: null,
      };
}

export function bindingFromDraft(
  draft: PaciumRoleBindingDraft | null,
  options: PaciumRoleBindingOptions,
): PaciumBinding | null {
  if (draft === null) {
    return null;
  }
  if (draft.type === "session") {
    return options.sessions.some((option) => option.id === draft.sessionId)
      ? { type: "session", sessionId: draft.sessionId }
      : null;
  }
  const preset = options.presets.find(
    (option) => option.id === draft.launchPreset,
  );
  const repositoryValid =
    draft.repositoryId === null ||
    options.repositories.some((option) => option.id === draft.repositoryId);
  return preset?.available === true && repositoryValid
    ? {
        type: "launch_preset",
        launchPreset: draft.launchPreset,
        repositoryId: draft.repositoryId,
      }
    : null;
}

export function createMinimalPaciumWorkspace(
  role: PaciumRoleId,
  binding: PaciumBinding,
): PaciumWorkspace {
  return {
    id: "primary",
    label: "Pacium",
    repositories: [],
    roles: {
      meta: role === "meta" ? binding : null,
      orchestrator: role === "orchestrator" ? binding : null,
    },
    workers: [],
    queueSources: [],
    deliveryMethods: [],
    context: {
      objective: null,
      plan: null,
    },
  };
}

export function replacePaciumRoleBinding(
  workspace: PaciumWorkspace,
  role: PaciumRoleId,
  binding: PaciumBinding,
): PaciumWorkspace {
  return {
    ...workspace,
    roles: {
      ...workspace.roles,
      [role]: binding,
    },
  };
}

function occupiedSessionIds(
  workspace: PaciumWorkspace | null,
  editedRole: PaciumRoleId,
): Set<string> {
  if (workspace === null) {
    return new Set();
  }
  const bindings = [
    editedRole === "meta" ? null : workspace.roles.meta,
    editedRole === "orchestrator" ? null : workspace.roles.orchestrator,
    ...workspace.workers.map((worker) => worker.binding),
  ];
  return new Set(
    bindings.flatMap((binding) =>
      binding?.type === "session" ? [binding.sessionId] : [],
    ),
  );
}
