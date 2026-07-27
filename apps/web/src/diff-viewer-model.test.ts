import type { GitDiffSection } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  hiddenDiffLineCount,
  matchingDiffLineIds,
  normalizeDiffSearch,
  parseDiffSections,
  toggleCollapsedHunk,
  visibleDiffLines,
} from "./diff-viewer-model.js";

function section(
  patch: string,
  source: GitDiffSection["source"] = "combined",
): GitDiffSection {
  return {
    source,
    patch,
    byteCount: new TextEncoder().encode(patch).byteLength,
    lineCount: patch.endsWith("\n")
      ? patch.split("\n").length - 1
      : patch.split("\n").length,
  };
}

describe("diff viewer syntax model", () => {
  it("classifies unified syntax and derives old/new line numbers", () => {
    const patch = [
      "diff --git a/file.ts b/file.ts",
      "index aaaaaaa..bbbbbbb 100644",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -10,2 +20,3 @@ function example()",
      " context",
      "-old",
      "+new",
      "+extra",
      "\\ No newline at end of file",
      "",
    ].join("\n");
    const document = parseDiffSections([section(patch)]);
    const lines = document.sections[0]!.lines;

    expect(lines.map(({ kind }) => kind)).toEqual([
      "diff_header",
      "metadata",
      "file_header",
      "file_header",
      "hunk_header",
      "context",
      "deletion",
      "addition",
      "addition",
      "metadata",
    ]);
    expect(
      lines.slice(5).map(({ oldLine, newLine }) => [oldLine, newLine]),
    ).toEqual([
      [10, 20],
      [11, null],
      [null, 21],
      [null, 22],
      [null, null],
    ]);
  });

  it("keeps combined conflict hunks visible without invented numbering", () => {
    const patch = [
      "diff --cc conflict.ts",
      "@@@ -1,2 -1,2 +1,6 @@@",
      "++<<<<<<< ours",
      " +ours",
      "+ =======",
      "+ theirs",
      "++>>>>>>> theirs",
    ].join("\n");
    const lines = parseDiffSections([section(patch)]).sections[0]!.lines;

    expect(lines[1]).toMatchObject({ kind: "hunk_header" });
    expect(
      lines
        .slice(2)
        .every(({ oldLine, newLine }) => oldLine === null && newLine === null),
    ).toBe(true);
  });

  it("searches literally, case-insensitively, and without parsing HTML", () => {
    const patch = [
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "-const old = '[value]';",
      "+const next = '<script>alert(1)</script>';",
    ].join("\n");
    const document = parseDiffSections([section(patch)]);

    expect(matchingDiffLineIds(document, "[VALUE]").size).toBe(1);
    expect(matchingDiffLineIds(document, "<script>").size).toBe(1);
    expect(matchingDiffLineIds(document, ".*").size).toBe(0);
    expect(document.sections[0]!.lines.at(-1)?.text).toContain("<script>");
    expect(normalizeDiffSearch("X".repeat(250))).toHaveLength(200);
  });

  it("collapses only hunk bodies and restores them predictably", () => {
    const patch = [
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "@@ -10 +10 @@",
      "-before",
      "+after",
      "",
    ].join("\n");
    const document = parseDiffSections([section(patch)]);
    const view = document.sections[0]!;
    const firstHunk = document.hunkIds[0]!;
    const collapsed = toggleCollapsedHunk(new Set(), firstHunk);

    expect(hiddenDiffLineCount(view, firstHunk)).toBe(2);
    expect(visibleDiffLines(view, collapsed).map(({ text }) => text)).toEqual([
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "@@ -10 +10 @@",
      "-before",
      "+after",
    ]);
    expect(toggleCollapsedHunk(collapsed, firstHunk).size).toBe(0);
  });
});
