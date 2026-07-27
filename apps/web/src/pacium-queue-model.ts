import type {
  PaciumQueueSource,
  QueueSourceObservation,
  QueueSourcesObservation,
} from "@pacium/contracts";

import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import type { ConnectionState } from "./transport.js";

export interface PaciumQueueViewState {
  requestId: string | null;
  observation: QueueSourcesObservation | null;
}

export interface PaciumQueueSourceModel {
  source: PaciumQueueSource;
  observation: QueueSourceObservation | null;
}

export interface QueueClassificationPresentation {
  kind: "none" | "question" | "approval" | "failure" | "review" | "unknown";
  label: string;
  diagnostic: string | null;
}

export interface PaciumQueueProjection {
  status: "loading" | "unconfigured" | "error" | "ready";
  message: string;
  disconnected: boolean;
  canRefresh: boolean;
  workspaceRevision: number | null;
  itemCount: number;
  sources: PaciumQueueSourceModel[];
}

export const IDLE_PACIUM_QUEUE: PaciumQueueViewState = {
  requestId: null,
  observation: null,
};

export function beginPaciumQueueRequest(
  state: PaciumQueueViewState,
  requestId: string,
): PaciumQueueViewState {
  return { ...state, requestId };
}

export function acceptPaciumQueueResponse(
  state: PaciumQueueViewState,
  requestId: string,
  observation: QueueSourcesObservation,
): PaciumQueueViewState {
  return state.requestId === requestId
    ? { requestId: null, observation }
    : state;
}

export function acceptPaciumQueueUpdate(
  state: PaciumQueueViewState,
  observation: QueueSourcesObservation,
): PaciumQueueViewState {
  const currentRevision = state.observation?.workspaceRevision ?? null;
  const nextRevision = observation.workspaceRevision;
  if (
    currentRevision !== null &&
    nextRevision !== null &&
    nextRevision < currentRevision
  ) {
    return state;
  }
  return { ...state, observation };
}

export function interruptPaciumQueueRequest(
  state: PaciumQueueViewState,
  requestId?: string,
): PaciumQueueViewState {
  if (
    state.requestId === null ||
    (requestId !== undefined && requestId !== state.requestId)
  ) {
    return state;
  }
  return { ...state, requestId: null };
}

export function buildPaciumQueueProjection(input: {
  config: PaciumConfigViewState;
  queue: PaciumQueueViewState;
  connection: ConnectionState;
}): PaciumQueueProjection {
  const config = visiblePaciumConfig(input.config);
  const disconnected = input.connection !== "connected";
  const common = {
    disconnected,
    canRefresh: !disconnected && input.queue.requestId === null,
    workspaceRevision: null,
    itemCount: 0,
  };
  if (config === null) {
    return {
      ...common,
      status: "loading",
      message: "Reading configured queue sources.",
      sources: [],
    };
  }
  if (config.status === "unconfigured") {
    return {
      ...common,
      status: "unconfigured",
      message: "No Pacium queue sources are configured.",
      sources: [],
    };
  }
  if (
    config.status === "error" ||
    config.workspace === null ||
    config.revision === null
  ) {
    return {
      ...common,
      status: "error",
      message:
        config.error?.message ??
        "Queue sources require a valid Pacium configuration.",
      sources: [],
    };
  }

  const observation = input.queue.observation;
  const evidenceCurrent =
    observation?.status === "ready" &&
    observation.workspaceRevision === config.revision;
  const sources = config.workspace.queueSources.map((source) => ({
    source,
    observation: evidenceCurrent
      ? (observation.sources.find(
          (candidate) => candidate.sourceId === source.id,
        ) ?? null)
      : null,
  }));
  const itemCount = sources.filter(
    ({ observation }) =>
      observation?.classification?.status === "candidate" &&
      observation.classification.candidate !== null,
  ).length;
  return {
    ...common,
    workspaceRevision: evidenceCurrent ? observation.workspaceRevision : null,
    itemCount,
    status: "ready",
    message:
      input.queue.requestId !== null
        ? "Refreshing queue source evidence."
        : disconnected
          ? "Last accepted source evidence · disconnected."
          : evidenceCurrent
            ? `${itemCount} current whole-source ${
                itemCount === 1 ? "item" : "items"
              } · decisions stay local until explicit delivery.`
            : "Waiting for queue source evidence at this config revision.",
    sources,
  };
}

export function queueClassificationPresentation(
  observation: QueueSourceObservation | null,
): QueueClassificationPresentation | null {
  if (observation === null) {
    return null;
  }
  if (observation.status === "empty") {
    return {
      kind: "none",
      label: "No item · Empty source",
      diagnostic: null,
    };
  }
  if (observation.status !== "stable" || observation.classification === null) {
    return null;
  }
  const classification = observation.classification;
  if (classification.status === "none") {
    return {
      kind: "none",
      label: "No item · Blank source",
      diagnostic:
        classification.diagnostics.map(({ message }) => message).join(" ") ||
        null,
    };
  }
  const candidate = classification.candidate;
  if (candidate === null) {
    return null;
  }
  return {
    kind: candidate.type,
    label: `${queueItemTypeLabel(candidate.type)} · ${confidenceLabel(
      candidate.confidence,
    )} confidence`,
    diagnostic:
      classification.diagnostics.map(({ message }) => message).join(" ") ||
      null,
  };
}

export function queueItemTypeLabel(
  type: Exclude<QueueClassificationPresentation["kind"], "none">,
): string {
  switch (type) {
    case "question":
      return "Question";
    case "approval":
      return "Approval";
    case "failure":
      return "Failure";
    case "review":
      return "Review";
    case "unknown":
      return "Unknown";
  }
}

export function confidenceLabel(
  confidence: "confirmed" | "high" | "medium" | "low",
): string {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`;
}

export function requestingRoleLabel(
  role: PaciumQueueSource["requestingRole"],
): string {
  return role === "meta"
    ? "Meta"
    : role === "orchestrator"
      ? "Orchestrator"
      : "Unknown requester";
}

export function queueWaitingLabel(
  firstObservedAt: string,
  now = Date.now(),
): string {
  const firstSeen = Date.parse(firstObservedAt);
  if (!Number.isFinite(firstSeen) || firstSeen > now) {
    return "First seen this server run";
  }
  const minutes = Math.floor((now - firstSeen) / 60_000);
  if (minutes < 1) {
    return "Seen <1m this run";
  }
  if (minutes < 60) {
    return `Seen ${minutes}m this run`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Seen ${hours}h this run`;
  }
  return `Seen ${Math.floor(hours / 24)}d this run`;
}
