import type {
  GitCommitRecord,
  GitHistoryObservation,
  RepositoryObservation,
} from "@pacium/contracts";
import type { ReactNode } from "react";

import {
  visibleRepositoryHistory,
  type RepositoryHistoryViewState,
} from "./repository-history-model.js";

export function RepositoryHistoryPanel({
  onRefresh,
  repository,
  state,
}: {
  onRefresh: () => void;
  repository: RepositoryObservation | null;
  state: RepositoryHistoryViewState;
}) {
  const observation = visibleRepositoryHistory(state);
  const loading = state.status === "loading";

  return (
    <section
      aria-labelledby="inspector-history-tab"
      className="repository-history-panel"
      id="inspector-history-panel"
      role="tabpanel"
      tabIndex={0}
    >
      <header>
        <span>
          <strong>{repositoryHeading(repository)}</strong>
          <small>
            {repositoryContext(repository)}
            {repository !== null && " · "}
            {loading
              ? "Refreshing local history…"
              : historySummary(observation)}
          </small>
        </span>
        <button disabled={loading} onClick={onRefresh} type="button">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {observation === null ? (
        <HistoryMessage>
          {loading
            ? "Pacium is reading bounded local commit evidence. The terminal remains available."
            : "Refresh to read recent commits for this session."}
        </HistoryMessage>
      ) : observation.status === "not_repository" ? (
        <HistoryMessage>
          This terminal is not associated with a Git repository.
        </HistoryMessage>
      ) : observation.status === "empty" ? (
        <HistoryMessage>
          This repository has an unborn HEAD and no commits yet.
        </HistoryMessage>
      ) : observation.status === "error" ? (
        <HistoryMessage tone="error">
          {observation.error?.message ?? "Commit history is unavailable."} The
          terminal is still running.
        </HistoryMessage>
      ) : (
        <>
          <ol className="commit-history-list">
            {observation.commits.map((commit) => (
              <CommitRow commit={commit} key={commit.id} />
            ))}
          </ol>
          {observation.truncated && (
            <p className="history-truncated" role="note">
              Showing the newest 50 commits reachable from this HEAD. Use Git
              directly for older history.
            </p>
          )}
          <time dateTime={observation.observedAt}>
            Observed {new Date(observation.observedAt).toLocaleTimeString()}
          </time>
        </>
      )}
    </section>
  );
}

function CommitRow({ commit }: { commit: GitCommitRecord }) {
  return (
    <li>
      <article>
        <header>
          <code title={commit.id}>{commit.id.slice(0, 8)}</code>
          {commit.parents.length > 1 && <span>Merge</span>}
        </header>
        <strong>{commit.subject}</strong>
        <footer>
          <span>{commit.authorName}</span>
          <time dateTime={commit.authoredAt} title={commit.authoredAt}>
            {formatCommitTime(commit.authoredAt)}
          </time>
        </footer>
      </article>
    </li>
  );
}

function HistoryMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <p
      className={`repository-history-message is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function historySummary(observation: GitHistoryObservation | null): string {
  switch (observation?.status) {
    case "ready":
      return `${observation.commits.length} recent ${
        observation.commits.length === 1 ? "commit" : "commits"
      }`;
    case "empty":
      return "No commits";
    case "not_repository":
      return "No repository";
    case "error":
      return "Git history unavailable";
    case undefined:
      return "Open to inspect local history";
  }
}

function repositoryHeading(repository: RepositoryObservation | null): string {
  return repository?.name ?? "Commit history";
}

function repositoryContext(repository: RepositoryObservation | null): string {
  if (repository === null) {
    return "Select a terminal";
  }
  if (repository.status === "not_repository") {
    return "No repository";
  }
  if (repository.status === "error") {
    return "Repository unavailable";
  }
  if (repository.headState === "detached") {
    return `Detached · ${repository.headCommit?.slice(0, 8) ?? "unknown HEAD"}`;
  }
  return repository.branch ?? "Unborn HEAD";
}

function formatCommitTime(authoredAt: string): string {
  return new Date(authoredAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
