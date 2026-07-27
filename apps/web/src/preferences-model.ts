import type { LaunchPresetCapability, LaunchPresetId } from "@pacium/contracts";

export const PREFERENCES_STORAGE_KEY = "pacium.preferences";
export const PREFERENCES_SCHEMA_VERSION = 1;
export const MAX_PREFERENCES_JSON_CHARS = 8_192;

export const TERMINAL_FONT_SIZE_MIN = 11;
export const TERMINAL_FONT_SIZE_MAX = 18;
export const TERMINAL_LINE_HEIGHT_MIN = 1.1;
export const TERMINAL_LINE_HEIGHT_MAX = 1.6;
export const TERMINAL_SCROLLBACK_MIN = 500;
export const TERMINAL_SCROLLBACK_MAX = 10_000;

export type ThemePreference = "system" | "dark" | "light";
export type EffectiveTheme = "dark" | "light";
export type DensityPreference = "compact" | "comfortable";
export type TerminalFontPreference = "system-mono" | "cascadia" | "jetbrains";
export type NotificationPreference = "off" | "attention";

export interface WorkspacePreferences {
  version: 1;
  theme: ThemePreference;
  density: DensityPreference;
  terminalFont: TerminalFontPreference;
  terminalFontSize: number;
  terminalLineHeight: number;
  terminalScrollback: number;
  defaultLaunchPreset: LaunchPresetId;
  notifications: NotificationPreference;
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  version: PREFERENCES_SCHEMA_VERSION,
  theme: "dark",
  density: "compact",
  terminalFont: "system-mono",
  terminalFontSize: 13,
  terminalLineHeight: 1.35,
  terminalScrollback: 2_000,
  defaultLaunchPreset: "shell",
  notifications: "off",
};

export const TERMINAL_FONT_STACKS: Record<TerminalFontPreference, string> = {
  "system-mono":
    '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", monospace',
  cascadia: '"Cascadia Code", "SFMono-Regular", "SF Mono", monospace',
  jetbrains: '"JetBrains Mono", "SFMono-Regular", "SF Mono", monospace',
};

const PREFERENCE_KEYS = [
  "version",
  "theme",
  "density",
  "terminalFont",
  "terminalFontSize",
  "terminalLineHeight",
  "terminalScrollback",
  "defaultLaunchPreset",
  "notifications",
] as const;

export function parseStoredPreferences(
  raw: string | null,
): WorkspacePreferences {
  if (raw === null || raw.length > MAX_PREFERENCES_JSON_CHARS) {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
  return isWorkspacePreferences(candidate)
    ? candidate
    : DEFAULT_WORKSPACE_PREFERENCES;
}

export function serializePreferences(
  preferences: WorkspacePreferences,
): string {
  if (!isWorkspacePreferences(preferences)) {
    return JSON.stringify(DEFAULT_WORKSPACE_PREFERENCES);
  }
  return JSON.stringify(
    Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, preferences[key]])),
  );
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

export function resolveDefaultLaunchPreset(
  preferred: LaunchPresetId,
  capabilities: LaunchPresetCapability[],
): LaunchPresetId {
  if (capabilities.some(({ id, available }) => id === preferred && available)) {
    return preferred;
  }
  return capabilities.find(({ available }) => available)?.id ?? "shell";
}

function isWorkspacePreferences(
  candidate: unknown,
): candidate is WorkspacePreferences {
  if (!isRecord(candidate)) {
    return false;
  }
  const keys = Object.keys(candidate).sort();
  if (
    keys.length !== PREFERENCE_KEYS.length ||
    keys.some((key, index) => key !== [...PREFERENCE_KEYS].sort()[index])
  ) {
    return false;
  }
  return (
    candidate.version === PREFERENCES_SCHEMA_VERSION &&
    isOneOf(candidate.theme, ["system", "dark", "light"]) &&
    isOneOf(candidate.density, ["compact", "comfortable"]) &&
    isOneOf(candidate.terminalFont, ["system-mono", "cascadia", "jetbrains"]) &&
    isBoundedNumber(
      candidate.terminalFontSize,
      TERMINAL_FONT_SIZE_MIN,
      TERMINAL_FONT_SIZE_MAX,
      true,
    ) &&
    isBoundedNumber(
      candidate.terminalLineHeight,
      TERMINAL_LINE_HEIGHT_MIN,
      TERMINAL_LINE_HEIGHT_MAX,
      false,
    ) &&
    isBoundedNumber(
      candidate.terminalScrollback,
      TERMINAL_SCROLLBACK_MIN,
      TERMINAL_SCROLLBACK_MAX,
      true,
    ) &&
    isOneOf(candidate.defaultLaunchPreset, ["shell", "codex", "claude"]) &&
    isOneOf(candidate.notifications, ["off", "attention"])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const Value extends string>(
  value: unknown,
  options: readonly Value[],
): value is Value {
  return typeof value === "string" && options.includes(value as Value);
}

function isBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  integer: boolean,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum &&
    (!integer || Number.isInteger(value))
  );
}
