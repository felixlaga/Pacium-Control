import type {
  PaciumContextObservation,
  PaciumContextSourceObservation,
} from "@pacium/contracts";

import {
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";

export interface PaciumContextSelection {
  workspaceId: string;
  workspaceRevision: number;
}

export interface PaciumContextViewState {
  status: "idle" | "loading" | "ready" | "partial" | "error";
  selection: PaciumContextSelection | null;
  pendingRequestId: string | null;
  observation: PaciumContextObservation | null;
  objectiveText: string | null;
  planText: string | null;
  error: string | null;
}

export function initialPaciumContextState(): PaciumContextViewState {
  return {
    status: "idle",
    selection: null,
    pendingRequestId: null,
    observation: null,
    objectiveText: null,
    planText: null,
    error: null,
  };
}

export function beginPaciumContextInspection(
  state: PaciumContextViewState,
  requestId: string,
  config: PaciumConfigViewState,
): PaciumContextViewState {
  const selection = currentSelection(config);
  if (selection === null) {
    return {
      ...initialPaciumContextState(),
      status: "error",
      error: "Pacium configuration is not ready. Terminals remain available.",
    };
  }
  const retain =
    state.selection?.workspaceId === selection.workspaceId &&
    state.selection.workspaceRevision === selection.workspaceRevision;
  return {
    status: "loading",
    selection,
    pendingRequestId: requestId,
    observation: retain ? state.observation : null,
    objectiveText: retain ? state.objectiveText : null,
    planText: retain ? state.planText : null,
    error: null,
  };
}

export function acceptPaciumContextResponse(
  state: PaciumContextViewState,
  requestId: string,
  observation: PaciumContextObservation,
  config: PaciumConfigViewState,
): PaciumContextViewState {
  if (
    state.pendingRequestId !== requestId ||
    state.selection === null ||
    !sameSelection(state.selection, currentSelection(config))
  ) {
    return state;
  }
  if (observation.status === "unavailable") {
    return {
      ...state,
      status: "error",
      pendingRequestId: null,
      observation,
      objectiveText: null,
      planText: null,
      error: observation.error.message,
    };
  }
  if (
    observation.workspaceId !== state.selection.workspaceId ||
    observation.workspaceRevision !== state.selection.workspaceRevision
  ) {
    return state;
  }

  try {
    return {
      status: observation.status,
      selection: state.selection,
      pendingRequestId: null,
      observation,
      objectiveText: decodeSource(observation.objective),
      planText: decodeSource(observation.plan),
      error: null,
    };
  } catch {
    return {
      ...state,
      status: "error",
      pendingRequestId: null,
      observation: null,
      objectiveText: null,
      planText: null,
      error:
        "Pacium rejected malformed context text. Terminals and source files remain unchanged.",
    };
  }
}

export function reconcilePaciumContextConfig(
  state: PaciumContextViewState,
  config: PaciumConfigViewState,
): PaciumContextViewState {
  if (
    state.selection !== null &&
    sameSelection(state.selection, currentSelection(config))
  ) {
    return state;
  }
  return initialPaciumContextState();
}

export function rejectPaciumContextResponse(
  state: PaciumContextViewState,
  requestId: string,
  message: string,
): PaciumContextViewState {
  if (state.pendingRequestId !== requestId) {
    return state;
  }
  return {
    ...state,
    status: "error",
    pendingRequestId: null,
    observation: null,
    objectiveText: null,
    planText: null,
    error: message,
  };
}

export function clearPaciumContext(): PaciumContextViewState {
  return initialPaciumContextState();
}

function currentSelection(
  config: PaciumConfigViewState,
): PaciumContextSelection | null {
  const observation = visiblePaciumConfig(config);
  if (
    observation?.status !== "ready" ||
    observation.workspace === null ||
    observation.revision === null
  ) {
    return null;
  }
  return {
    workspaceId: observation.workspace.id,
    workspaceRevision: observation.revision,
  };
}

function sameSelection(
  left: PaciumContextSelection,
  right: PaciumContextSelection | null,
): boolean {
  return (
    right !== null &&
    left.workspaceId === right.workspaceId &&
    left.workspaceRevision === right.workspaceRevision
  );
}

function decodeSource(source: PaciumContextSourceObservation): string | null {
  if (source.status !== "ready") {
    return null;
  }
  const binary = atob(source.contentBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== source.byteLength) {
    throw new Error("Context byte length mismatch");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
