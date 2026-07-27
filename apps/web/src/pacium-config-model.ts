import type { PaciumConfigObservation } from "@pacium/contracts";

export type PaciumConfigViewState =
  | { status: "idle" }
  | {
      status: "loading" | "replacing";
      requestId: string;
      previous: PaciumConfigObservation | null;
    }
  | {
      status: "loaded";
      requestId: string;
      observation: PaciumConfigObservation;
    };

export const IDLE_PACIUM_CONFIG: PaciumConfigViewState = { status: "idle" };

export function beginPaciumConfigRequest(
  current: PaciumConfigViewState,
  requestId: string,
  intent: "get" | "replace",
): PaciumConfigViewState {
  return {
    status: intent === "get" ? "loading" : "replacing",
    requestId,
    previous: visiblePaciumConfig(current),
  };
}

export function acceptPaciumConfigResponse(
  current: PaciumConfigViewState,
  requestId: string,
  observation: PaciumConfigObservation,
): PaciumConfigViewState {
  if (
    (current.status !== "loading" && current.status !== "replacing") ||
    current.requestId !== requestId
  ) {
    return current;
  }
  return {
    status: "loaded",
    requestId,
    observation,
  };
}

export function interruptPaciumConfigRequest(
  current: PaciumConfigViewState,
  requestId?: string,
): PaciumConfigViewState {
  if (
    (current.status !== "loading" && current.status !== "replacing") ||
    (requestId !== undefined && current.requestId !== requestId)
  ) {
    return current;
  }
  return current.previous === null
    ? IDLE_PACIUM_CONFIG
    : {
        status: "loaded",
        requestId: current.requestId,
        observation: current.previous,
      };
}

export function visiblePaciumConfig(
  state: PaciumConfigViewState,
): PaciumConfigObservation | null {
  return state.status === "loaded"
    ? state.observation
    : state.status === "idle"
      ? null
      : state.previous;
}
