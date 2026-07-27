import type { RepositoryObservation } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryContextCard } from "./repository-context.js";

const ready: RepositoryObservation = {
  status: "ready",
  root: "/work/pacium",
  name: "pacium",
  branch: "codex/repository-context",
  headCommit: "a".repeat(40),
  headState: "branch",
  worktreeKind: "linked",
  observedAt: "2026-07-27T10:00:00.000Z",
  error: null,
};

describe("repository context rendering", () => {
  it("renders branch, commit, linked-worktree, root, and freshness evidence", () => {
    const markup = renderToStaticMarkup(
      <RepositoryContextCard repository={ready} />,
    );
    expect(markup).toContain("codex/repository-context");
    expect(markup).toContain("aaaaaaaaaaaa");
    expect(markup).toContain("Linked worktree");
    expect(markup).toContain("/work/pacium");
    expect(markup).toContain("<time");
  });

  it("distinguishes detached and unborn heads without inventing a branch or commit", () => {
    const detached = renderToStaticMarkup(
      <RepositoryContextCard
        repository={{
          ...ready,
          branch: null,
          headState: "detached",
        }}
      />,
    );
    expect(detached).toContain("Detached HEAD");

    const unborn = renderToStaticMarkup(
      <RepositoryContextCard
        repository={{
          ...ready,
          branch: "main",
          headCommit: null,
          headState: "unborn",
        }}
      />,
    );
    expect(unborn).toContain("main · no commits");
    expect(unborn).toContain("No commit");
  });

  it("explains degraded and non-repository states while preserving the terminal", () => {
    const degraded = renderToStaticMarkup(
      <RepositoryContextCard
        repository={{
          status: "error",
          root: null,
          name: null,
          branch: null,
          headCommit: null,
          headState: "unknown",
          worktreeKind: "unknown",
          observedAt: ready.observedAt,
          error: {
            code: "timeout",
            message: "Git inspection timed out.",
          },
        }}
      />,
    );
    expect(degraded).toContain("Git inspection timed out");
    expect(degraded).toContain("terminal is still running");

    const absent = renderToStaticMarkup(
      <RepositoryContextCard
        repository={{
          status: "not_repository",
          root: null,
          name: null,
          branch: null,
          headCommit: null,
          headState: "unknown",
          worktreeKind: "unknown",
          observedAt: ready.observedAt,
          error: null,
        }}
      />,
    );
    expect(absent).toContain("Not detected");
    expect(absent).toContain("not inside a Git worktree");
  });
});
