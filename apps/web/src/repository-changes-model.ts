import type { GitChangesObservation } from "@pacium/contracts";

export type RepositoryChangesViewState =
  | { status: "idle" }
  | {
      status: "loading";
      requestId: string;
      previous: GitChangesObservation | null;
    }
  | {
      status: "loaded";
      requestId: string;
      observation: GitChangesObservation;
    };

export const IDLE_REPOSITORY_CHANGES: RepositoryChangesViewState = {
  status: "idle",
};

export function beginRepositoryChangesRequest(
  current: RepositoryChangesViewState,
  requestId: string,
): RepositoryChangesViewState {
  return {
    status: "loading",
    requestId,
    previous:
      current.status === "loaded"
        ? current.observation
        : current.status === "loading"
          ? current.previous
          : null,
  };
}

export function acceptRepositoryChangesResponse(
  current: RepositoryChangesViewState,
  requestId: string,
  observation: GitChangesObservation,
): RepositoryChangesViewState {
  if (current.status !== "loading" || current.requestId !== requestId) {
    return current;
  }
  return {
    status: "loaded",
    requestId,
    observation,
  };
}

export function interruptRepositoryChangesRequest(
  current: RepositoryChangesViewState,
): RepositoryChangesViewState {
  if (current.status !== "loading") {
    return current;
  }
  if (current.previous === null) {
    return IDLE_REPOSITORY_CHANGES;
  }
  return {
    status: "loaded",
    requestId: current.requestId,
    observation: current.previous,
  };
}

export function visibleRepositoryChanges(
  state: RepositoryChangesViewState,
): GitChangesObservation | null {
  return state.status === "loaded"
    ? state.observation
    : state.status === "loading"
      ? state.previous
      : null;
}
