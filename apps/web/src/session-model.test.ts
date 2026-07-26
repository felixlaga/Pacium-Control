import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@pacium/contracts";

import {
  adjacentSessionId,
  groupSessions,
  resolveWorkspaceShortcut,
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
  };

  it("maps creation, navigation, numbered selection, and capture escape", () => {
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
  });
});
