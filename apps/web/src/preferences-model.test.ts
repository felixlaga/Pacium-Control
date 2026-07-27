import type { LaunchPresetCapability } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_PREFERENCES,
  MAX_PREFERENCES_JSON_CHARS,
  TERMINAL_FONT_STACKS,
  parseStoredPreferences,
  resolveDefaultLaunchPreset,
  resolveEffectiveTheme,
  serializePreferences,
} from "./preferences-model.js";

describe("workspace preferences", () => {
  it("uses defaults for missing, malformed, oversized, and unknown records", () => {
    expect(parseStoredPreferences(null)).toBe(DEFAULT_WORKSPACE_PREFERENCES);
    expect(parseStoredPreferences("{")).toBe(DEFAULT_WORKSPACE_PREFERENCES);
    expect(
      parseStoredPreferences("x".repeat(MAX_PREFERENCES_JSON_CHARS + 1)),
    ).toBe(DEFAULT_WORKSPACE_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({ ...DEFAULT_WORKSPACE_PREFERENCES, version: 2 }),
      ),
    ).toBe(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it("rejects extra keys and out-of-range or wrong-shaped fields", () => {
    expect(
      parseStoredPreferences(
        JSON.stringify({
          ...DEFAULT_WORKSPACE_PREFERENCES,
          terminalFontSize: 99,
        }),
      ),
    ).toBe(DEFAULT_WORKSPACE_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          ...DEFAULT_WORKSPACE_PREFERENCES,
          arbitraryCss: "body { display: none }",
        }),
      ),
    ).toBe(DEFAULT_WORKSPACE_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          ...DEFAULT_WORKSPACE_PREFERENCES,
          terminalScrollback: 2_000.5,
        }),
      ),
    ).toBe(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it("round-trips a normalized record in deterministic key order", () => {
    const preferences = {
      ...DEFAULT_WORKSPACE_PREFERENCES,
      theme: "system" as const,
      density: "comfortable" as const,
      terminalFont: "jetbrains" as const,
      terminalFontSize: 15,
      terminalLineHeight: 1.5,
      terminalScrollback: 5_000,
      defaultLaunchPreset: "codex" as const,
      notifications: "attention" as const,
    };
    const serialized = serializePreferences(preferences);

    expect(parseStoredPreferences(serialized)).toEqual(preferences);
    expect(Object.keys(JSON.parse(serialized) as object)).toEqual([
      "version",
      "theme",
      "density",
      "terminalFont",
      "terminalFontSize",
      "terminalLineHeight",
      "terminalScrollback",
      "defaultLaunchPreset",
      "notifications",
    ]);
  });

  it("resolves system theme without changing the stored preference", () => {
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("system", false)).toBe("light");
    expect(resolveEffectiveTheme("light", true)).toBe("light");
  });

  it("falls back from an unavailable default preset honestly", () => {
    const capabilities: LaunchPresetCapability[] = [
      {
        id: "shell",
        label: "Shell",
        available: true,
        unavailableReason: null,
      },
      {
        id: "codex",
        label: "Codex",
        available: false,
        unavailableReason: "Not installed",
      },
      {
        id: "claude",
        label: "Claude Code",
        available: true,
        unavailableReason: null,
      },
    ];

    expect(resolveDefaultLaunchPreset("codex", capabilities)).toBe("shell");
    expect(resolveDefaultLaunchPreset("claude", capabilities)).toBe("claude");
  });

  it("maps controlled terminal font identifiers to fixed CSS stacks", () => {
    expect(TERMINAL_FONT_STACKS["system-mono"]).toContain("SFMono-Regular");
    expect(TERMINAL_FONT_STACKS.jetbrains).toContain("JetBrains Mono");
  });
});
