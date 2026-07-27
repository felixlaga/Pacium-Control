export const WORKSPACE_MODE_CHORD_TIMEOUT_MS = 1_200;

export interface WorkspaceModeChordState {
  armedAt: number | null;
}

export interface WorkspaceModeChordResult {
  state: WorkspaceModeChordState;
  handled: boolean;
  toggle: boolean;
}

export const IDLE_WORKSPACE_MODE_CHORD: WorkspaceModeChordState = {
  armedAt: null,
};

export function advanceWorkspaceModeChord(
  current: WorkspaceModeChordState,
  input: {
    code: string;
    now: number;
    blocked: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
): WorkspaceModeChordResult {
  if (
    input.blocked ||
    input.metaKey ||
    input.ctrlKey ||
    input.shiftKey ||
    input.altKey
  ) {
    return idleResult();
  }

  if (input.code === "KeyG") {
    return {
      state: { armedAt: input.now },
      handled: true,
      toggle: false,
    };
  }

  if (
    input.code === "KeyP" &&
    current.armedAt !== null &&
    input.now - current.armedAt >= 0 &&
    input.now - current.armedAt <= WORKSPACE_MODE_CHORD_TIMEOUT_MS
  ) {
    return {
      state: IDLE_WORKSPACE_MODE_CHORD,
      handled: true,
      toggle: true,
    };
  }

  return idleResult();
}

function idleResult(): WorkspaceModeChordResult {
  return {
    state: IDLE_WORKSPACE_MODE_CHORD,
    handled: false,
    toggle: false,
  };
}
