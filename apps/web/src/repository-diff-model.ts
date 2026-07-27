import type { GitDiffObservation } from "@pacium/contracts";

export type RepositoryDiffViewState =
  | { status: "idle" }
  | {
      status: "loading";
      requestId: string;
      sessionId: string;
      path: string;
      previous: GitDiffObservation | null;
    }
  | {
      status: "loaded";
      requestId: string;
      sessionId: string;
      path: string;
      observation: GitDiffObservation;
    };

export const IDLE_REPOSITORY_DIFF: RepositoryDiffViewState = {
  status: "idle",
};

export function repositoryDiffKey(sessionId: string, path: string): string {
  return `${sessionId}\0${path}`;
}

export function beginRepositoryDiffRequest(
  current: RepositoryDiffViewState,
  sessionId: string,
  path: string,
  requestId: string,
): RepositoryDiffViewState {
  const sameSelection =
    current.status !== "idle" &&
    current.sessionId === sessionId &&
    current.path === path;
  return {
    status: "loading",
    requestId,
    sessionId,
    path,
    previous:
      sameSelection && current.status === "loaded"
        ? current.observation
        : sameSelection && current.status === "loading"
          ? current.previous
          : null,
  };
}

export function acceptRepositoryDiffResponse(
  current: RepositoryDiffViewState,
  requestId: string,
  sessionId: string,
  observation: GitDiffObservation,
): RepositoryDiffViewState {
  if (
    current.status !== "loading" ||
    current.requestId !== requestId ||
    current.sessionId !== sessionId ||
    current.path !== observation.path
  ) {
    return current;
  }
  return {
    status: "loaded",
    requestId,
    sessionId,
    path: observation.path,
    observation,
  };
}

export function interruptRepositoryDiffRequest(
  current: RepositoryDiffViewState,
): RepositoryDiffViewState {
  if (current.status !== "loading") {
    return current;
  }
  if (current.previous === null) {
    return IDLE_REPOSITORY_DIFF;
  }
  return {
    status: "loaded",
    requestId: current.requestId,
    sessionId: current.sessionId,
    path: current.path,
    observation: current.previous,
  };
}

export function visibleRepositoryDiff(
  state: RepositoryDiffViewState,
): GitDiffObservation | null {
  return state.status === "loaded"
    ? state.observation
    : state.status === "loading"
      ? state.previous
      : null;
}
