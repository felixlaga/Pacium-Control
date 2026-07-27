import type {
  PaciumConfigObservation,
  PaciumQueueSource,
  QueueSourceObservation,
  QueueSourceObservationStatus,
  QueueSourcesObservation,
} from "@pacium/contracts";

import type { QueueFileReadResult } from "./queue-file-reader.js";

export interface QueueSourceRuntimeState {
  definition: PaciumQueueSource;
  observation: QueueSourceObservation;
  text: string | null;
}

export interface QueueReadTransition {
  state: QueueSourceRuntimeState;
  changed: boolean;
}

type QueueRuntimeResult = Omit<QueueFileReadResult, "status"> & {
  status: Exclude<QueueSourceObservationStatus, "pending">;
};

export function pendingQueueSource(
  definition: PaciumQueueSource,
  observedAt: string,
): QueueSourceRuntimeState {
  return {
    definition,
    observation: {
      sourceId: definition.id,
      observationRevision: 1,
      status: "pending",
      observedAt,
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      error: null,
    },
    text: null,
  };
}

export function applyQueueFileRead(
  current: QueueSourceRuntimeState,
  result: QueueRuntimeResult,
  observedAt: string,
): QueueReadTransition {
  const candidate: QueueSourceRuntimeState = {
    definition: current.definition,
    observation: {
      sourceId: current.definition.id,
      observationRevision: current.observation.observationRevision,
      status: result.status,
      observedAt,
      byteLength: result.byteLength,
      modifiedAt: result.modifiedAt,
      contentHash: result.contentHash,
      error: result.error,
    },
    text: result.text,
  };
  if (sameQueueEvidence(current, candidate)) {
    return { state: candidate, changed: false };
  }
  return {
    state: {
      ...candidate,
      observation: {
        ...candidate.observation,
        observationRevision: current.observation.observationRevision + 1,
      },
    },
    changed: true,
  };
}

export function queueWatchFailure(
  current: QueueSourceRuntimeState,
  observedAt: string,
): QueueReadTransition {
  return applyQueueFileRead(
    current,
    {
      status: "watch_error",
      byteLength: null,
      modifiedAt: null,
      contentHash: null,
      text: null,
      error: {
        code: "WATCH_FAILED",
        message: "The configured queue source parent could not be watched.",
      },
    },
    observedAt,
  );
}

export function queueSourcesFromConfig(
  observation: PaciumConfigObservation,
  observedAt: string,
): {
  aggregate: QueueSourcesObservation;
  states: QueueSourceRuntimeState[];
} {
  if (observation.status === "unconfigured") {
    return {
      aggregate: {
        status: "unconfigured",
        workspaceRevision: null,
        observedAt,
        sources: [],
        error: null,
      },
      states: [],
    };
  }
  if (
    observation.status === "error" ||
    observation.workspace === null ||
    observation.revision === null
  ) {
    return {
      aggregate: {
        status: "config_error",
        workspaceRevision: null,
        observedAt,
        sources: [],
        error: {
          code: "CONFIG_UNAVAILABLE",
          message:
            observation.error?.message ??
            "Queue observation requires a valid Pacium configuration.",
        },
      },
      states: [],
    };
  }
  const states = observation.workspace.queueSources.map((source) =>
    pendingQueueSource(source, observedAt),
  );
  return {
    aggregate: readyQueueSources(observation.revision, states, observedAt),
    states,
  };
}

export function readyQueueSources(
  workspaceRevision: number,
  states: readonly QueueSourceRuntimeState[],
  observedAt: string,
): QueueSourcesObservation {
  return {
    status: "ready",
    workspaceRevision,
    observedAt,
    sources: states.map(({ observation }) => observation),
    error: null,
  };
}

function sameQueueEvidence(
  left: QueueSourceRuntimeState,
  right: QueueSourceRuntimeState,
): boolean {
  return (
    left.observation.status === right.observation.status &&
    left.observation.byteLength === right.observation.byteLength &&
    left.observation.modifiedAt === right.observation.modifiedAt &&
    left.observation.contentHash === right.observation.contentHash &&
    left.observation.error?.code === right.observation.error?.code &&
    left.observation.error?.message === right.observation.error?.message &&
    left.text === right.text
  );
}
