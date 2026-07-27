import type { VerificationObservation } from "@pacium/contracts";

export type VerificationPendingAction = "run" | "cancel";

export type RepositoryVerificationViewState =
  | { status: "idle" }
  | {
      status: "loading";
      requestId: string;
      sessionId: string;
      previous: VerificationObservation | null;
    }
  | {
      status: "loaded";
      sessionId: string;
      observation: VerificationObservation;
      pendingRequestId: string | null;
      pendingAction: VerificationPendingAction | null;
    };

export const IDLE_REPOSITORY_VERIFICATION: RepositoryVerificationViewState = {
  status: "idle",
};

export function beginVerificationInspect(
  current: RepositoryVerificationViewState,
  sessionId: string,
  requestId: string,
): RepositoryVerificationViewState {
  const previous =
    current.status === "loaded" && current.sessionId === sessionId
      ? current.observation
      : current.status === "loading" && current.sessionId === sessionId
        ? current.previous
        : null;
  return {
    status: "loading",
    requestId,
    sessionId,
    previous,
  };
}

export function beginVerificationAction(
  current: RepositoryVerificationViewState,
  sessionId: string,
  requestId: string,
  action: VerificationPendingAction,
): RepositoryVerificationViewState {
  if (current.status !== "loaded" || current.sessionId !== sessionId) {
    return current;
  }
  return {
    ...current,
    pendingRequestId: requestId,
    pendingAction: action,
  };
}

export function acceptVerificationResponse(
  current: RepositoryVerificationViewState,
  requestId: string,
  sessionId: string,
  observation: VerificationObservation,
): RepositoryVerificationViewState {
  if (
    current.status === "loading" &&
    current.requestId === requestId &&
    current.sessionId === sessionId
  ) {
    return loadedState(sessionId, observation);
  }
  if (
    current.status === "loaded" &&
    current.sessionId === sessionId &&
    current.pendingRequestId === requestId
  ) {
    return loadedState(sessionId, observation);
  }
  return current;
}

export function acceptVerificationUpdate(
  current: RepositoryVerificationViewState,
  sessionId: string,
  observation: VerificationObservation,
): RepositoryVerificationViewState {
  if (current.status === "idle" || current.sessionId !== sessionId) {
    return current;
  }
  return loadedState(sessionId, observation);
}

export function interruptVerificationRequest(
  current: RepositoryVerificationViewState,
): RepositoryVerificationViewState {
  if (current.status === "idle") {
    return current;
  }
  if (current.status === "loading") {
    return current.previous === null
      ? IDLE_REPOSITORY_VERIFICATION
      : loadedState(current.sessionId, current.previous);
  }
  if (current.pendingRequestId === null) {
    return current;
  }
  return loadedState(current.sessionId, current.observation);
}

export function visibleVerificationObservation(
  state: RepositoryVerificationViewState,
): VerificationObservation | null {
  return state.status === "loaded"
    ? state.observation
    : state.status === "loading"
      ? state.previous
      : null;
}

function loadedState(
  sessionId: string,
  observation: VerificationObservation,
): RepositoryVerificationViewState {
  return {
    status: "loaded",
    sessionId,
    observation,
    pendingRequestId: null,
    pendingAction: null,
  };
}
