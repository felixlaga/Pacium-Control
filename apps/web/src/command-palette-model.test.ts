import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  MAX_PALETTE_QUERY_CHARS,
  MAX_PALETTE_RESULTS,
  MAX_PALETTE_SESSION_ENTRIES,
  SHORTCUT_REFERENCE,
  buildPaletteCatalog,
  movePaletteSelection,
  searchPaletteCommands,
  searchShortcutReference,
} from "./command-palette-model.js";

const session: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Meta",
  cwd: "/work/pacium",
  shell: "/bin/zsh",
  launchPreset: "codex",
  commandLabel: "Codex",
  agentClassification: {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-07-27T10:00:00.000Z",
  },
  providerObservation: null,
  repository: {
    status: "ready",
    root: "/work/pacium",
    name: "pacium",
    branch: "dev",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt: "2026-07-27T10:00:00.000Z",
    error: null,
  },
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
    expect(commands.find(({ id }) => id === "workspace.open-settings")).toEqual(
      expect.objectContaining({
        action: { type: "open-settings" },
        shortcut: "⌘,",
      }),
    );
    expect(
      commands.find(({ id }) => id === "workspace.open-diagnostics"),
    ).toEqual(
      expect.objectContaining({
        action: { type: "open-diagnostics" },
        enabled: true,
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

  it("offers one current-mode-aware presentation command", () => {
    const general = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 1,
      selectedSessionId: null,
      sessions: [],
      workspaceMode: "general",
    });
    expect(
      general.find(({ id }) => id === "workspace.toggle-mode"),
    ).toMatchObject({
      action: { type: "toggle-workspace-mode" },
      label: "Switch to Pacium mode",
      shortcut: "G P",
    });

    const pacium = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 1,
      selectedSessionId: null,
      sessions: [],
      workspaceMode: "pacium",
    });
    expect(
      pacium.find(({ id }) => id === "workspace.toggle-mode"),
    ).toMatchObject({
      label: "Switch to General mode",
    });
    expect(
      searchPaletteCommands(pacium, "general mode").map(({ id }) => id),
    ).toContain("workspace.toggle-mode");
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

  it("searches case-insensitive tokens across target context", () => {
    const second = {
      ...session,
      id: "e4a7e71b-e74a-4aef-850f-b5092f89912d",
      displayName: "Checkout Worker",
      cwd: "/work/checkout-api",
      repository: {
        ...session.repository,
        name: "checkout-api",
      },
    };
    const catalog = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 2,
      selectedSessionId: session.id,
      sessions: [session, second],
    });

    expect(
      searchPaletteCommands(catalog, "CHECKOUT codex").map(
        ({ action }) => action,
      ),
    ).toEqual([{ type: "select-session", sessionId: second.id }]);
    expect(searchPaletteCommands(catalog, "rélaunch")[0]?.action).toEqual({
      type: "relaunch-session",
      sessionId: session.id,
    });
  });

  it("ranks selected context before general commands and keeps stable ties", () => {
    const catalog = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 2,
      selectedSessionId: session.id,
      sessions: [session],
    });
    const sessionResults = searchPaletteCommands(catalog, "meta");

    expect(sessionResults[0]?.group).toBe("Suggested");
    expect(searchPaletteCommands(catalog, "")[0]?.id).toBe(
      `session.rename.${session.id}`,
    );
  });

  it("bounds long queries and result sets", () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      ...session,
      id: crypto.randomUUID(),
      displayName: `Worker ${index}`,
    }));
    const catalog = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 1,
      selectedSessionId: null,
      sessions: many,
    });

    expect(searchPaletteCommands(catalog, "")).toHaveLength(
      MAX_PALETTE_RESULTS,
    );
    expect(
      searchPaletteCommands(
        catalog,
        `${"x".repeat(MAX_PALETTE_QUERY_CHARS)}worker`,
      ),
    ).toEqual([]);
  });

  it("moves selection through enabled results and skips unavailable rows", () => {
    const catalog = buildPaletteCatalog({
      focusedPaneId: "pane-1",
      maximizedPaneId: null,
      paneCount: 4,
      selectedSessionId: null,
      sessions: [],
    });
    const visible = searchPaletteCommands(catalog, "");

    expect(movePaletteSelection(visible, null, 1)).toBe(
      "workspace.new-terminal",
    );
    expect(movePaletteSelection(visible, "workspace.new-terminal", -1)).toBe(
      "workspace.toggle-inspector",
    );
    expect(movePaletteSelection(visible, "workspace.new-terminal", 1)).toBe(
      "workspace.focus-previous-pane",
    );
  });

  it("provides a searchable reference only for implemented shortcuts", () => {
    expect(SHORTCUT_REFERENCE.map(({ id }) => id)).toContain("palette");
    expect(SHORTCUT_REFERENCE.map(({ id }) => id)).toContain("workspace-mode");
    expect(
      searchShortcutReference("terminal capture").map(({ id }) => id),
    ).toEqual(["shortcut-reference", "focus-pane", "leave-terminal"]);
    expect(searchShortcutReference("settings").map(({ id }) => id)).toEqual([
      "settings",
    ]);
  });
});
