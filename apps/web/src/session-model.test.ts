import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@pacium/contracts";

import {
  adjacentSessionId,
  adjacentTerminalTabId,
  closeTerminalTab,
  groupSessions,
  moveTerminalTab,
  moveTerminalTabByOffset,
  openTerminalTab,
  parseStoredTerminalTabs,
  reconcileTerminalTabs,
  resolveWorkspaceShortcut,
  serializeTerminalTabs,
  toggleTerminalTabPin,
} from "./session-model.js";

const baseSession: SessionSummary = {
  id: "53cfec56-181c-4e9c-b187-8f323780c175",
  epoch: 1,
  displayName: "Shell",
  cwd: "/work/alpha",
  shell: "/bin/zsh",
  launchPreset: "shell",
  commandLabel: "Shell",
  repositoryRoot: "/work/alpha",
  repositoryName: "alpha",
  runtime: "pty",
  processState: "live",
  pid: 42,
  cols: 80,
  rows: 24,
  createdAt: "2026-07-27T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

describe("session grouping", () => {
  it("groups repository sessions and keeps other folders separate", () => {
    const groups = groupSessions([
      baseSession,
      {
        ...baseSession,
        id: "1e6da255-7c44-4199-b284-ee903712890a",
        displayName: "Codex",
        launchPreset: "codex",
      },
      {
        ...baseSession,
        id: "d380337c-6047-4220-be3a-263f57314285",
        displayName: "Scratch",
        cwd: "/tmp/scratch",
        repositoryRoot: null,
        repositoryName: null,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      label: "alpha",
      kind: "repository",
    });
    expect(groups[0]?.sessions).toHaveLength(2);
    expect(groups[1]).toMatchObject({
      label: "Other folders",
      kind: "folders",
    });
  });

  it("wraps previous and next navigation in displayed order", () => {
    const second = {
      ...baseSession,
      id: "1e6da255-7c44-4199-b284-ee903712890a",
    };
    expect(adjacentSessionId([baseSession, second], baseSession.id, 1)).toBe(
      second.id,
    );
    expect(adjacentSessionId([baseSession, second], baseSession.id, -1)).toBe(
      second.id,
    );
  });
});

describe("workspace shortcuts", () => {
  const baseKeys = {
    code: "",
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    editable: false,
    dialogOpen: false,
    terminalCaptured: false,
  };

  it("maps creation, navigation, numbered selection, and capture escape", () => {
    expect(resolveWorkspaceShortcut({ ...baseKeys, code: "KeyK" })).toEqual({
      type: "open-command-palette",
    });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Slash",
        metaKey: false,
        shiftKey: true,
      }),
    ).toEqual({ type: "open-shortcut-reference" });
    expect(resolveWorkspaceShortcut({ ...baseKeys, code: "Comma" })).toEqual({
      type: "open-settings",
    });
    expect(resolveWorkspaceShortcut({ ...baseKeys, code: "KeyB" })).toEqual({
      type: "toggle-sidebar",
    });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "KeyB",
        shiftKey: true,
      }),
    ).toEqual({ type: "toggle-inspector" });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "KeyT",
        shiftKey: true,
      }),
    ).toEqual({ type: "new-terminal" });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "BracketRight",
        shiftKey: true,
      }),
    ).toEqual({ type: "next-session" });
    expect(resolveWorkspaceShortcut({ ...baseKeys, code: "Digit3" })).toEqual({
      type: "select-session",
      index: 2,
    });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Period",
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
      }),
    ).toEqual({ type: "exit-terminal-capture" });
    expect(
      resolveWorkspaceShortcut({ ...baseKeys, code: "Backslash" }),
    ).toEqual({ type: "split-horizontal" });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Backslash",
        shiftKey: true,
      }),
    ).toEqual({ type: "split-vertical" });
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "BracketRight",
        metaKey: false,
        altKey: true,
      }),
    ).toEqual({ type: "next-pane" });
  });

  it("does not steal normal shortcuts from editable controls", () => {
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "KeyT",
        shiftKey: true,
        editable: true,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Backslash",
        terminalCaptured: true,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "KeyK",
        terminalCaptured: true,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Slash",
        metaKey: false,
        shiftKey: true,
        dialogOpen: true,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "Comma",
        editable: true,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceShortcut({
        ...baseKeys,
        code: "KeyB",
        terminalCaptured: true,
      }),
    ).toBeNull();
  });
});

