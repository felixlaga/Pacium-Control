import type { GitChangesObservation } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  InspectorTabs,
  RepositoryChangesPanel,
  nextInspectorTab,
} from "./repository-changes.js";

const observation: GitChangesObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  observedAt: "2026-07-27T10:00:00.000Z",
  files: [
    {
      path: "src/new.ts",
      previousPath: "src/old.ts",
      kind: "renamed",
      staged: true,
      unstaged: true,
      untracked: false,
      conflicted: false,
      additions: 12,
      deletions: 3,
      binary: false,
      large: false,
      sizeBytes: 1_000,
    },
    {
      path: "assets/data.bin",
      previousPath: null,
      kind: "modified",
      staged: false,
      unstaged: true,
      untracked: false,
      conflicted: false,
      additions: null,
      deletions: null,
      binary: true,
      large: true,
      sizeBytes: 2_000_000,
    },
  ],
  totals: {
    fileCount: 2,
    additions: 12,
    deletions: 3,
    unavailableLineCount: 1,
    conflictCount: 0,
  },
  truncated: true,
  error: null,
};
const repository = {
  status: "ready" as const,
  root: "/work/pacium",
  name: "pacium",
  branch: "dev",
  headCommit: "a".repeat(40),
  headState: "branch" as const,
  worktreeKind: "main" as const,
  observedAt: "2026-07-27T10:00:00.000Z",
  error: null,
};

describe("repository Changes presentation", () => {
  it("renders accessible stable inspector tabs", () => {
    const markup = renderToStaticMarkup(
      <InspectorTabs active="changes" onChange={() => {}} />,
    );
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('id="inspector-changes-tab"');
    expect(markup).toContain("Overview");
    expect(markup).toContain("Changes");
  });

  it("moves predictably between inspector tabs from the keyboard", () => {
    expect(nextInspectorTab("overview", "ArrowRight")).toBe("changes");
    expect(nextInspectorTab("changes", "ArrowLeft")).toBe("overview");
    expect(nextInspectorTab("changes", "Home")).toBe("overview");
    expect(nextInspectorTab("overview", "End")).toBe("changes");
    expect(nextInspectorTab("overview", "Enter")).toBeNull();
  });

  it("renders rename, mixed, binary, large, counts, and truncation as text", () => {
    const markup = renderToStaticMarkup(
      <RepositoryChangesPanel
        onOpenDiff={() => {}}
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loaded",
          requestId: "request-1",
          observation,
        }}
      />,
    );
    expect(markup).toContain("src/new.ts");
    expect(markup).toContain('aria-label="Open diff for src/new.ts"');
    expect(markup).toContain("pacium");
    expect(markup).toContain("dev · aaaaaaaa");
    expect(markup).toContain("From src/old.ts");
    expect(markup).toContain("Staged");
    expect(markup).toContain("Unstaged");
    expect(markup).toContain("Binary");
    expect(markup).toContain("Large");
    expect(markup).toContain("+12");
    expect(markup).toContain("Line count unavailable");
    expect(markup).toContain("Showing the first 500");
    expect(markup).not.toContain("<script");
  });

  it("uses a singular summary for one changed file", () => {
    const markup = renderToStaticMarkup(
      <RepositoryChangesPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loaded",
          requestId: "request-1",
          observation: {
            ...observation,
            files: [observation.files[0]!],
            totals: {
              ...observation.totals,
              fileCount: 1,
            },
          },
        }}
      />,
    );
    expect(markup).toContain("1 reported change");
    expect(markup).not.toContain("1 reported changes");
  });

  it("explains loading, empty, and degraded states without hiding terminal survival", () => {
    const loading = renderToStaticMarkup(
      <RepositoryChangesPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loading",
          requestId: "request-1",
          previous: null,
        }}
      />,
    );
    expect(loading).toContain("Reading Git evidence");
    expect(loading).toContain("terminal remains available");

    const empty = renderToStaticMarkup(
      <RepositoryChangesPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loaded",
          requestId: "request-2",
          observation: {
            ...observation,
            files: [],
            totals: {
              fileCount: 0,
              additions: 0,
              deletions: 0,
              unavailableLineCount: 0,
              conflictCount: 0,
            },
            truncated: false,
          },
        }}
      />,
    );
    expect(empty).toContain("Git reports no staged");

    const error = renderToStaticMarkup(
      <RepositoryChangesPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loaded",
          requestId: "request-3",
          observation: {
            ...observation,
            status: "error",
            headCommit: null,
            files: [],
            totals: {
              fileCount: 0,
              additions: 0,
              deletions: 0,
              unavailableLineCount: 0,
              conflictCount: 0,
            },
            truncated: false,
            error: {
              code: "timeout",
              message: "Git changes inspection timed out.",
            },
          },
        }}
      />,
    );
    expect(error).toContain("Git changes inspection timed out");
    expect(error).toContain("terminal is still running");
    expect(error).toContain('role="alert"');
  });
});
