import { describe, expect, it } from "vitest";

import {
  DEFAULT_TERMINAL_DISPLAY_PREFERENCES,
  terminalOptionsForPreferences,
} from "./terminal-preferences.js";

describe("terminal display preferences", () => {
  it("preserves the established dark terminal defaults", () => {
    expect(
      terminalOptionsForPreferences(DEFAULT_TERMINAL_DISPLAY_PREFERENCES),
    ).toMatchObject({
      fontSize: 13,
      lineHeight: 1.35,
      scrollback: 2_000,
      theme: {
        background: "#101113",
        foreground: "#e7e7e9",
      },
    });
  });

  it("maps controlled light and typography preferences", () => {
    expect(
      terminalOptionsForPreferences({
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 16,
        lineHeight: 1.5,
        scrollback: 5_000,
        theme: "light",
      }),
    ).toMatchObject({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 16,
      lineHeight: 1.5,
      scrollback: 5_000,
      theme: {
        background: "#f7f7f8",
        foreground: "#25262b",
      },
    });
  });
});
