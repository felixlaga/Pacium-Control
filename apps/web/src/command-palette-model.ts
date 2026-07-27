import type { SessionSummary } from "@pacium/contracts";

import { sessionActionAvailability } from "./session-actions-model.js";

export const MAX_PALETTE_SESSION_ENTRIES = 100;
export const MAX_PALETTE_RESULTS = 40;
export const MAX_PALETTE_QUERY_CHARS = 160;

export type PaletteCommandAction =
  | { type: "new-terminal" }
  | { type: "split-pane"; direction: "horizontal" | "vertical" }
  | { type: "focus-pane"; direction: -1 | 1 }
  | { type: "toggle-maximize"; paneId: string }
  | { type: "show-shortcuts" }
  | { type: "select-session"; sessionId: string }
  | { type: "rename-session"; sessionId: string }
  | { type: "duplicate-session"; sessionId: string }
  | { type: "relaunch-session"; sessionId: string }
  | { type: "copy-session-directory"; sessionId: string }
  | { type: "reveal-session-repository"; sessionId: string }
  | { type: "close-session-view"; sessionId: string }
  | { type: "interrupt-session"; sessionId: string }
  | { type: "review-session-termination"; sessionId: string };

export type PaletteCommandGroup = "Suggested" | "Workspace" | "Sessions";

export interface PaletteCommand {
  id: string;
  action: PaletteCommandAction;
  detail: string;
  disabledReason: string | null;
  enabled: boolean;
  group: PaletteCommandGroup;
  keywords: string[];
  label: string;
  rank: number;
  shortcut?: string;
}

export interface PaletteCatalogInput {
  focusedPaneId: string | null;
  maximizedPaneId: string | null;
  paneCount: number;
  selectedSessionId: string | null;
  sessions: SessionSummary[];
}

export function buildPaletteCatalog(
  input: PaletteCatalogInput,
): PaletteCommand[] {
  const commands: PaletteCommand[] = [];
  const selected =
    input.sessions.find(({ id }) => id === input.selectedSessionId) ?? null;

  if (selected !== null) {
    commands.push(...selectedSessionCommands(selected));
  }

  commands.push(
    command({
      id: "workspace.new-terminal",
      action: { type: "new-terminal" },
      label: "New terminal",
      detail: "Choose a host folder and launch preset",
      group: "Workspace",
      rank: 20,
      shortcut: "⌘⇧T",
      keywords: ["create", "launch", "shell", "codex", "claude"],
    }),
    command({
      id: "workspace.split-right",
      action: { type: "split-pane", direction: "horizontal" },
      label: "Split focused pane right",
      detail:
        input.paneCount >= 4
          ? "Four-pane workspace limit reached"
          : "Create an empty pane beside the focused pane",
      group: "Workspace",
      rank: 21,
      shortcut: "⌘\\",
      keywords: ["horizontal", "right", "pane"],
      enabled: input.paneCount < 4,
      disabledReason:
        input.paneCount >= 4 ? "Four-pane workspace limit reached" : null,
    }),
    command({
      id: "workspace.split-down",
      action: { type: "split-pane", direction: "vertical" },
      label: "Split focused pane down",
      detail:
        input.paneCount >= 4
          ? "Four-pane workspace limit reached"
          : "Create an empty pane below the focused pane",
      group: "Workspace",
      rank: 22,
      shortcut: "⌘⇧\\",
      keywords: ["vertical", "down", "pane"],
      enabled: input.paneCount < 4,
      disabledReason:
        input.paneCount >= 4 ? "Four-pane workspace limit reached" : null,
    }),
    command({
      id: "workspace.focus-previous-pane",
      action: { type: "focus-pane", direction: -1 },
      label: "Focus previous pane",
      detail:
        input.paneCount > 1
          ? "Move application focus without entering terminal capture"
          : "Open another split to navigate between panes",
      group: "Workspace",
      rank: 23,
      shortcut: "⌥[",
      keywords: ["left", "previous", "pane", "focus"],
      enabled: input.paneCount > 1,
      disabledReason:
        input.paneCount > 1 ? null : "Only one pane is currently open",
    }),
    command({
      id: "workspace.focus-next-pane",
      action: { type: "focus-pane", direction: 1 },
      label: "Focus next pane",
      detail:
        input.paneCount > 1
          ? "Move application focus without entering terminal capture"
          : "Open another split to navigate between panes",
      group: "Workspace",
      rank: 24,
      shortcut: "⌥]",
      keywords: ["right", "next", "pane", "focus"],
      enabled: input.paneCount > 1,
      disabledReason:
        input.paneCount > 1 ? null : "Only one pane is currently open",
    }),
  );

  if (input.focusedPaneId !== null) {
    const restoring = input.maximizedPaneId === input.focusedPaneId;
    commands.push(
      command({
        id: "workspace.toggle-maximize",
        action: {
          type: "toggle-maximize",
          paneId: input.focusedPaneId,
        },
        label: restoring ? "Restore split layout" : "Maximize focused pane",
        detail:
          input.paneCount > 1
            ? restoring
              ? "Show every pane again"
              : "Hide other panes without closing their views"
            : "Open another split before maximizing a pane",
        group: "Workspace",
        rank: 25,
        keywords: ["zoom", "restore", "layout", "pane"],
        enabled: input.paneCount > 1,
        disabledReason:
          input.paneCount > 1 ? null : "Only one pane is currently open",
      }),
    );
  }

  commands.push(
    command({
      id: "workspace.show-shortcuts",
      action: { type: "show-shortcuts" },
      label: "Show keyboard shortcuts",
      detail: "Open the searchable shortcut reference",
      group: "Workspace",
      rank: 26,
      shortcut: "?",
      keywords: ["help", "keys", "reference"],
    }),
  );

  input.sessions
    .slice(0, MAX_PALETTE_SESSION_ENTRIES)
    .forEach((session, index) => {
      commands.push(
        command({
          id: `session.select.${session.id}`,
          action: { type: "select-session", sessionId: session.id },
          label: `Switch to ${session.displayName}`,
          detail: sessionDetail(session),
          group: "Sessions",
          rank: session.id === input.selectedSessionId ? 40 : 50 + index,
          keywords: [
            session.displayName,
            session.commandLabel,
            session.launchPreset,
            session.cwd,
            session.repositoryName ?? "",
            session.processState,
          ],
        }),
      );
    });

  return commands;
}

