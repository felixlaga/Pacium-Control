import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  MAX_PALETTE_SESSION_ENTRIES,
  buildPaletteCatalog,
} from "./command-palette-model.js";

const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Meta",
  cwd: "/work/pacium",
  shell: "/bin/zsh",
  launchPreset: "codex",
  commandLabel: "Codex",
  repositoryRoot: "/work/pacium",
  repositoryName: "pacium",
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 100,
  rows: 30,
  createdAt: "2026-07-27T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

describe("command palette catalog", () => {
  it("places selected-session commands before workspace and session commands", () => {
    const commands = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 2,
      selectedSessionId: session.id,
      sessions: [session],
    });

    expect(commands.slice(0, 3).map(({ action }) => action.type)).toEqual([
      "rename-session",
      "duplicate-session",
      "relaunch-session",
    ]);
    expect(commands.find(({ id }) => id === "workspace.new-terminal")).toEqual(
      expect.objectContaining({
        enabled: true,
        group: "Workspace",
        shortcut: "⌘⇧T",
      }),
    );
    expect(
      commands.find(({ id }) => id === `session.select.${session.id}`),
    ).toEqual(
      expect.objectContaining({
        detail: "Codex · pacium · live",
        enabled: true,
      }),
    );
  });

  it("explains unavailable context commands without making them executable", () => {
    const commands = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 4,
      selectedSessionId: session.id,
      sessions: [session],
    });

    expect(commands.find(({ id }) => id === "workspace.split-right")).toEqual(
      expect.objectContaining({
        enabled: false,
        disabledReason: "Four-pane workspace limit reached",
      }),
    );
    expect(
      commands.find(({ id }) => id === `session.relaunch.${session.id}`),
    ).toEqual(
      expect.objectContaining({
        enabled: false,
        disabledReason: "Relaunch is available only after the process ends",
      }),
    );
  });

  it("changes relaunch and maximize commands from current state", () => {
    const ended = {
      ...session,
      processState: "exited" as const,
      pid: null,
      exitedAt: "2026-07-27T10:30:00.000Z",
    };
    const commands = buildPaletteCatalog({
      focusedPaneId: "pane-2",
      maximizedPaneId: "pane-2",
      paneCount: 2,
      selectedSessionId: ended.id,
      sessions: [ended],
    });

    expect(
      commands.find(({ id }) => id === `session.relaunch.${ended.id}`),
    ).toEqual(expect.objectContaining({ enabled: true }));
    expect(
      commands.find(({ id }) => id === "workspace.toggle-maximize"),
    ).toEqual(expect.objectContaining({ label: "Restore split layout" }));
  });

  it("bounds session-derived commands", () => {
    const sessions = Array.from(
      { length: MAX_PALETTE_SESSION_ENTRIES + 20 },
      (_, index) => ({
        ...session,
        id: crypto.randomUUID(),
        displayName: `Worker ${index}`,
      }),
    );
    const commands = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 1,
      selectedSessionId: null,
      sessions,
    });

    expect(
      commands.filter(({ action }) => action.type === "select-session"),
    ).toHaveLength(MAX_PALETTE_SESSION_ENTRIES);
  });
});
