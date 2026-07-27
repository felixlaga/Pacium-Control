import type {
  LaunchPresetCapability,
  LaunchPresetId,
  PaciumBinding,
  PaciumRoleId,
  PaciumWorkspace,
  SessionSummary,
} from "@pacium/contracts";

import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import type { ConnectionState } from "./transport.js";

export type PaciumRoleStatus =
  | "loading"
  | "unconfigured"
  | "error"
  | "unassigned"
  | "starting"
  | "connected"
  | "ending"
  | "ended"
  | "failed"
  | "missing"
  | "ready"
  | "unavailable"
  | "launching"
  | "binding";

export type PendingPaciumRoleLaunch =
  | {
      role: PaciumRoleId;
      requestId: string;
      sourceRevision: number;
      stage: "launching";
    }
  | {
      role: PaciumRoleId;
      requestId: string;
      sourceRevision: number;
      stage: "binding";
      sessionId: string;
    };

export interface PaciumRoleModel {
  role: PaciumRoleId;
  label: string;
  status: PaciumRoleStatus;
  statusLabel: string;
  detail: string;
  context: string | null;
  connectionLabel: "Server connected" | "Server disconnected";
  sessionId: string | null;
  launchPreset: LaunchPresetId | null;
  launchCwd: string | null;
  canOpen: boolean;
  canLaunch: boolean;
  canConfigure: boolean;
  canRetry: boolean;
  saving: boolean;
}

const ROLE_LABELS: Record<PaciumRoleId, string> = {
  meta: "Meta",
  orchestrator: "Orchestrator",
};

export function buildPaciumRoleModels(input: {
  config: PaciumConfigViewState;
  connection: ConnectionState;
  sessions: readonly SessionSummary[];
  launchPresets: readonly LaunchPresetCapability[];
  defaultCwd: string;
  pendingLaunch?: PendingPaciumRoleLaunch | null;
}): [PaciumRoleModel, PaciumRoleModel] {
  return [
    buildPaciumRoleModel("meta", input),
    buildPaciumRoleModel("orchestrator", input),
  ];
}

export function buildPaciumRoleModel(
  role: PaciumRoleId,
  input: {
    config: PaciumConfigViewState;
    connection: ConnectionState;
    sessions: readonly SessionSummary[];
    launchPresets: readonly LaunchPresetCapability[];
    defaultCwd: string;
    pendingLaunch?: PendingPaciumRoleLaunch | null;
  },
): PaciumRoleModel {
  const connected = input.connection === "connected";
  const saving = input.config.status === "replacing";
  const common = {
    role,
    label: ROLE_LABELS[role],
    connectionLabel: connected
      ? ("Server connected" as const)
      : ("Server disconnected" as const),
    canOpen: false,
    canLaunch: false,
    canConfigure: false,
    canRetry: false,
    saving,
    sessionId: null,
    launchPreset: null,
    launchCwd: null,
  };
  const observation = visiblePaciumConfig(input.config);

  if (observation === null) {
    return {
      ...common,
      status: "loading",
      statusLabel: connected ? "Loading definition" : "Disconnected",
      detail: connected
        ? "Reading the server-owned role definition."
        : "Waiting for fresh role evidence. Terminals remain available.",
      context: null,
      canRetry: connected && input.config.status === "idle",
    };
  }
  if (observation.status === "error") {
    return {
      ...common,
      status: "error",
      statusLabel: connected ? "Configuration error" : "Disconnected",
      detail:
        observation.error?.message ??
        "The server returned incomplete configuration evidence.",
      context: "Role changes are blocked. General terminals remain available.",
      canRetry: connected && !saving,
    };
  }
  if (observation.status === "unconfigured") {
    return {
      ...common,
      status: "unconfigured",
      statusLabel: connected ? "Setup needed" : "Disconnected",
      detail: "This role has not been assigned.",
      context: "Assign a live terminal or a fixed launch preset.",
      canConfigure: connected && !saving,
    };
  }

  const workspace = observation.workspace;
  if (workspace === null) {
    return {
      ...common,
      status: "error",
      statusLabel: connected ? "Configuration error" : "Disconnected",
      detail: "The server returned incomplete configuration evidence.",
      context: "Role changes are blocked. General terminals remain available.",
      canRetry: connected && !saving,
    };
  }

  const pending =
    input.pendingLaunch?.role === role ? input.pendingLaunch : null;
  if (pending !== null) {
    return {
      ...common,
      status: pending.stage,
      statusLabel:
        pending.stage === "launching"
          ? "Starting terminal"
          : "Binding terminal",
      detail:
        pending.stage === "launching"
          ? "The fixed preset is starting as a direct PTY."
          : "The terminal is running while Pacium saves its exact session ID.",
      context: "No launch or config retry runs automatically.",
    };
  }

  const binding = workspace.roles[role];
  if (binding === null) {
    return {
      ...common,
      status: "unassigned",
      statusLabel: connected ? "Not assigned" : "Disconnected",
      detail: "No binding is configured for this role.",
      context: "Assign a live terminal or a fixed launch preset.",
      canConfigure: connected && !saving,
    };
  }

  if (binding.type === "session") {
    return sessionRoleModel(
      binding.sessionId,
      input.sessions,
      connected,
      common,
    );
  }

  return presetRoleModel(binding, workspace, input, common);
}

