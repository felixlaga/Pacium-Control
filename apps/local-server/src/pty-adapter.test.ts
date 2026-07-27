import { describe, expect, it } from "vitest";

import { mergePtyEnvironment } from "./pty-adapter.js";

describe("server-owned PTY environment additions", () => {
  it("adds only bounded Pacium-scoped values without mutating the base", () => {
    const base = { PATH: "/bin", PACIUM_SESSION: "1" };
    expect(
      mergePtyEnvironment(base, {
        PACIUM_CLAUDE_HOOK_TOKEN: "token-value",
      }),
    ).toEqual({
      PATH: "/bin",
      PACIUM_SESSION: "1",
      PACIUM_CLAUDE_HOOK_TOKEN: "token-value",
    });
    expect(base).toEqual({ PATH: "/bin", PACIUM_SESSION: "1" });
  });

  it.each([
    { HOME: "/attacker" },
    { PACIUM_SESSION: "0" },
    { "PACIUM_BAD-KEY": "value" },
    { PACIUM_BAD: "line\nbreak" },
    { PACIUM_BIG: "x".repeat(8_193) },
  ])("rejects unsafe additions", (additions) => {
    expect(() => mergePtyEnvironment({}, additions)).toThrow(
      "Invalid server-owned PTY environment additions.",
    );
  });

  it("rejects an excessive key count", () => {
    expect(() =>
      mergePtyEnvironment(
        {},
        Object.fromEntries(
          Array.from({ length: 9 }, (_, index) => [
            `PACIUM_VALUE_${index}`,
            "value",
          ]),
        ),
      ),
    ).toThrow("Invalid server-owned PTY environment additions.");
  });
});
