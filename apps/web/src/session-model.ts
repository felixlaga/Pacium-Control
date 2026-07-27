import type { SessionSummary } from "@pacium/contracts";

export interface SessionGroup {
  key: string;
  label: string;
  kind: "repository" | "folders";
  sessions: SessionSummary[];
}

export interface TerminalTab {
  sessionId: string;
  pinned: boolean;
}

export interface TerminalTabState {
  tabs: TerminalTab[];
  selectedId: string | null;
}

interface StoredTerminalTabs {
  version: 1;
  tabs: TerminalTab[];
}

export type WorkspaceShortcut =
  | { type: "open-command-palette" }
  | { type: "open-shortcut-reference" }
  | { type: "open-settings" }
  | { type: "toggle-sidebar" }
  | { type: "toggle-inspector" }
  | { type: "new-terminal" }
  | { type: "previous-session" }
  | { type: "next-session" }
  | { type: "select-session"; index: number }
  | { type: "split-horizontal" }
  | { type: "split-vertical" }
  | { type: "previous-pane" }
  | { type: "next-pane" }
  | { type: "exit-terminal-capture" };

export function resolveWorkspaceShortcut(input: {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  editable: boolean;
  dialogOpen: boolean;
  terminalCaptured: boolean;
}): WorkspaceShortcut | null {
  if (input.ctrlKey && input.shiftKey && input.code === "Period") {
    return { type: "exit-terminal-capture" };
  }
  if (input.editable || input.dialogOpen || input.terminalCaptured) {
    return null;
  }

  const commandModifier = input.metaKey || input.ctrlKey;
  if (
    commandModifier &&
    !input.shiftKey &&
    !input.altKey &&
    input.code === "KeyK"
  ) {
    return { type: "open-command-palette" };
  }
  if (
    !commandModifier &&
    input.shiftKey &&
    !input.altKey &&
    input.code === "Slash"
  ) {
    return { type: "open-shortcut-reference" };
  }
  if (
    commandModifier &&
    !input.shiftKey &&
    !input.altKey &&
    input.code === "Comma"
  ) {
    return { type: "open-settings" };
  }
  if (commandModifier && !input.altKey && input.code === "KeyB") {
    return {
      type: input.shiftKey ? "toggle-inspector" : "toggle-sidebar",
    };
  }
  if (commandModifier && input.shiftKey && input.code === "KeyT") {
    return { type: "new-terminal" };
  }
  if (commandModifier && input.shiftKey && input.code === "BracketLeft") {
    return { type: "previous-session" };
  }
  if (commandModifier && input.shiftKey && input.code === "BracketRight") {
    return { type: "next-session" };
  }
  if (commandModifier && input.code === "Backslash") {
    return {
      type: input.shiftKey ? "split-vertical" : "split-horizontal",
    };
  }
  if (
    input.altKey &&
    !commandModifier &&
    !input.shiftKey &&
    input.code === "BracketLeft"
  ) {
    return { type: "previous-pane" };
  }
  if (
    input.altKey &&
    !commandModifier &&
    !input.shiftKey &&
    input.code === "BracketRight"
  ) {
    return { type: "next-pane" };
  }
  if (
    commandModifier &&
    !input.shiftKey &&
    !input.altKey &&
    /^Digit[1-9]$/.test(input.code)
  ) {
    return {
      type: "select-session",
      index: Number(input.code.slice(-1)) - 1,
    };
  }
  return null;
}

