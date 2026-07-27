import {
  availablePaciumPromptTarget,
  type PaciumPromptTargetId,
  type PaciumPromptTargetProjection,
} from "./pacium-prompt-target-model.js";

export const MAX_PACIUM_PROMPT_CHARACTERS = 4_000;

export interface PendingPaciumPrompt {
  requestId: string;
  targetId: PaciumPromptTargetId;
  sessionId: string;
}

export interface PaciumPromptState {
  draft: string;
  targetId: PaciumPromptTargetId | null;
  pending: PendingPaciumPrompt | null;
}

export interface PaciumPromptValidation {
  valid: boolean;
  normalized: string | null;
  characterCount: number;
  error: string | null;
}

export const EMPTY_PACIUM_PROMPT: PaciumPromptState = {
  draft: "",
  targetId: null,
  pending: null,
};

export function validatePaciumPrompt(draft: string): PaciumPromptValidation {
  const characterCount = Array.from(draft).length;
  if (characterCount > MAX_PACIUM_PROMPT_CHARACTERS) {
    return {
      valid: false,
      normalized: null,
      characterCount,
      error: `Keep the prompt to ${MAX_PACIUM_PROMPT_CHARACTERS.toLocaleString()} characters.`,
    };
  }
  if (
    Array.from(draft).some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined &&
        (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
      );
    })
  ) {
    return {
      valid: false,
      normalized: null,
      characterCount,
      error: "Line breaks and terminal control characters are not allowed.",
    };
  }
  const normalized = draft.trim();
  if (normalized.length === 0) {
    return {
      valid: false,
      normalized: null,
      characterCount,
      error: "Enter one prompt before sending.",
    };
  }
  return {
    valid: true,
    normalized,
    characterCount,
    error: null,
  };
}

export function paciumPromptTerminalInput(draft: string): string | null {
  const validation = validatePaciumPrompt(draft);
  return validation.normalized === null ? null : `${validation.normalized}\r`;
}

export function canSendPaciumPrompt(
  state: PaciumPromptState,
  targets: PaciumPromptTargetProjection,
): boolean {
  return (
    state.pending === null &&
    validatePaciumPrompt(state.draft).valid &&
    availablePaciumPromptTarget(targets, state.targetId) !== null
  );
}

export function beginPaciumPromptSend(
  state: PaciumPromptState,
  pending: PendingPaciumPrompt,
): PaciumPromptState {
  if (state.pending !== null) {
    return state;
  }
  return { ...state, pending };
}

export function acceptPaciumPromptResult(
  state: PaciumPromptState,
  requestId: string,
): PaciumPromptState {
  return state.pending?.requestId === requestId ? EMPTY_PACIUM_PROMPT : state;
}

export function rejectPaciumPromptResult(
  state: PaciumPromptState,
  requestId: string,
): PaciumPromptState {
  return state.pending?.requestId === requestId
    ? { ...state, pending: null }
    : state;
}

export function interruptPaciumPrompt(
  state: PaciumPromptState,
): PaciumPromptState {
  return {
    draft: state.draft,
    targetId: null,
    pending: null,
  };
}

export function reconcilePaciumPromptTarget(
  state: PaciumPromptState,
  targets: PaciumPromptTargetProjection,
): PaciumPromptState {
  if (
    state.pending !== null ||
    state.targetId === null ||
    availablePaciumPromptTarget(targets, state.targetId) !== null
  ) {
    return state;
  }
  return { ...state, targetId: null };
}