function sessionRoleModel(
  sessionId: string,
  sessions: readonly SessionSummary[],
  connected: boolean,
  common: Omit<
    PaciumRoleModel,
    "status" | "statusLabel" | "detail" | "context"
  >,
): PaciumRoleModel {
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return {
      ...common,
      status: "missing",
      statusLabel: connected ? "Missing" : "Disconnected · Missing",
      detail: "The configured direct-session ID is not in this server.",
      context: "It may have ended during a local-server restart.",
      sessionId,
      canConfigure: connected && !common.saving,
    };
  }

  const state = session.processState;
  const status: PaciumRoleStatus =
    state === "creating"
      ? "starting"
      : state === "live"
        ? "connected"
        : state === "closing"
          ? "ending"
          : state === "failed"
            ? "failed"
            : "ended";
  const statusLabel =
    state === "creating"
      ? "Starting"
      : state === "live"
        ? "Connected"
        : state === "closing"
          ? "Ending"
          : state === "failed"
            ? "Failed"
            : "Ended";

  return {
    ...common,
    status,
    statusLabel: connected ? statusLabel : `Disconnected · ${statusLabel}`,
    detail: `${session.commandLabel} · ${session.displayName}`,
    context: session.cwd,
    sessionId,
    canOpen: true,
    canConfigure: connected && !common.saving,
  };
}

function presetRoleModel(
  binding: Extract<PaciumBinding, { type: "launch_preset" }>,
  workspace: PaciumWorkspace,
  input: {
    connection: ConnectionState;
    launchPresets: readonly LaunchPresetCapability[];
    defaultCwd: string;
  },
  common: Omit<
    PaciumRoleModel,
    "status" | "statusLabel" | "detail" | "context"
  >,
): PaciumRoleModel {
  const capability = input.launchPresets.find(
    (candidate) => candidate.id === binding.launchPreset,
  );
  const repository =
    binding.repositoryId === null
      ? null
      : (workspace.repositories.find(
          (candidate) => candidate.id === binding.repositoryId,
        ) ?? null);
  const cwd = repository?.root ?? input.defaultCwd;
  const available = capability?.available === true && cwd.length > 0;
  const connected = input.connection === "connected";

  return {
    ...common,
    status: available ? "ready" : "unavailable",
    statusLabel: connected
      ? available
        ? "Ready to launch"
        : "Preset unavailable"
      : `Disconnected · ${available ? "Ready" : "Unavailable"}`,
    detail: capability?.label ?? binding.launchPreset,
    context:
      repository === null
        ? cwd.length > 0
          ? `Server default · ${cwd}`
          : "Server default directory unavailable."
        : `${repository.label} · ${repository.root}`,
    launchPreset: binding.launchPreset,
    launchCwd: cwd.length > 0 ? cwd : null,
    canLaunch: connected && available && !common.saving,
    canConfigure: connected && !common.saving,
  };
}

export function roleLabel(role: PaciumRoleId): string {
  return ROLE_LABELS[role];
}
