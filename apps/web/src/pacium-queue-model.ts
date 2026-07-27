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

export interface PaciumQueueProjection {
  status: "loading" | "unconfigured" | "error" | "ready";
  message: string;
  disconnected: boolean;
  canRefresh: boolean;
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
  return {
    ...common,
    status: "ready",
    message:
      input.queue.requestId !== null
        ? "Refreshing queue source evidence."
        : disconnected
          ? "Last accepted source evidence · disconnected."
          : evidenceCurrent
            ? "Stable reads describe source health, not queue items."
            : "Waiting for queue source evidence at this config revision.",
    sources,
  };
}
