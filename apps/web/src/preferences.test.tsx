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
  onApply: vi.fn(),
  onCancel: vi.fn(),
};

describe("preferences dialog markup", () => {
  it("renders current defaults and bounded terminal controls", () => {
    const markup = renderToStaticMarkup(
      <PreferencesDialog
        {...callbacks}
        launchPresets={launchPresets}
        preferences={DEFAULT_WORKSPACE_PREFERENCES}
      />,
    );

    expect(markup).toContain("Workspace settings");
    expect(markup).toContain('value="dark" selected=""');
    expect(markup).toContain('min="11"');
    expect(markup).toContain('max="18"');
    expect(markup).toContain('value="2000"');
    expect(markup).toContain("Stored in this browser");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="preferences-title"');
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
        preferences={preferences}
      />,
    );

    expect(markup).toContain('value="light" selected=""');
    expect(markup).toContain('value="comfortable" selected=""');
    expect(markup).toContain('value="jetbrains" selected=""');
    expect(markup).toContain('value="codex" selected=""');
    expect(markup).toContain('disabled="" value="claude"');
    expect(markup).toContain("Delivery begins when PC-032");
  });
});
