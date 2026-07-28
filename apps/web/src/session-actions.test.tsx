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

  it("labels tmux client actions without claiming the server session ends", () => {
    const markup = renderToStaticMarkup(
      <SessionActionsMenu
        {...callbacks}
        session={{ ...session, runtime: "tmux" }}
      />,
    );

    expect(markup).toContain("Use explicit reattach");
    expect(markup).toContain("Client and tmux server session keep running");
    expect(markup).toContain("Disconnect tmux client and close");
    expect(markup).toContain("tmux session may continue");
  });

  it("labels managed keep-alive consequences and restart policy", () => {
    const keepAliveManifest = {
      ...session.relaunchManifest!,
      runtime: "tmux" as const,
      tmuxMode: "keep_alive" as const,
      tmuxTarget: {
        serverId: "configured",
        sessionId: "$8",
        sessionName: "pacium-managed",
        observedAt: "2026-07-28T10:00:00.000Z",
      },
    };
    const keepAliveSession: SessionSummary = {
      ...session,
      runtime: "tmux",
      tmuxMode: "keep_alive",
      tmuxTarget: keepAliveManifest.tmuxTarget,
      relaunchManifest: keepAliveManifest,
    };
    const actions = renderToStaticMarkup(
      <SessionActionsMenu {...callbacks} session={keepAliveSession} />,
    );
    const relaunch = renderToStaticMarkup(
      <RelaunchSessionDialog
        connected
        manifest={keepAliveManifest}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(actions).toContain("managed target is not cloned");
    expect(actions).toContain("managed tmux target keep running");
    expect(actions).toContain("Disconnect keep-alive client");
    expect(actions).toContain("target remains auto-restorable");
    expect(relaunch).toContain("does not rerun its command");
    expect(relaunch).toContain("Restart policy");
    expect(relaunch).toContain("never rerun a missing command");
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

  it("previews tmux reattachment as a new client without a server restart", () => {
    const markup = renderToStaticMarkup(
      <RelaunchSessionDialog
        connected
        manifest={{
          ...session.relaunchManifest!,
          runtime: "tmux",
          provider: null,
          tmuxTarget: {
            serverId: "configured",
            sessionId: "$4",
            sessionName: "Meta",
            observedAt: "2026-07-28T10:00:00.000Z",
          },
        }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(markup).toContain("fresh tmux client");
    expect(markup).toContain("external tmux server session is not restarted");
    expect(markup).toContain("<dd>tmux</dd>");
    expect(markup).toContain("Reattach tmux client");
  });
});
