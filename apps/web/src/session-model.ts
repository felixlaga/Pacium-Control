import type { SessionSummary } from "@pacium/contracts";

export interface SessionGroup {
  key: string;
  label: string;
  kind: "repository" | "folders";
  sessions: SessionSummary[];
}

export type WorkspaceShortcut =
  | { type: "new-terminal" }
  | { type: "previous-session" }
  | { type: "next-session" }
  | { type: "select-session"; index: number }
  | { type: "exit-terminal-capture" };

export function resolveWorkspaceShortcut(input: {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  editable: boolean;
  dialogOpen: boolean;
}): WorkspaceShortcut | null {
  if (input.ctrlKey && input.shiftKey && input.code === "Period") {
    return { type: "exit-terminal-capture" };
  }
  if (input.editable || input.dialogOpen) {
    return null;
  }

  const commandModifier = input.metaKey || input.ctrlKey;
  if (commandModifier && input.shiftKey && input.code === "KeyT") {
    return { type: "new-terminal" };
  }
  if (commandModifier && input.shiftKey && input.code === "BracketLeft") {
    return { type: "previous-session" };
  }
  if (commandModifier && input.shiftKey && input.code === "BracketRight") {
    return { type: "next-session" };
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
    if (session.repositoryRoot === null || session.repositoryName === null) {
      folders.push(session);
      continue;
    }
    const existing = repositories.get(session.repositoryRoot);
    if (existing === undefined) {
      repositories.set(session.repositoryRoot, {
        key: `repository:${session.repositoryRoot}`,
        label: session.repositoryName,
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
