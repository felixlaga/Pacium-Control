import type { GitHistoryObservation } from "@pacium/contracts";

export type RepositoryHistoryViewState =
  | { status: "idle" }
  | {
      status: "loading";
      requestId: string;
      sessionId: string;
      previous: GitHistoryObservation | null;
    }
  | {
      status: "loaded";
      requestId: string;
      sessionId: string;
      observation: GitHistoryObservation;
    };

export const IDLE_REPOSITORY_HISTORY: RepositoryHistoryViewState = {
  status: "idle",
};

export function beginRepositoryHistoryRequest(
  current: RepositoryHistoryViewState,
  sessionId: string,
  requestId: string,
): RepositoryHistoryViewState {
  const sameSession =
    current.status !== "idle" && current.sessionId === sessionId;
  return {
    status: "loading",
    requestId,
    sessionId,
    previous:
      sameSession && current.status === "loaded"
        ? current.observation
        : sameSession && current.status === "loading"
          ? current.previous
          : null,
  };
}

export function acceptRepositoryHistoryResponse(
  current: RepositoryHistoryViewState,
  requestId: string,
  sessionId: string,
  observation: GitHistoryObservation,
): RepositoryHistoryViewState {
  if (
    current.status !== "loading" ||
    current.requestId !== requestId ||
    current.sessionId !== sessionId
  ) {
    return current;
  }
  return {
    status: "loaded",
    requestId,
    sessionId,
    observation,
  };
}

export function interruptRepositoryHistoryRequest(
  current: RepositoryHistoryViewState,
): RepositoryHistoryViewState {
  if (current.status !== "loading") {
    return current;
  }
  if (current.previous === null) {
    return IDLE_REPOSITORY_HISTORY;
  }
  return {
    status: "loaded",
    requestId: current.requestId,
    sessionId: current.sessionId,
    observation: current.previous,
  };
}

export function visibleRepositoryHistory(
  state: RepositoryHistoryViewState,
): GitHistoryObservation | null {
  return state.status === "loaded"
    ? state.observation
    : state.status === "loading"
      ? state.previous
      : null;
}
