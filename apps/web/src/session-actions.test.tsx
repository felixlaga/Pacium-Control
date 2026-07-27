import { renderToStaticMarkup } from "react-dom/server";
import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { RenameSessionDialog, SessionActionsMenu } from "./session-actions.js";

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
  });

  it("offers relaunch for an ended session and explains missing Git context", () => {
    const markup = renderToStaticMarkup(
      <SessionActionsMenu
        {...callbacks}
        session={{
          ...session,
          processState: "exited",
          pid: null,
          repositoryRoot: null,
          repositoryName: null,
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
  });
});
