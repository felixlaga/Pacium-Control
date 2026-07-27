import type { NotificationPreference } from "./preferences-model.js";
import type { AttentionResult } from "./attention-model.js";

export const ATTENTION_INBOX_STORAGE_KEY = "pacium.attentionInbox";
export const ATTENTION_INBOX_SCHEMA_VERSION = 1;
export const MAX_ATTENTION_INBOX_ENTRIES = 200;
export const MAX_ATTENTION_INBOX_JSON_CHARS = 64 * 1024;

export interface AttentionCursorEntry {
  sessionId: string;
  seenKey: string | null;
  notifiedKey: string | null;
  muted: boolean;
}

export interface AttentionInboxState {
  version: 1;
  entries: AttentionCursorEntry[];
}

export const EMPTY_ATTENTION_INBOX: AttentionInboxState = {
  version: ATTENTION_INBOX_SCHEMA_VERSION,
  entries: [],
};

const IMPORTANT_STATES = new Set<AttentionResult["state"]>([
  "needs_input",
  "failed",
  "finished",
]);

export function attentionEventKey(attention: AttentionResult): string | null {
  if (!IMPORTANT_STATES.has(attention.state)) {
    return null;
  }
  return [
    attention.state,
    attention.source,
    attention.confidence,
    attention.observedAt,
  ].join(":");
}

export function parseAttentionInbox(raw: string | null): AttentionInboxState {
  if (raw === null || raw.length > MAX_ATTENTION_INBOX_JSON_CHARS) {
    return EMPTY_ATTENTION_INBOX;
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return EMPTY_ATTENTION_INBOX;
  }
  if (!isRecord(candidate) || candidate.version !== 1) {
    return EMPTY_ATTENTION_INBOX;
  }
  if (
    Object.keys(candidate).length !== 2 ||
    !Array.isArray(candidate.entries) ||
    candidate.entries.length > MAX_ATTENTION_INBOX_ENTRIES
  ) {
    return EMPTY_ATTENTION_INBOX;
  }
  const entries: AttentionCursorEntry[] = [];
  const ids = new Set<string>();
  for (const entry of candidate.entries) {
    if (!isCursorEntry(entry) || ids.has(entry.sessionId)) {
      return EMPTY_ATTENTION_INBOX;
    }
    ids.add(entry.sessionId);
    entries.push(entry);
  }
  return {
    version: 1,
    entries: entries.toSorted((left, right) =>
      left.sessionId.localeCompare(right.sessionId),
    ),
  };
}

export function loadAttentionInbox(
  storage: Pick<Storage, "getItem">,
): AttentionInboxState {
  try {
    return parseAttentionInbox(storage.getItem(ATTENTION_INBOX_STORAGE_KEY));
  } catch {
    return EMPTY_ATTENTION_INBOX;
  }
}

export function saveAttentionInbox(
  storage: Pick<Storage, "setItem">,
  state: AttentionInboxState,
): boolean {
  try {
    storage.setItem(
      ATTENTION_INBOX_STORAGE_KEY,
      JSON.stringify(normalizeAttentionInbox(state)),
    );
    return true;
  } catch {
    return false;
  }
}

export function cursorEntry(
  state: AttentionInboxState,
  sessionId: string,
): AttentionCursorEntry {
  return (
    state.entries.find((entry) => entry.sessionId === sessionId) ?? {
      sessionId,
      seenKey: null,
      notifiedKey: null,
      muted: false,
    }
  );
}

export function isAttentionUnread(
  state: AttentionInboxState,
  sessionId: string,
  attention: AttentionResult,
): boolean {
  const key = attentionEventKey(attention);
  return key !== null && cursorEntry(state, sessionId).seenKey !== key;
}

export function acknowledgeAttention(
  state: AttentionInboxState,
  sessionId: string,
  attention: AttentionResult,
): AttentionInboxState {
  const key = attentionEventKey(attention);
  if (key === null) {
    return state;
  }
  return updateCursor(state, sessionId, (entry) => ({
    ...entry,
    seenKey: key,
  }));
}

export function markAttentionNotified(
  state: AttentionInboxState,
  sessionId: string,
  attention: AttentionResult,
): AttentionInboxState {
  const key = attentionEventKey(attention);
  if (key === null) {
    return state;
  }
  return updateCursor(state, sessionId, (entry) => ({
    ...entry,
    notifiedKey: key,
  }));
}

export function setSessionMuted(
  state: AttentionInboxState,
  sessionId: string,
  muted: boolean,
): AttentionInboxState {
  return updateCursor(state, sessionId, (entry) => ({ ...entry, muted }));
}

export function shouldDeliverAttentionNotification(input: {
  attention: AttentionResult;
  entry: AttentionCursorEntry;
  permission: NotificationPermission | "unsupported";
  preference: NotificationPreference;
  visibility: DocumentVisibilityState;
}): boolean {
  const key = attentionEventKey(input.attention);
  return (
    input.preference === "attention" &&
    input.permission === "granted" &&
    input.visibility === "hidden" &&
    key !== null &&
    !input.entry.muted &&
    input.entry.seenKey !== key &&
    input.entry.notifiedKey !== key
  );
}

function updateCursor(
  state: AttentionInboxState,
  sessionId: string,
  update: (entry: AttentionCursorEntry) => AttentionCursorEntry,
): AttentionInboxState {
  const current = cursorEntry(state, sessionId);
  const entries = state.entries.filter(
    (entry) => entry.sessionId !== sessionId,
  );
  entries.push(update(current));
  return normalizeAttentionInbox({ version: 1, entries });
}

function normalizeAttentionInbox(
  state: AttentionInboxState,
): AttentionInboxState {
  const entries = state.entries
    .filter(isCursorEntry)
    .toSorted((left, right) => left.sessionId.localeCompare(right.sessionId))
    .slice(-MAX_ATTENTION_INBOX_ENTRIES);
  return { version: 1, entries };
}

function isCursorEntry(value: unknown): value is AttentionCursorEntry {
  if (!isRecord(value) || Object.keys(value).length !== 4) {
    return false;
  }
  return (
    isBoundedString(value.sessionId, 1, 120) &&
    isOptionalKey(value.seenKey) &&
    isOptionalKey(value.notifiedKey) &&
    typeof value.muted === "boolean"
  );
}

function isOptionalKey(value: unknown): value is string | null {
  return value === null || isBoundedString(value, 1, 300);
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
