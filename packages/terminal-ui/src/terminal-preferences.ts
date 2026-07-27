import type { ITheme } from "@xterm/xterm";

export interface TerminalDisplayPreferences {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  scrollback: number;
  theme: "dark" | "light";
}

export const DEFAULT_TERMINAL_DISPLAY_PREFERENCES: TerminalDisplayPreferences =
  {
    fontFamily:
      '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", monospace',
    fontSize: 13,
    lineHeight: 1.35,
    scrollback: 2_000,
    theme: "dark",
  };

const DARK_TERMINAL_THEME: ITheme = {
  background: "#101113",
  foreground: "#e7e7e9",
  cursor: "#8b7cf6",
  cursorAccent: "#101113",
  selectionBackground: "#6658cc66",
  black: "#202126",
  brightBlack: "#6d7078",
  red: "#ec6a75",
  brightRed: "#f07b85",
  green: "#92c353",
  brightGreen: "#a4d467",
  yellow: "#e6b450",
  brightYellow: "#f2c866",
  blue: "#6aa6f8",
  brightBlue: "#86b7fa",
  magenta: "#b79bf8",
  brightMagenta: "#c8b2fa",
  cyan: "#64c5da",
  brightCyan: "#7bd5e5",
  white: "#d9d9dc",
  brightWhite: "#ffffff",
};

const LIGHT_TERMINAL_THEME: ITheme = {
  background: "#f7f7f8",
  foreground: "#25262b",
  cursor: "#6558d9",
  cursorAccent: "#f7f7f8",
  selectionBackground: "#786be13d",
  black: "#303138",
  brightBlack: "#737680",
  red: "#b83d4b",
  brightRed: "#d34f5c",
  green: "#4e7c35",
  brightGreen: "#639947",
  yellow: "#946b16",
  brightYellow: "#ad7c1a",
  blue: "#356cad",
  brightBlue: "#477fc1",
  magenta: "#7352b3",
  brightMagenta: "#8a68ca",
  cyan: "#33788a",
  brightCyan: "#438e9f",
  white: "#d9dadd",
  brightWhite: "#ffffff",
};

export function terminalOptionsForPreferences(
  preferences: TerminalDisplayPreferences,
) {
  return {
    fontFamily: preferences.fontFamily,
    fontSize: preferences.fontSize,
    lineHeight: preferences.lineHeight,
    scrollback: preferences.scrollback,
    theme:
      preferences.theme === "light"
        ? LIGHT_TERMINAL_THEME
        : DARK_TERMINAL_THEME,
  };
}
