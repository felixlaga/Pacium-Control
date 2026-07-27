import { describe, expect, it } from "vitest";

import {
  MAX_GIT_CHANGES_OUTPUT_BYTES,
  parsePorcelainV2,
} from "./git-changes-model.js";

function ordinary(xy: string, path: string): string {
  return `1 ${xy} N... 100644 100644 100644 ${"a".repeat(40)} ${"b".repeat(40)} ${path}\0`;
}

describe("Git porcelain-v2 status parsing", () => {
  it("separates staged, unstaged, mixed, deleted, and type-changed evidence", () => {
    const files = parsePorcelainV2(
      [
        ordinary("M.", "staged.ts"),
        ordinary(".M", "unstaged.ts"),
        ordinary("MM", "mixed.ts"),
        ordinary(".D", "deleted.ts"),
        ordinary("T.", "type.ts"),
      ].join(""),
    );
    expect(files).toMatchObject([
      { path: "staged.ts", staged: true, unstaged: false, kind: "modified" },
      { path: "unstaged.ts", staged: false, unstaged: true },
      { path: "mixed.ts", staged: true, unstaged: true },
      { path: "deleted.ts", kind: "deleted" },
      { path: "type.ts", kind: "type_changed" },
    ]);
  });

  it("parses rename pairs, copies, untracked files, and newline paths", () => {
    const hash = "a".repeat(40);
    const output = [
      `2 R. N... 100644 100644 100644 ${hash} ${hash} R100 new name.ts\0old name.ts\0`,
      `2 C. N... 100644 100644 100644 ${hash} ${hash} C80 copy.ts\0source.ts\0`,
      "? new\nline.ts\0",
    ].join("");
    expect(parsePorcelainV2(output)).toEqual([
      {
        path: "new name.ts",
        previousPath: "old name.ts",
        kind: "renamed",
        staged: true,
        unstaged: false,
        untracked: false,
        conflicted: false,
      },
      {
        path: "copy.ts",
        previousPath: "source.ts",
        kind: "copied",
        staged: true,
        unstaged: false,
        untracked: false,
        conflicted: false,
      },
      {
        path: "new\nline.ts",
        previousPath: null,
        kind: "untracked",
        staged: false,
        unstaged: false,
        untracked: true,
        conflicted: false,
      },
    ]);
  });

  it("maps unmerged records and conflict XY codes to conflicted evidence", () => {
    const hash = "a".repeat(40);
    const unmerged = `u UU N... 100644 100644 100644 100644 ${hash} ${hash} ${hash} conflict.ts\0`;
    expect(parsePorcelainV2(unmerged)[0]).toMatchObject({
      path: "conflict.ts",
      kind: "conflicted",
      conflicted: true,
    });
    expect(
      parsePorcelainV2(ordinary("AU", "also-conflicted.ts"))[0],
    ).toMatchObject({
      kind: "conflicted",
      conflicted: true,
    });
  });

  it("rejects duplicate, incomplete, unknown, and excessive records", () => {
    expect(() =>
      parsePorcelainV2(
        `${ordinary("M.", "same.ts")}${ordinary(".M", "same.ts")}`,
      ),
    ).toThrow("duplicate");
    expect(() =>
      parsePorcelainV2(
        `2 R. N... 100644 100644 100644 ${"a".repeat(40)} ${"b".repeat(40)} R100 new.ts\0`,
      ),
    ).toThrow("previous path");
    expect(() => parsePorcelainV2("x unknown\0")).toThrow("unsupported");
    expect(() =>
      parsePorcelainV2("x".repeat(MAX_GIT_CHANGES_OUTPUT_BYTES + 1)),
    ).toThrow("exceeded");
  });
});
