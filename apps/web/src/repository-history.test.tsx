import type { GitHistoryObservation } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RepositoryHistoryPanel } from "./repository-history.js";

const observation: GitHistoryObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  observedAt: "2026-07-27T11:00:00.000Z",
  commits: [
    {
      id: "a".repeat(40),
      parents: ["b".repeat(40), "c".repeat(40)],
      authorName: "Pacium Agent",
      authoredAt: "2026-07-27T10:30:00+02:00",
      subject: "<script>alert('history')</script>",
    },
    {
      id: "b".repeat(40),
      parents: [],
      authorName: "Felix",
      authoredAt: "2026-07-26T09:00:00Z",
      subject: "Initial commit",
    },
  ],
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

describe("repository history presentation", () => {
  it("renders bounded commit evidence, merge shape, and hostile text safely", () => {
    const markup = renderToStaticMarkup(
      <RepositoryHistoryPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loaded",
          requestId: "request-1",
          sessionId: "session-1",
          observation,
        }}
      />,
    );
    expect(markup).toContain("pacium");
    expect(markup).toContain("dev · 2 recent commits");
    expect(markup).toContain("aaaaaaaa");
    expect(markup).toContain("Merge");
    expect(markup).toContain("Pacium Agent");
    expect(markup).toContain("Showing the newest 50");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("pacium@example");
  });

  it("explains loading, unborn, absent, and degraded states", () => {
    const loading = renderToStaticMarkup(
      <RepositoryHistoryPanel
        onRefresh={() => {}}
        repository={repository}
        state={{
          status: "loading",
          requestId: "request-1",
          sessionId: "session-1",
          previous: null,
        }}
      />,
    );
    expect(loading).toContain("reading bounded local commit evidence");
    expect(loading).toContain("terminal remains available");

    const empty = renderState({
      ...observation,
      status: "empty",
      headCommit: null,
      commits: [],
      truncated: false,
    });
    expect(empty).toContain("unborn HEAD");

    const absent = renderState({
      ...observation,
      status: "not_repository",
      root: null,
      headCommit: null,
      commits: [],
      truncated: false,
    });
    expect(absent).toContain("not associated with a Git repository");

    const error = renderState({
      ...observation,
      status: "error",
      commits: [],
      truncated: false,
      error: {
        code: "timeout",
        message: "Git history inspection timed out.",
      },
    });
    expect(error).toContain("Git history inspection timed out");
    expect(error).toContain("terminal is still running");
    expect(error).toContain('role="alert"');
  });
});

function renderState(observation: GitHistoryObservation): string {
  return renderToStaticMarkup(
    <RepositoryHistoryPanel
      onRefresh={() => {}}
      repository={repository}
      state={{
        status: "loaded",
        requestId: "request-1",
        sessionId: "session-1",
        observation,
      }}
    />,
  );
}
