import type { GitDiffObservation } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryDiffPanel } from "./repository-diff.js";

const ready: GitDiffObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  path: "src/file.ts",
  previousPath: null,
  observedAt: "2026-07-27T10:00:00.000Z",
  sections: [
    {
      source: "combined",
      patch: [
        "diff --git a/src/file.ts b/src/file.ts",
        "--- a/src/file.ts",
        "+++ b/src/file.ts",
        "@@ -1 +1 @@",
        "-old",
        "+<script>alert(1)</script>",
        "",
      ].join("\n"),
      byteCount: 119,
      lineCount: 6,
    },
  ],
  patchBytes: 119,
  patchLines: 6,
  error: null,
};

describe("repository diff presentation", () => {
  it("renders syntax, line evidence, and controls without interpreting HTML", () => {
    const markup = renderToStaticMarkup(
      <RepositoryDiffPanel
        onBack={() => {}}
        onRefresh={() => {}}
        state={{
          status: "loaded",
          requestId: "request-1",
          sessionId: "session-1",
          path: ready.path,
          observation: ready,
        }}
      />,
    );

    expect(markup).toContain("src/file.ts");
    expect(markup).toContain("Search diff");
    expect(markup).toContain("Wrap");
    expect(markup).toContain("Collapse all");
    expect(markup).toContain("Old line 1");
    expect(markup).toContain("New line 1");
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain('aria-expanded="true"');
  });

  it("explains loading and every unavailable state while preserving terminal truth", () => {
    const loading = renderToStaticMarkup(
      <RepositoryDiffPanel
        onBack={() => {}}
        onRefresh={() => {}}
        state={{
          status: "loading",
          requestId: "request-1",
          sessionId: "session-1",
          path: "src/file.ts",
          previous: null,
        }}
      />,
    );
    expect(loading).toContain("bounded Git patch");
    expect(loading).toContain("terminal remains available");

    const messages = new Map<GitDiffObservation["status"], string>([
      ["empty", "no textual patch"],
      ["binary", "binary content"],
      ["too_large", "safe display limits"],
      ["not_found", "no longer in the changed-file evidence"],
      ["not_repository", "no longer associated"],
      ["error", "terminal is still running"],
    ]);
    for (const [status, expected] of messages) {
      const observation: GitDiffObservation = {
        ...ready,
        status,
        root: status === "not_repository" ? null : ready.root,
        headCommit: status === "not_repository" ? null : ready.headCommit,
        sections: [],
        patchBytes: 0,
        patchLines: 0,
        error:
          status === "error"
            ? {
                code: "timeout",
                message: "Git diff inspection timed out.",
              }
            : null,
      };
      const markup = renderToStaticMarkup(
        <RepositoryDiffPanel
          onBack={() => {}}
          onRefresh={() => {}}
          state={{
            status: "loaded",
            requestId: "request-1",
            sessionId: "session-1",
            path: ready.path,
            observation,
          }}
        />,
      );
      expect(markup.toLocaleLowerCase()).toContain(expected);
    }
  });
});
