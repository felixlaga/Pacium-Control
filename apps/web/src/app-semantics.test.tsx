import type { LaunchPresetCapability } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CreateTerminalDialog, WorkspaceStatus } from "./app.js";

const launchPresets: LaunchPresetCapability[] = [
  {
    available: true,
    id: "shell",
    label: "Shell",
    unavailableReason: null,
  },
];

describe("application shell semantics", () => {
  it("names the terminal launcher and exposes modal state", () => {
    const markup = renderToStaticMarkup(
      <CreateTerminalDialog
        defaultCwd="/work/pacium"
        defaultLaunchPreset="shell"
        launchPresets={launchPresets}
        loadDirectories={() => Promise.reject(new Error("not used"))}
        onCancel={() => {}}
        onCreate={() => {}}
        tmuxCapability={{
          state: "unconfigured",
          serverId: null,
          executable: null,
          version: null,
          detail: "Not configured.",
        }}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="create-terminal-title"');
    expect(markup).toContain('aria-label="Cancel"');
  });

  it("offers keep-alive only when tmux capability is ready", () => {
    const ready = renderToStaticMarkup(
      <CreateTerminalDialog
        defaultCwd="/work/pacium"
        defaultLaunchPreset="shell"
        launchPresets={launchPresets}
        loadDirectories={() => Promise.reject(new Error("not used"))}
        onCancel={() => {}}
        onCreate={() => {}}
        tmuxCapability={{
          state: "ready",
          serverId: "configured",
          executable: "/opt/homebrew/bin/tmux",
          version: "tmux 3.7b",
          detail: "Ready.",
        }}
      />,
    );
    expect(ready).toContain("Keep alive with tmux");
    expect(ready).toContain('<input type="checkbox"/>');
  });

  it("announces connection, selection, and terminal keyboard ownership", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceStatus
        connection="connected"
        selectedSessionName="Meta"
        terminalCaptured
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Connected · Meta · Terminal capture");
    expect(markup).toContain("Ctrl+Shift+. returns to application controls");
    expect(markup).not.toContain("/work/pacium");
  });
});
