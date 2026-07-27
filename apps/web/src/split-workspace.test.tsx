import { renderToStaticMarkup } from "react-dom/server";
import type { SessionSummary } from "@pacium/contracts";
import { DEFAULT_TERMINAL_DISPLAY_PREFERENCES } from "@pacium/terminal-ui";
import { describe, expect, it } from "vitest";

import {
  assignSessionToPane,
  createSplitLayout,
  showSessionInFocusedPane,
  splitFocusedPane,
  toggleMaximizedPane,
} from "./split-layout-model.js";
import { SplitWorkspace } from "./split-workspace.js";

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
  cols: 80,
  rows: 24,
  createdAt: "2026-07-27T10:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  exitSignal: null,
};

const callbacks = {
  onAssignSession() {},
  onCaptureChange() {},
  onClosePane() {},
  onFocusPane() {},
  onInput() {},
  onOpenActions() {},
  onResize() {},
  onSetRatio() {},
  onSplit() {},
  onToggleMaximize() {},
};

describe("split workspace rendering", () => {
  it("renders a focused live pane and an instructional empty pane", () => {
    const first = showSessionInFocusedPane(
      createSplitLayout("pane-meta"),
      session.id,
    );
    const layout = splitFocusedPane(
      first,
      "horizontal",
      "split-main",
      "pane-worker",
    );
    const markup = renderToStaticMarkup(
      <SplitWorkspace
        {...callbacks}
        capturedPaneId={null}
        layout={layout}
        sessions={[session]}
        terminalPreferences={DEFAULT_TERMINAL_DISPLAY_PREFERENCES}
        terminalRefs={{ current: new Map() }}
      />,
    );

    expect(markup).toContain("Meta terminal pane");
    expect(markup).toContain("Choose a running terminal");
    expect(markup).toContain("Move a session here without stopping");
    expect(markup).toContain('role="separator"');
    expect(markup).toContain('aria-label="Split Meta right"');
    expect(markup.match(/Meta terminal/g)).toHaveLength(2);
  });

  it("renders only the maximized pane while preserving layout state", () => {
    const first = showSessionInFocusedPane(
      createSplitLayout("pane-meta"),
      session.id,
    );
    const split = splitFocusedPane(
      first,
      "vertical",
      "split-main",
      "pane-worker",
    );
    const secondSession = {
      ...session,
      id: "1e6da255-7c44-4199-b284-ee903712890a",
      displayName: "Orchestrator",
    };
    const filled = assignSessionToPane(split, "pane-worker", secondSession.id);
    const layout = toggleMaximizedPane(filled, "pane-worker");
    const markup = renderToStaticMarkup(
      <SplitWorkspace
        {...callbacks}
        capturedPaneId={null}
        layout={layout}
        sessions={[session, secondSession]}
        terminalPreferences={DEFAULT_TERMINAL_DISPLAY_PREFERENCES}
        terminalRefs={{ current: new Map() }}
      />,
    );

    expect(markup).toContain("Orchestrator terminal pane");
    expect(markup).not.toContain("Meta terminal pane");
    expect(markup).not.toContain('role="separator"');
    expect(layout.root.kind).toBe("split");
  });
});
