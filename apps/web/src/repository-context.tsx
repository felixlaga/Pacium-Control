import type { RepositoryObservation } from "@pacium/contracts";

export function RepositoryContextCard({
  repository,
}: {
  repository: RepositoryObservation;
}) {
  if (repository.status === "not_repository") {
    return (
      <div className="repository-card repository-card-empty">
        <strong>Not detected</strong>
        <p>This terminal’s working directory is not inside a Git worktree.</p>
        <ObservationTime value={repository.observedAt} />
      </div>
    );
  }

  if (repository.status === "error") {
    return (
      <div className="repository-card repository-card-error">
        <strong>Inspection unavailable</strong>
        <p>
          {repository.error?.message ??
            "Git repository evidence is unavailable."}{" "}
          The terminal is still running.
        </p>
        {repository.root !== null && (
          <code title={repository.root}>{repository.root}</code>
        )}
        <ObservationTime value={repository.observedAt} />
      </div>
    );
  }

  return (
    <div className="repository-card">
      <header>
        <span>
          <strong>{repository.name}</strong>
          <small>{headLabel(repository)}</small>
        </span>
        <span className="repository-worktree-kind">
          {repository.worktreeKind === "linked"
            ? "Linked worktree"
            : "Main worktree"}
        </span>
      </header>
      <dl>
        <div>
          <dt>HEAD</dt>
          <dd>
            {repository.headCommit === null
              ? "No commit"
              : repository.headCommit.slice(0, 12)}
          </dd>
        </div>
        <div>
          <dt>Root</dt>
          <dd title={repository.root ?? undefined}>
            {repository.root ?? "Unavailable"}
          </dd>
        </div>
      </dl>
      <ObservationTime value={repository.observedAt} />
    </div>
  );
}

function headLabel(repository: RepositoryObservation): string {
  switch (repository.headState) {
    case "branch":
      return repository.branch ?? "Branch unavailable";
    case "detached":
      return "Detached HEAD";
    case "unborn":
      return `${repository.branch ?? "Unborn branch"} · no commits`;
    case "unknown":
      return "HEAD unavailable";
  }
}

function ObservationTime({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      Observed {new Date(value).toLocaleTimeString()}
    </time>
  );
}
