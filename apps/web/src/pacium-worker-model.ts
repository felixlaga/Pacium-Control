import type {
  LaunchPresetCapability,
  PaciumWorker,
  PaciumWorkspace,
  SessionSummary,
} from "@pacium/contracts";

import type { AttentionResult } from "./attention-model.js";
import {
  attentionConfidenceLabel,
  attentionSourceLabel,
  attentionStateLabel,
} from "./attention-model.js";
import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import {
  visibleRepositoryChanges,
  type RepositoryChangesViewState,
} from "./repository-changes-model.js";
import type { ConnectionState } from "./transport.js";

export interface PaciumWorkerModel {
  id: string;
  label: string;
  status:
    | "starting"
    | "live"
    | "ending"
    | "ended"
    | "failed"
    | "missing"
    | "preset_ready"
    | "preset_unavailable";
  statusLabel: string;
  commandLabel: string;
  commandEvidence: string;
  repositoryLabel: string;
  repositoryEvidence: string;
  attentionLabel: string;
  attentionEvidence: string;
  attentionObservedAt: string | null;
  changesLabel: string;
  changesEvidence: string;
  sessionId: string | null;
  canOpen: boolean;
}

export interface PaciumWorkersProjection {
  status: "loading" | "unconfigured" | "error" | "ready";
  detail: string;
  workers: PaciumWorkerModel[];
}

export function buildPaciumWorkersProjection(input: {
  config: PaciumConfigViewState;
  connection: ConnectionState;
  sessions: readonly SessionSummary[];
  launchPresets: readonly LaunchPresetCapability[];
  attentionBySession: ReadonlyMap<string, AttentionResult>;
  selectedChanges: {
    sessionId: string;
    state: RepositoryChangesViewState;
  } | null;
}): PaciumWorkersProjection {
  const observation = visiblePaciumConfig(input.config);
  if (observation === null) {
    return {
      status: "loading",
      detail:
        input.connection === "connected"
          ? "Reading configured worker identities."
          : "Waiting for fresh worker evidence. Terminals remain available.",
      workers: [],
    };
  }
  if (observation.status === "unconfigured") {
    return {
      status: "unconfigured",
      detail: "No Pacium workspace is configured.",
      workers: [],
    };
  }
  if (observation.status === "error" || observation.workspace === null) {
    return {
      status: "error",
      detail:
        observation.error?.message ??
        "Configured worker identities are unavailable.",
      workers: [],
    };
  }

  return {
    status: "ready",
    detail:
      observation.workspace.workers.length === 0
        ? "No workers are configured. Ordinary terminals remain available."
        : "Configured identities only. Process evidence does not prove task progress.",
    workers: observation.workspace.workers.map((worker) =>
      projectWorker(worker, observation.workspace!, input),
    ),
  };
}