export function groupSessions(sessions: SessionSummary[]): SessionGroup[] {
  const repositories = new Map<string, SessionGroup>();
  const folders: SessionSummary[] = [];

  for (const session of sessions) {
    if (session.repository.root === null || session.repository.name === null) {
      folders.push(session);
      continue;
    }
    const existing = repositories.get(session.repository.root);
    if (existing === undefined) {
      repositories.set(session.repository.root, {
        key: `repository:${session.repository.root}`,
        label: session.repository.name,
        kind: "repository",
        sessions: [session],
      });
    } else {
      existing.sessions.push(session);
    }
  }

  const groups = [...repositories.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
  if (folders.length > 0) {
    groups.push({
      key: "folders",
      label: "Other folders",
      kind: "folders",
      sessions: folders,
    });
  }
  return groups;
}

export function displayedSessions(
  sessions: SessionSummary[],
): SessionSummary[] {
  return groupSessions(sessions).flatMap((group) => group.sessions);
}

export function adjacentSessionId(
  sessions: SessionSummary[],
  currentId: string | null,
  direction: -1 | 1,
): string | null {
  const displayed = displayedSessions(sessions);
  if (displayed.length === 0) {
    return null;
  }
  const currentIndex = displayed.findIndex(({ id }) => id === currentId);
  if (currentIndex === -1) {
    return displayed[0]?.id ?? null;
  }
  const nextIndex =
    (currentIndex + direction + displayed.length) % displayed.length;
  return displayed[nextIndex]?.id ?? null;
}

export function openTerminalTab(
  tabs: TerminalTab[],
  sessionId: string,
): TerminalTab[] {
  if (tabs.some((tab) => tab.sessionId === sessionId)) {
    return tabs;
  }
  return [...tabs, { sessionId, pinned: false }];
}

export function closeTerminalTab(
  tabs: TerminalTab[],
  sessionId: string,
  selectedId: string | null,
): TerminalTabState {
  const closingIndex = tabs.findIndex((tab) => tab.sessionId === sessionId);
  if (closingIndex === -1) {
    return { tabs, selectedId };
  }

  const remaining = tabs.filter((tab) => tab.sessionId !== sessionId);
  if (selectedId !== sessionId) {
    return { tabs: remaining, selectedId };
  }

  return {
    tabs: remaining,
    selectedId:
      remaining[Math.min(closingIndex, remaining.length - 1)]?.sessionId ??
      null,
  };
}

export function toggleTerminalTabPin(
  tabs: TerminalTab[],
  sessionId: string,
): TerminalTab[] {
  return normalizeTerminalTabs(
    tabs.map((tab) =>
      tab.sessionId === sessionId ? { ...tab, pinned: !tab.pinned } : tab,
    ),
  );
}

export function moveTerminalTab(
  tabs: TerminalTab[],
  sourceId: string,
  targetId: string,
): TerminalTab[] {
  const sourceIndex = tabs.findIndex((tab) => tab.sessionId === sourceId);
  const targetIndex = tabs.findIndex((tab) => tab.sessionId === targetId);
  const source = tabs[sourceIndex];
  const target = tabs[targetIndex];
  if (
    source === undefined ||
    target === undefined ||
    sourceId === targetId ||
    source.pinned !== target.pinned
  ) {
    return tabs;
  }

  const reordered = tabs.filter((tab) => tab.sessionId !== sourceId);
  const updatedTargetIndex = reordered.findIndex(
    (tab) => tab.sessionId === targetId,
  );
  const insertionIndex =
    sourceIndex < targetIndex ? updatedTargetIndex + 1 : updatedTargetIndex;
  reordered.splice(insertionIndex, 0, source);
  return reordered;
}

export function moveTerminalTabByOffset(
  tabs: TerminalTab[],
  sessionId: string,
  direction: -1 | 1,
): TerminalTab[] {
  const sourceIndex = tabs.findIndex((tab) => tab.sessionId === sessionId);
  const source = tabs[sourceIndex];
  const target = tabs[sourceIndex + direction];
  if (
    source === undefined ||
    target === undefined ||
    source.pinned !== target.pinned
  ) {
    return tabs;
  }
  return moveTerminalTab(tabs, sessionId, target.sessionId);
}

export function reconcileTerminalTabs(
  tabs: TerminalTab[],
  sessions: SessionSummary[],
  selectedId: string | null,
): TerminalTabState {
  const sessionIds = new Set(sessions.map((session) => session.id));
  let reconciled = normalizeTerminalTabs(tabs).filter((tab) =>
    sessionIds.has(tab.sessionId),
  );

  if (selectedId !== null && sessionIds.has(selectedId)) {
    reconciled = openTerminalTab(reconciled, selectedId);
    return { tabs: reconciled, selectedId };
  }

  return {
    tabs: reconciled,
    selectedId: reconciled[0]?.sessionId ?? null,
  };
}

export function adjacentTerminalTabId(
  tabs: TerminalTab[],
  currentId: string | null,
  direction: -1 | 1,
): string | null {
  if (tabs.length === 0) {
    return null;
  }
  const currentIndex = tabs.findIndex((tab) => tab.sessionId === currentId);
  if (currentIndex === -1) {
    return tabs[0]?.sessionId ?? null;
  }
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  return tabs[nextIndex]?.sessionId ?? null;
}

export function parseStoredTerminalTabs(value: string | null): TerminalTab[] {
  if (value === null) {
    return [];
  }
  try {
    const candidate = JSON.parse(value) as unknown;
    if (typeof candidate !== "object" || candidate === null) {
      return [];
    }
    const stored = candidate as Record<string, unknown>;
    if (stored.version !== 1 || !Array.isArray(stored.tabs)) {
      return [];
    }

    const parsed: TerminalTab[] = [];
    for (const candidateTab of stored.tabs.slice(0, 100) as unknown[]) {
      if (typeof candidateTab !== "object" || candidateTab === null) {
        return [];
      }
      const tab = candidateTab as Record<string, unknown>;
      if (
        typeof tab.sessionId !== "string" ||
        tab.sessionId.length === 0 ||
        typeof tab.pinned !== "boolean"
      ) {
        return [];
      }
      parsed.push({ sessionId: tab.sessionId, pinned: tab.pinned });
    }
    return normalizeTerminalTabs(parsed);
  } catch {
    return [];
  }
}

export function serializeTerminalTabs(tabs: TerminalTab[]): string {
  const stored: StoredTerminalTabs = {
    version: 1,
    tabs: normalizeTerminalTabs(tabs),
  };
  return JSON.stringify(stored);
}

function normalizeTerminalTabs(tabs: TerminalTab[]): TerminalTab[] {
  const seen = new Set<string>();
  const unique = tabs.filter((tab) => {
    if (seen.has(tab.sessionId)) {
      return false;
    }
    seen.add(tab.sessionId);
    return true;
  });
  return [
    ...unique.filter((tab) => tab.pinned),
    ...unique.filter((tab) => !tab.pinned),
  ];
}
