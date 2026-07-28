import { describe, expect, it } from "vitest";

import {
  buildTerminalTextExcerpt,
  MAX_TERMINAL_EXCERPT_CHARACTERS,
  MAX_TERMINAL_EXCERPT_LINES,
  MAX_TERMINAL_EXCERPT_SCAN_LINES,
} from "./terminal-excerpt.js";

describe("bounded terminal excerpt", () => {
  it("keeps only the newest non-empty lines in terminal order", () => {
    const excerpt = buildTerminalTextExcerpt([
      "oldest",
      "second",
      "",
      "third",
      "fourth",
      "newest",
      "   ",
    ]);

    expect(excerpt).toEqual({
      status: "ready",
      text: "second\nthird\nfourth\nnewest",
      lineCount: MAX_TERMINAL_EXCERPT_LINES,
      truncated: true,
    });
  });

  it("caps Unicode characters without splitting a surrogate pair", () => {
    const excerpt = buildTerminalTextExcerpt([
      "🧪".repeat(MAX_TERMINAL_EXCERPT_CHARACTERS + 1),
    ]);

    expect(excerpt.status).toBe("ready");
    expect(Array.from(excerpt.text)).toHaveLength(
      MAX_TERMINAL_EXCERPT_CHARACTERS,
    );
    expect(excerpt.text.endsWith("…")).toBe(true);
    expect(excerpt.truncated).toBe(true);
  });

  it("neutralizes display controls while retaining hostile text as text", () => {
    const excerpt = buildTerminalTextExcerpt([
      "\u202e<script>alert(1)</script>\u0007",
    ]);

    expect(excerpt).toMatchObject({
      status: "ready",
      text: "�<script>alert(1)</script>�",
      truncated: false,
    });
  });

  it("returns an honest empty state and never scans unbounded history", () => {
    expect(buildTerminalTextExcerpt(["", "   "])).toEqual({
      status: "empty",
      text: "",
      lineCount: 0,
      truncated: false,
    });
    expect(
      buildTerminalTextExcerpt([
        "outside scan window",
        ...Array.from({ length: MAX_TERMINAL_EXCERPT_SCAN_LINES }, () => ""),
      ]),
    ).toMatchObject({ status: "empty", text: "" });
  });
});
