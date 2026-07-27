import {
  MAX_GIT_DIFF_BYTES,
  MAX_GIT_DIFF_LINES,
  MAX_GIT_DIFF_LINE_CHARS,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import { InvalidDiffOutput, normalizeDiffSections } from "./git-diff-model.js";

describe("bounded Git diff normalization", () => {
  it("preserves staged and unstaged patches with exact aggregate counts", () => {
    const staged = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1 +1 @@",
      "-old\r",
      "+staged\r",
      "",
    ].join("\n");
    const unstaged = [
      "diff --git a/file.ts b/file.ts",
      "@@ -1 +1,2 @@",
      " staged",
      "+unstaged",
      "\\ No newline at end of file",
    ].join("\n");
    const normalized = normalizeDiffSections([
      { source: "staged", patch: staged },
      { source: "unstaged", patch: unstaged },
    ]);

    expect(normalized).toMatchObject({
      status: "ready",
      sections: [
        { source: "staged", patch: staged, lineCount: 6 },
        { source: "unstaged", patch: unstaged, lineCount: 5 },
      ],
      patchLines: 11,
    });
    expect(normalized.patchBytes).toBe(
      new TextEncoder().encode(staged + unstaged).byteLength,
    );
  });

  it("returns explicit empty and binary states without patch content", () => {
    expect(normalizeDiffSections([{ source: "combined", patch: "" }])).toEqual({
      status: "empty",
      sections: [],
      patchBytes: 0,
      patchLines: 0,
    });
    for (const patch of [
      "Binary files a/image.png and b/image.png differ\n",
      "GIT binary patch\nliteral 0\n",
      "Binary file asset.bin has changed\n",
    ]) {
      expect(
        normalizeDiffSections([{ source: "combined", patch }]),
      ).toMatchObject({
        status: "binary",
        sections: [],
      });
    }
  });

  it("bounds UTF-8 bytes, aggregate lines, and individual line length", () => {
    expect(
      normalizeDiffSections([
        {
          source: "combined",
          patch: "λ".repeat(MAX_GIT_DIFF_BYTES),
        },
      ]),
    ).toMatchObject({ status: "too_large" });
    expect(
      normalizeDiffSections([
        {
          source: "combined",
          patch: "x\n".repeat(MAX_GIT_DIFF_LINES + 1),
        },
      ]),
    ).toMatchObject({ status: "too_large" });
    expect(
      normalizeDiffSections([
        {
          source: "combined",
          patch: "x".repeat(MAX_GIT_DIFF_LINE_CHARS + 1),
        },
      ]),
    ).toMatchObject({ status: "too_large" });
    expect(
      normalizeDiffSections([
        {
          source: "staged",
          patch: "x\n".repeat(MAX_GIT_DIFF_LINES / 2 + 1),
        },
        {
          source: "unstaged",
          patch: "y\n".repeat(MAX_GIT_DIFF_LINES / 2 + 1),
        },
      ]),
    ).toMatchObject({ status: "too_large" });
  });

  it("rejects unsafe decoding and impossible section combinations", () => {
    for (const patch of ["unsafe\0patch", "invalid \uFFFD bytes"]) {
      expect(() =>
        normalizeDiffSections([{ source: "combined", patch }]),
      ).toThrow(InvalidDiffOutput);
    }
    expect(() =>
      normalizeDiffSections([
        { source: "combined", patch: "first" },
        { source: "unstaged", patch: "second" },
      ]),
    ).toThrow(InvalidDiffOutput);
    expect(() =>
      normalizeDiffSections([
        { source: "staged", patch: "first" },
        { source: "staged", patch: "second" },
      ]),
    ).toThrow(InvalidDiffOutput);
  });
});
