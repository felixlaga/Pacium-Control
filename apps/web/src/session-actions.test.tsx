import { renderToStaticMarkup } from "react-dom/server";
import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  RelaunchSessionDialog,
  RenameSessionDialog,
  SessionActionsMenu,
} from "./session-actions.js";

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
  relaunchManifest: {
    schemaVersion: 1,
    id: "d1825955-65c5-4344-9830-d9f158b05c16",
    sessionId: "53cfec56-181c-4e9c-b187-8f323780c175",
    predecessorSessionId: null,
    displayName: "Meta",
    launchPreset: "codex",
    provider: "codex",
    command: { executable: "/opt/bin/codex", args: [] },
    cwd: "/work/pacium",
    repository: { root: "/work/pacium", name: "pacium" },
    environmentKeys: ["HOME", "PATH"],
    runtime: "pty",
    resumeReference: {
      provider: "codex",
      id: "thread-1",
      observedAt: "2026-07-27T10:01:00.000Z",
    },
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:01:00.000Z",
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

const callbacks = {
  onClose() {},
  onCloseView() {},
  onCopyDirectory() {},
  onDuplicate() {},
  onInterrupt() {},
  onRelaunch() {},
  onRename() {},
  onRevealRepository() {},
  onTerminate() {},
};

describe("session action surfaces", () => {
  it("labels live process consequences and disables relaunch", () => {
    const markup = renderToStaticMarkup(
      <SessionActionsMenu {...callbacks} session={session} />,
    );

    expect(markup).toContain("Send SIGINT · process may continue");
    expect(markup).toContain("Terminate process and close");
    expect(markup).toContain("Opens on the Pacium host");
    expect(markup).toContain("Relaunch ended session");
    expect(markup).toMatch(/disabled=""[\s\S]*?Relaunch ended session/);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="session-actions-title"');
  });

  it("offers relaunch for an ended session and explains missing Git context", () => {
    const markup = renderToStaticMarkup(
      <SessionActionsMenu
        {...callbacks}
        session={{
          ...session,
          processState: "exited",
          pid: null,
          repository: {
            status: "not_repository",
            root: null,
            name: null,
            branch: null,
            headCommit: null,
            headState: "unknown",
            worktreeKind: "unknown",
            observedAt: "2026-07-27T10:00:00.000Z",
            error: null,
          },
        }}
      />,
    );

    expect(markup).toContain("New PTY from retained launch context");
    expect(markup).toContain("No Git repository detected");
    expect(markup).toContain("Remove this ended session record");
  });

  it("renders a bounded rename dialog with the current label", () => {
    const markup = renderToStaticMarkup(
      <RenameSessionDialog
        onCancel={() => {}}
        onRename={() => {}}
        session={session}
      />,
    );
    expect(markup).toContain('maxLength="120"');
    expect(markup).toContain('value="Meta"');
    expect(markup).toContain("does not rename the shell process");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="rename-session-title"');
  });

  it("previews only retained launch facts and fresh-process consequences", () => {
    const markup = renderToStaticMarkup(
      <RelaunchSessionDialog
        connected
        manifest={session.relaunchManifest!}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(markup).toContain("fresh PTY with a new immutable session ID");
    expect(markup).toContain("/opt/bin/codex");
    expect(markup).toContain("/work/pacium");
    expect(markup).toContain("HOME, PATH · key names only");
    expect(markup).toContain("not resumed automatically");
    expect(markup).not.toContain("thread-1");
    expect(markup).toContain("Start fresh process");
  });
});