function projectWorker(
  worker: PaciumWorker,
  workspace: PaciumWorkspace,
  input: {
    connection: ConnectionState;
    sessions: readonly SessionSummary[];
    launchPresets: readonly LaunchPresetCapability[];
    attentionBySession: ReadonlyMap<string, AttentionResult>;
    selectedChanges: {
      sessionId: string;
      state: RepositoryChangesViewState;
    } | null;
  },
): PaciumWorkerModel {
  const binding = worker.binding;
  if (binding.type === "launch_preset") {
    const capability = input.launchPresets.find(
      ({ id }) => id === binding.launchPreset,
    );
    const repository =
      binding.repositoryId === null
        ? null
        : (workspace.repositories.find(
            ({ id }) => id === binding.repositoryId,
          ) ?? null);
    const available = capability?.available === true;
    return {
      id: worker.id,
      label: worker.label,
      status: available ? "preset_ready" : "preset_unavailable",
      statusLabel: connectionLabel(
        input.connection,
        available ? "Configured · not started" : "Preset unavailable",
      ),
      commandLabel: capability?.label ?? binding.launchPreset,
      commandEvidence: "Fixed launch preset · no worker was started",
      repositoryLabel:
        repository?.label ??
        (binding.repositoryId === null
          ? "Server default directory"
          : binding.repositoryId),
      repositoryEvidence:
        repository?.root ??
        (binding.repositoryId === null
          ? "No configured repository"
          : "Configured repository is unavailable"),
      attentionLabel: "Unavailable",
      attentionEvidence: "No exact PTY exists for process evidence.",
      attentionObservedAt: null,
      changesLabel: "Not inspected",
      changesEvidence: "No exact worker PTY owns Git inspection.",
      sessionId: null,
      canOpen: false,
    };
  }

  const session = input.sessions.find(({ id }) => id === binding.sessionId);
  if (session === undefined) {
    return {
      id: worker.id,
      label: worker.label,
      status: "missing",
      statusLabel: connectionLabel(input.connection, "Missing"),
      commandLabel: "Exact session unavailable",
      commandEvidence: `Configured session ${binding.sessionId}`,
      repositoryLabel: "Repository unavailable",
      repositoryEvidence:
        "No replacement was inferred after local-server restart.",
      attentionLabel: "Unavailable",
      attentionEvidence: "The configured direct PTY is not in this server.",
      attentionObservedAt: null,
      changesLabel: "Not inspected",
      changesEvidence: "No exact worker PTY owns Git inspection.",
      sessionId: binding.sessionId,
      canOpen: false,
    };
  }

  const attention = input.attentionBySession.get(session.id) ?? null;
  const changes =
    input.selectedChanges?.sessionId === session.id
      ? visibleRepositoryChanges(input.selectedChanges.state)
      : null;
  const status = processStatus(session.processState);
  return {
    id: worker.id,
    label: worker.label,
    status,
    statusLabel: connectionLabel(
      input.connection,
      processStatusLabel(session.processState),
    ),
    commandLabel: `${session.commandLabel} · ${session.agentClassification.label}`,
    commandEvidence: `${session.agentClassification.source.replaceAll(
      "_",
      " ",
    )} · ${session.agentClassification.confidence} confidence`,
    repositoryLabel: repositoryLabel(session),
    repositoryEvidence: repositoryEvidence(session),
    attentionLabel:
      attention === null ? "Unknown" : attentionStateLabel(attention.state),
    attentionEvidence:
      attention === null
        ? "No attention evidence is available."
        : `${attentionSourceLabel(attention.source)} · ${attentionConfidenceLabel(
            attention.confidence,
          )} · ${attention.reason}`,
    attentionObservedAt: attention?.observedAt ?? null,
    changesLabel: changesLabel(changes),
    changesEvidence: changesEvidence(changes),
    sessionId: session.id,
    canOpen: true,
  };
}

function connectionLabel(connection: ConnectionState, label: string): string {
  return connection === "connected" ? label : `Disconnected · ${label}`;
}

function processStatus(
  state: SessionSummary["processState"],
): PaciumWorkerModel["status"] {
  switch (state) {
    case "creating":
      return "starting";
    case "live":
      return "live";
    case "closing":
      return "ending";
    case "failed":
      return "failed";
    case "exited":
      return "ended";
  }
}

function processStatusLabel(state: SessionSummary["processState"]): string {
  switch (state) {
    case "creating":
      return "Starting";
    case "live":
      return "Live process";
    case "closing":
      return "Ending";
    case "failed":
      return "Failed process";
    case "exited":
      return "Ended";
  }
}

function repositoryLabel(session: SessionSummary): string {
  if (session.repository.status === "ready") {
    return session.repository.name ?? "Repository";
  }
  return session.repository.status === "not_repository"
    ? "Not a repository"
    : "Repository unavailable";
}

function repositoryEvidence(session: SessionSummary): string {
  const repository = session.repository;
  if (repository.status !== "ready") {
    return repository.error?.message ?? session.cwd;
  }
  const head =
    repository.headState === "branch"
      ? (repository.branch ?? "Unknown branch")
      : repository.headState === "detached"
        ? "Detached HEAD"
        : repository.headState === "unborn"
          ? "Unborn HEAD"
          : "Unknown HEAD";
  const worktree =
    repository.worktreeKind === "linked"
      ? "linked worktree"
      : repository.worktreeKind === "main"
        ? "main worktree"
        : "unknown worktree";
  return `${head} · ${worktree}`;
}

function changesLabel(
  changes: ReturnType<typeof visibleRepositoryChanges>,
): string {
  if (changes === null) {
    return "Not inspected";
  }
  if (changes.status === "ready") {
    return changes.files.length === 0
      ? "Clean"
      : `${changes.files.length} changed`;
  }
  return changes.status === "not_repository"
    ? "Not a repository"
    : "Unavailable";
}

function changesEvidence(
  changes: ReturnType<typeof visibleRepositoryChanges>,
): string {
  if (changes === null) {
    return "Open this worker and use Changes or Activity; no background Git read ran.";
  }
  if (changes.status === "ready") {
    if (changes.files.length === 0) {
      return "Git observed a clean working tree.";
    }
    const additions = changes.files.reduce(
      (total, file) => total + (file.additions ?? 0),
      0,
    );
    const deletions = changes.files.reduce(
      (total, file) => total + (file.deletions ?? 0),
      0,
    );
    return `Git observed · +${additions} −${deletions} known lines · authorship unverified`;
  }
  return (
    changes.error?.message ??
    "No changed-file evidence is available for this session."
  );
}