describe("terminal tabs", () => {
  const first = { sessionId: baseSession.id, pinned: false };
  const secondSession = {
    ...baseSession,
    id: "1e6da255-7c44-4199-b284-ee903712890a",
    displayName: "Codex",
  };
  const second = { sessionId: secondSession.id, pinned: false };
  const thirdSession = {
    ...baseSession,
    id: "d380337c-6047-4220-be3a-263f57314285",
    displayName: "Claude",
  };
  const third = { sessionId: thirdSession.id, pinned: false };

  it("opens each session once and navigates in tab order", () => {
    expect(openTerminalTab([first], first.sessionId)).toEqual([first]);
    const tabs = openTerminalTab([first], second.sessionId);
    expect(tabs).toEqual([first, second]);
    expect(adjacentTerminalTabId(tabs, first.sessionId, 1)).toBe(
      second.sessionId,
    );
    expect(adjacentTerminalTabId(tabs, first.sessionId, -1)).toBe(
      second.sessionId,
    );
  });

  it("selects the right neighbor, then the left neighbor, when closing", () => {
    expect(
      closeTerminalTab(
        [first, second, third],
        second.sessionId,
        second.sessionId,
      ),
    ).toEqual({
      tabs: [first, third],
      selectedId: third.sessionId,
    });
    expect(
      closeTerminalTab([first, second], second.sessionId, second.sessionId),
    ).toEqual({
      tabs: [first],
      selectedId: first.sessionId,
    });
    expect(closeTerminalTab([first], first.sessionId, first.sessionId)).toEqual(
      {
        tabs: [],
        selectedId: null,
      },
    );
  });

  it("does not change selection when an inactive tab closes", () => {
    expect(
      closeTerminalTab([first, second], second.sessionId, first.sessionId),
    ).toEqual({
      tabs: [first],
      selectedId: first.sessionId,
    });
  });

  it("keeps pinned tabs first and reorders only inside a pin partition", () => {
    const pinnedSecond = toggleTerminalTabPin(
      [first, second, third],
      second.sessionId,
    );
    expect(pinnedSecond).toEqual([{ ...second, pinned: true }, first, third]);

    expect(
      moveTerminalTab(pinnedSecond, second.sessionId, first.sessionId),
    ).toBe(pinnedSecond);
    expect(moveTerminalTabByOffset(pinnedSecond, first.sessionId, 1)).toEqual([
      { ...second, pinned: true },
      third,
      first,
    ]);
  });

  it("reconciles duplicates and stale IDs against server sessions", () => {
    expect(
      reconcileTerminalTabs(
        [first, first, { sessionId: "missing", pinned: true }, second],
        [baseSession, secondSession],
        second.sessionId,
      ),
    ).toEqual({
      tabs: [first, second],
      selectedId: second.sessionId,
    });
  });

  it("recovers selection from the first surviving tab", () => {
    expect(
      reconcileTerminalTabs(
        [first, second],
        [baseSession, secondSession],
        "missing",
      ),
    ).toEqual({
      tabs: [first, second],
      selectedId: first.sessionId,
    });
  });

  it("round trips bounded versioned local state and rejects malformed data", () => {
    const tabs = [{ ...second, pinned: true }, first];
    expect(parseStoredTerminalTabs(serializeTerminalTabs(tabs))).toEqual(tabs);
    expect(parseStoredTerminalTabs("{")).toEqual([]);
    expect(
      parseStoredTerminalTabs(
        JSON.stringify({
          version: 2,
          tabs,
        }),
      ),
    ).toEqual([]);
    expect(
      parseStoredTerminalTabs(
        JSON.stringify({
          version: 1,
          tabs: [{ sessionId: first.sessionId, pinned: "yes" }],
        }),
      ),
    ).toEqual([]);
  });
});
