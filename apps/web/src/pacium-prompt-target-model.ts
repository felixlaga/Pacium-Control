import type {
  PaciumBinding,
  PaciumRoleId,
  SessionSummary,
} from "@pacium/contracts";

import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import type { ConnectionState } from "./transport.js";

export type PaciumPromptTargetId = `role:${PaciumRoleId}` | `worker:${string}`;

export type PaciumPromptTargetStatus =
  | "not_configured"
  | "preset"
  | "missing"
  | "starting"
  | "connected"
  | "ending"
  | "ended"
  | "failed";

export interface PaciumPromptTarget {
  id: PaciumPromptTargetId;
  kind: "role" | "worker";
  label: string;
  status: PaciumPromptTargetStatus;
  statusLabel: string;
  detail: string;
  sessionId: string | null;
  available: boolean;
}

export interface PaciumPromptTargetProjection {
  status: "loading" | "unconfigured" | "error" | "ready";
  message: string;
  targets: PaciumPromptTarget[];
}

export function buildPaciumPromptTargets(input: {
  config: PaciumConfigViewState;
  connection: ConnectionState;
  sessions: readonly SessionSummary[];
}): PaciumPromptTargetProjection {
  const observation = visiblePaciumConfig(input.config);
  if (observation === null) {
    return {
      status: "loading",
      message:
        input.connection === "connected"
          ? "Reading configured prompt targets."
          : "Waiting to reconnect before prompt targets can be resolved.",
      targets: [],
    };
  }
  if (observation.status === "unconfigured") {
    return {
      status: "unconfigured",
      message: "Configure a primary role before sending a prompt.",
      targets: [],
    };
  }
  if (observation.status === "error" || observation.workspace === null) {
    return {
      status: "error",
      message:
        observation.error?.message ??
        "The server returned incomplete prompt-target evidence.",
      targets: [],
    };
  }

  const mutable =
    input.connection === "connected" && input.config.status !== "replacing";
  const targets = [
    targetFromBinding({
      id: "role:meta",
      kind: "role",
      label: "Meta",
      binding: observation.workspace.roles.meta,
      sessions: input.sessions,
      mutable,
      connected: input.connection === "connected",
    }),
    targetFromBinding({
      id: "role:orchestrator",
      kind: "role",
      label: "Orchestrator",
      binding: observation.workspace.roles.orchestrator,
      sessions: input.sessions,
      mutable,
      connected: input.connection === "connected",
    }),
    ...observation.workspace.workers.map((worker) =>
      targetFromBinding({
        id: `worker:${worker.id}`,
        kind: "worker",
        label: worker.label,
        binding: worker.binding,
        sessions: input.sessions,
        mutable,
        connected: input.connection === "connected",
      }),
    ),
  ];

  return {
    status: "ready",
    message:
      input.config.status === "replacing"
        ? "Prompt targets are read-only while workspace configuration is saving."
        : input.connection === "connected"
          ? "Choose one exact live terminal target."
          : "Targets are retained for inspection but sending is disconnected.",
    targets,
  };
}

export function availablePaciumPromptTarget(
  projection: PaciumPromptTargetProjection,
  targetId: PaciumPromptTargetId | null,
): PaciumPromptTarget | null {
  if (targetId === null) {
    return null;
  }
  const target =
    projection.targets.find((candidate) => candidate.id === targetId) ?? null;
  return target?.available === true ? target : null;
}

function targetFromBinding(input: {
  id: PaciumPromptTargetId;
  kind: "role" | "worker";
  label: string;
  binding: PaciumBinding | null;
  sessions: readonly SessionSummary[];
  mutable: boolean;
  connected: boolean;
}): PaciumPromptTarget {
  const common = {
    id: input.id,
    kind: input.kind,
    label: input.label,
    sessionId: null,
    available: false,
  };
  if (input.binding === null) {
    return {
      ...common,
      status: "not_configured",
      statusLabel: "Not assigned",
      detail: "No session or preset binding is configured.",
    };
  }
  if (input.binding.type === "launch_preset") {
    return {
      ...common,
      status: "preset",
      statusLabel: "Ready to launch",
      detail: `Fixed ${input.binding.launchPreset} preset; no live terminal is bound.`,
    };
  }

  const sessionId = input.binding.sessionId;
  const session = input.sessions.find(
    (candidate) => candidate.id === sessionId,
  );
  if (session === undefined) {
    return {
      ...common,
      status: "missing",
      statusLabel: input.connected ? "Missing" : "Disconnected · Missing",
      detail: "The configured direct-session ID is not in this server.",
      sessionId,
    };
  }
  const status: PaciumPromptTargetStatus =
    session.processState === "creating"
      ? "starting"
      : session.processState === "live"
        ? "connected"
        : session.processState === "closing"
          ? "ending"
          : session.processState === "failed"
            ? "failed"
            : "ended";
  const baseLabel =
    status === "starting"
      ? "Starting"
      : status === "connected"
        ? "Connected"
        : status === "ending"
          ? "Ending"
          : status === "failed"
            ? "Failed"
            : "Ended";
  return {
    ...common,
    status,
    statusLabel: input.connected ? baseLabel : `Disconnected · ${baseLabel}`,
    detail: `${session.commandLabel} · ${session.cwd}`,
    sessionId: session.id,
    available: status === "connected" && input.mutable,
  };
}
