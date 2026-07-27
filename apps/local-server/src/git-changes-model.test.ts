import { describe, expect, it } from "vitest";

import {
  aggregateChangedFiles,
  LARGE_CHANGED_FILE_BYTES,
  MAX_GIT_CHANGES_OUTPUT_BYTES,
  parseNumstat,
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

  it("rejects absolute and repository-escaping status paths", () => {
    expect(() => parsePorcelainV2("? /private/escape\0")).toThrow(
      "invalid path",
    );
    expect(() => parsePorcelainV2("? ../escape\0")).toThrow("invalid path");
    expect(() => parsePorcelainV2("? nested\\..\\escape\0")).toThrow(
      "invalid path",
    );
    expect(() => parsePorcelainV2("? C:\\escape\0")).toThrow("invalid path");
  });
});

describe("Git numstat and changed-file aggregation", () => {
  it("parses numeric and binary records with unusual paths", () => {
    expect(
      parseNumstat("12\t3\ttext file.ts\0-\t-\tbinary\tfile.bin\0"),
    ).toEqual([
      {
        path: "text file.ts",
        additions: 12,
        deletions: 3,
        binary: false,
      },
      {
        path: "binary\tfile.bin",
        additions: null,
        deletions: null,
        binary: true,
      },
    ]);
  });

  it("combines old and new no-renames stats for a renamed file", () => {
    const hash = "a".repeat(40);
    const statuses = parsePorcelainV2(
      `2 R. N... 100644 100644 100644 ${hash} ${hash} R100 new.ts\0old.ts\0`,
    );
    const result = aggregateChangedFiles(
      statuses,
      parseNumstat(["20\t0\tnew.ts", "0\t10\told.ts", ""].join("\0")),
      new Map([["new.ts", 2_000]]),
    );
    expect(result.files[0]).toMatchObject({
      path: "new.ts",
      previousPath: "old.ts",
      kind: "renamed",
      additions: 20,
      deletions: 10,
      sizeBytes: 2_000,
    });
  });

  it("orders oversight states and labels unavailable, binary, and large facts", () => {
    const hash = "a".repeat(40);
    const statuses = parsePorcelainV2(
      [
        "? untracked.txt\0",
        ordinary(".M", "unstaged.ts"),
        ordinary("M.", "staged.ts"),
        ordinary("MM", "mixed.ts"),
        `u UU N... 100644 100644 100644 100644 ${hash} ${hash} ${hash} conflict.ts\0`,
        ordinary(".M", "large.bin"),
      ].join(""),
    );
    const result = aggregateChangedFiles(
      statuses,
      parseNumstat(
        [
          "1\t1\tunstaged.ts\0",
          "2\t0\tstaged.ts\0",
          "3\t2\tmixed.ts\0",
          "1\t1\tconflict.ts\0",
          "-\t-\tlarge.bin\0",
        ].join(""),
      ),
      new Map([["large.bin", LARGE_CHANGED_FILE_BYTES + 1]]),
    );
    expect(result.files.map(({ path }) => path)).toEqual([
      "conflict.ts",
      "mixed.ts",
      "staged.ts",
      "large.bin",
      "unstaged.ts",
      "untracked.txt",
    ]);
    expect(result.files.find(({ path }) => path === "large.bin")).toMatchObject(
      {
        binary: true,
        large: true,
        additions: null,
        deletions: null,
      },
    );
    expect(result.totals).toEqual({
      fileCount: 6,
      additions: 7,
      deletions: 4,
      unavailableLineCount: 2,
      conflictCount: 1,
    });
  });

  it("rejects malformed, duplicate, unsafe-count, and excessive numstat", () => {
    expect(() => parseNumstat("invalid\0")).toThrow("malformed");
    expect(() =>
      parseNumstat(["1\t1\ta.ts", "1\t2\ta.ts", ""].join("\0")),
    ).toThrow("duplicate");
    expect(() =>
      parseNumstat(`${Number.MAX_SAFE_INTEGER}0\t1\ta.ts\0`),
    ).toThrow("safe bounds");
    expect(() =>
      parseNumstat("x".repeat(MAX_GIT_CHANGES_OUTPUT_BYTES + 1)),
    ).toThrow("exceeded");
    expect(() => parseNumstat("1\t1\t../../escape\0")).toThrow("invalid path");
  });
});
