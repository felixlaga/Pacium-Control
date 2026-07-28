import type { LaunchPresetCapability } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_WORKSPACE_PREFERENCES,
  type WorkspacePreferences,
} from "./preferences-model.js";
import { PreferencesDialog } from "./preferences.js";

const launchPresets: LaunchPresetCapability[] = [
  {
    id: "shell",
    label: "Shell",
    available: true,
    unavailableReason: null,
  },
  {
    id: "codex",
    label: "Codex",
    available: true,
    unavailableReason: null,
  },
  {
    id: "claude",
    label: "Claude Code",
    available: false,
    unavailableReason: "Not installed",
  },
];

const callbacks = {
  applyHostSetup: vi.fn(),
  hostSetupLocal: false,
  loadHostSetup: vi.fn(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
  onRequestNotificationPermission: vi.fn(),
};

describe("preferences dialog markup", () => {
  it("renders current defaults and bounded terminal controls", () => {
    const markup = renderToStaticMarkup(
      <PreferencesDialog
        {...callbacks}
        launchPresets={launchPresets}
        notificationPermission="default"
        preferences={DEFAULT_WORKSPACE_PREFERENCES}
      />,
    );

    expect(markup).toContain("Workspace settings");
    expect(markup).toContain('value="dark" selected=""');
    expect(markup).toContain('min="11"');
    expect(markup).toContain('max="18"');
    expect(markup).toContain('value="2000"');
    expect(markup).toContain("View preferences stay in this browser");
    expect(markup).toContain("Open Pacium on localhost");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="preferences-title"');
    expect(markup).toContain("Not requested");
    expect(markup).toContain("Allow browser alerts");
  });

  it("renders custom selections and unavailable host presets honestly", () => {
    const preferences: WorkspacePreferences = {
      ...DEFAULT_WORKSPACE_PREFERENCES,
      theme: "light",
      density: "comfortable",
      terminalFont: "jetbrains",
      terminalFontSize: 16,
      terminalLineHeight: 1.5,
      terminalScrollback: 5_000,
      defaultLaunchPreset: "codex",
      notifications: "attention",
    };
    const markup = renderToStaticMarkup(
      <PreferencesDialog
        {...callbacks}
        launchPresets={launchPresets}
        notificationPermission="granted"
        preferences={preferences}
      />,
    );

    expect(markup).toContain('value="light" selected=""');
    expect(markup).toContain('value="comfortable" selected=""');
    expect(markup).toContain('value="jetbrains" selected=""');
    expect(markup).toContain('value="codex" selected=""');
    expect(markup).toContain('disabled="" value="claude"');
    expect(markup).toContain("Never normal progress");
    expect(markup).toContain("Allowed");
    expect(markup).not.toContain("Allow browser alerts");
  });
});
