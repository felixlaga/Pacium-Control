import type { SessionSummary } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildPaletteCatalog } from "./command-palette-model.js";
import { CommandPalette } from "./command-palette.js";

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

const commands = buildPaletteCatalog({
  focusedPaneId: "pane-1",
  maximizedPaneId: null,
  paneCount: 2,
  selectedSessionId: session.id,
  sessions: [session],
});

const callbacks = {
  onClose: vi.fn(),
  onExecute: vi.fn(),
  onViewChange: vi.fn(),
};

describe("command palette markup", () => {
  it("renders contextual commands with an active result and consequences", () => {
    const markup = renderToStaticMarkup(
      <CommandPalette {...callbacks} commands={commands} view="commands" />,
    );

    expect(markup).toContain("Command palette");
    expect(markup).toContain("Rename “Meta”");
    expect(markup).toContain("Change Pacium’s label only");
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain("Relaunch is available only");
    expect(markup).toContain("Review terminating “Meta”");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="command-palette-title"');
  });

  it("renders a helpful empty search state", () => {
    const markup = renderToStaticMarkup(
      <CommandPalette
        {...callbacks}
        commands={commands}
        initialQuery="definitely absent"
        view="commands"
      />,
    );

    expect(markup).toContain("No commands match");
    expect(markup).toContain("session name, repository, action");
  });

  it("renders the searchable shortcut-reference state", () => {
    const markup = renderToStaticMarkup(
      <CommandPalette
        {...callbacks}
        commands={commands}
        initialQuery="split"
        view="shortcuts"
      />,
    );

    expect(markup).toContain("Keyboard shortcuts");
    expect(markup).toContain("Split focused pane right");
    expect(markup).toContain("Split focused pane down");
    expect(markup).not.toContain("New terminal");
  });
});