export function searchPaletteCommands(
  commands: PaletteCommand[],
  rawQuery: string,
): PaletteCommand[] {
  const query = normalizeSearchText(rawQuery.slice(0, MAX_PALETTE_QUERY_CHARS));
  if (query.length === 0) {
    return [...commands]
      .sort(compareRankThenLabel)
      .slice(0, MAX_PALETTE_RESULTS);
  }

  const tokens = query.split(" ").filter(Boolean).slice(0, 12);
  return commands
    .flatMap((candidate) => {
      const label = normalizeSearchText(candidate.label);
      const detail = normalizeSearchText(candidate.detail);
      const keywords = normalizeSearchText(candidate.keywords.join(" "));
      if (
        !tokens.every(
          (token) =>
            label.includes(token) ||
            detail.includes(token) ||
            keywords.includes(token),
        )
      ) {
        return [];
      }
      return [
        {
          candidate,
          score:
            contextScore(candidate.rank) +
            tokens.reduce(
              (total, token) =>
                total + tokenScore(token, label, detail, keywords),
              0,
            ),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        compareRankThenLabel(left.candidate, right.candidate),
    )
    .slice(0, MAX_PALETTE_RESULTS)
    .map(({ candidate }) => candidate);
}

export function movePaletteSelection(
  commands: PaletteCommand[],
  currentId: string | null,
  direction: -1 | 1,
): string | null {
  const enabled = commands.filter(({ enabled }) => enabled);
  if (enabled.length === 0) {
    return null;
  }
  const currentIndex = enabled.findIndex(({ id }) => id === currentId);
  if (currentIndex === -1) {
    return direction === 1
      ? (enabled[0]?.id ?? null)
      : (enabled.at(-1)?.id ?? null);
  }
  const nextIndex =
    (currentIndex + direction + enabled.length) % enabled.length;
  return enabled[nextIndex]?.id ?? null;
}

function selectedSessionCommands(session: SessionSummary): PaletteCommand[] {
  const availability = sessionActionAvailability(session);
  const target = `“${session.displayName}”`;
  const ended =
    session.processState === "exited" || session.processState === "failed";
  return [
    command({
      id: `session.rename.${session.id}`,
      action: { type: "rename-session", sessionId: session.id },
      label: `Rename ${target}`,
      detail: "Change Pacium’s label only",
      group: "Suggested",
      rank: 0,
      keywords: ["edit", "name", session.displayName],
      enabled: availability.canRename,
      disabledReason: availability.canRename
        ? null
        : "Session is currently closing",
    }),
    command({
      id: `session.duplicate.${session.id}`,
      action: { type: "duplicate-session", sessionId: session.id },
      label: `Duplicate ${target}`,
      detail: "Start a new PTY with the same preset and folder",
      group: "Suggested",
      rank: 1,
      keywords: ["copy", "clone", session.commandLabel, session.cwd],
      enabled: availability.canDuplicate,
      disabledReason: availability.canDuplicate
        ? null
        : "Session is still being created",
    }),
    command({
      id: `session.relaunch.${session.id}`,
      action: { type: "relaunch-session", sessionId: session.id },
      label: `Relaunch ${target}`,
      detail: ended
        ? "Start a successor from retained launch context"
        : "Available after this process ends",
      group: "Suggested",
      rank: 2,
      keywords: ["restart", "successor", session.commandLabel],
      enabled: availability.canRelaunch,
      disabledReason: availability.canRelaunch
        ? null
        : "Relaunch is available only after the process ends",
    }),
    command({
      id: `session.copy-directory.${session.id}`,
      action: { type: "copy-session-directory", sessionId: session.id },
      label: `Copy directory for ${target}`,
      detail: session.cwd,
      group: "Suggested",
      rank: 3,
      keywords: ["cwd", "path", "clipboard"],
    }),
    command({
      id: `session.reveal-repository.${session.id}`,
      action: { type: "reveal-session-repository", sessionId: session.id },
      label: `Reveal repository for ${target}`,
      detail: availability.canRevealRepository
        ? "Open the canonical repository on the Pacium host"
        : "No Git repository was detected",
      group: "Suggested",
      rank: 4,
      keywords: ["finder", "folder", "git", session.repositoryName ?? ""],
      enabled: availability.canRevealRepository,
      disabledReason: availability.canRevealRepository
        ? null
        : "No Git repository was detected",
    }),
    command({
      id: `session.close-view.${session.id}`,
      action: { type: "close-session-view", sessionId: session.id },
      label: `Close browser view for ${target}`,
      detail: "The PTY keeps running and remains in the sidebar",
      group: "Suggested",
      rank: 5,
      keywords: ["tab", "view", "hide"],
    }),
    command({
      id: `session.interrupt.${session.id}`,
      action: { type: "interrupt-session", sessionId: session.id },
      label: `Interrupt ${target}`,
      detail: "Send SIGINT; the process may continue",
      group: "Suggested",
      rank: 6,
      keywords: ["signal", "stop", "ctrl c"],
      enabled: availability.canInterrupt,
      disabledReason: availability.canInterrupt
        ? null
        : "Only a live process can receive SIGINT",
    }),
    command({
      id: `session.review-termination.${session.id}`,
      action: { type: "review-session-termination", sessionId: session.id },
      label: ended
        ? `Review removing ${target}`
        : `Review terminating ${target}`,
      detail: ended
        ? "Open consequence review before removing the ended record"
        : "Open consequence review before sending SIGTERM",
      group: "Suggested",
      rank: 7,
      keywords: ["close", "kill", "terminate", "remove"],
      enabled: availability.canTerminate,
      disabledReason: availability.canTerminate
        ? null
        : "Session cannot be terminated in its current state",
    }),
  ];
}

function command(
  input: Omit<PaletteCommand, "enabled" | "disabledReason"> &
    Partial<Pick<PaletteCommand, "enabled" | "disabledReason">>,
): PaletteCommand {
  return {
    ...input,
    enabled: input.enabled ?? true,
    disabledReason: input.disabledReason ?? null,
  };
}

function sessionDetail(session: SessionSummary): string {
  const repository = session.repositoryName ?? session.cwd;
  return `${session.commandLabel} · ${repository} · ${session.processState}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function contextScore(rank: number): number {
  if (rank < 20) {
    return 0;
  }
  if (rank < 40) {
    return 20;
  }
  return 40;
}

function tokenScore(
  token: string,
  label: string,
  detail: string,
  keywords: string,
): number {
  if (label === token) {
    return 0;
  }
  if (label.startsWith(token)) {
    return 1;
  }
  if (label.split(" ").some((word) => word.startsWith(token))) {
    return 2;
  }
  if (label.includes(token)) {
    return 3;
  }
  if (detail.includes(token)) {
    return 4;
  }
  if (keywords.includes(token)) {
    return 5;
  }
  return 100;
}

function compareRankThenLabel(
  left: PaletteCommand,
  right: PaletteCommand,
): number {
  return (
    left.rank - right.rank ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
}
