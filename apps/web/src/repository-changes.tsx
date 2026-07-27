import type { GitChangedFile, GitChangesObservation } from "@pacium/contracts";
import type { KeyboardEvent, ReactNode } from "react";

import {
  visibleRepositoryChanges,
  type RepositoryChangesViewState,
} from "./repository-changes-model.js";

export type InspectorTab = "overview" | "changes";

export function InspectorTabs({
  active,
  onChange,
}: {
  active: InspectorTab;
  onChange: (tab: InspectorTab) => void;
}) {
  return (
    <div aria-label="Inspector views" className="inspector-tabs" role="tablist">
      <button
        aria-controls="inspector-overview-panel"
        aria-selected={active === "overview"}
        id="inspector-overview-tab"
        onClick={() => onChange("overview")}
        onKeyDown={(event) =>
          handleInspectorTabKeyDown(event, "overview", onChange)
        }
        role="tab"
        tabIndex={active === "overview" ? 0 : -1}
        type="button"
      >
        Overview
      </button>
      <button
        aria-controls="inspector-changes-panel"
        aria-selected={active === "changes"}
        id="inspector-changes-tab"
        onClick={() => onChange("changes")}
        onKeyDown={(event) =>
          handleInspectorTabKeyDown(event, "changes", onChange)
        }
        role="tab"
        tabIndex={active === "changes" ? 0 : -1}
        type="button"
      >
        Changes
      </button>
    </div>
  );
}

export function nextInspectorTab(
  current: InspectorTab,
  key: string,
): InspectorTab | null {
  if (key === "Home") {
    return "overview";
  }
  if (key === "End") {
    return "changes";
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return current === "overview" ? "changes" : "overview";
  }
  return null;
}

function handleInspectorTabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  current: InspectorTab,
  onChange: (tab: InspectorTab) => void,
): void {
  const next = nextInspectorTab(current, event.key);
  if (next === null) {
    return;
  }
  event.preventDefault();
  onChange(next);
  document.getElementById(`inspector-${next}-tab`)?.focus();
}

export function RepositoryChangesPanel({
  onRefresh,
  state,
}: {
  onRefresh: () => void;
  state: RepositoryChangesViewState;
}) {
  const observation = visibleRepositoryChanges(state);
  const loading = state.status === "loading";

  return (
    <section
      aria-labelledby="inspector-changes-tab"
      className="repository-changes-panel"
      id="inspector-changes-panel"
      role="tabpanel"
      tabIndex={0}
    >
      <header>
        <span>
          <strong>Changed files</strong>
          <small>
            {observation === null
              ? loading
                ? "Reading Git evidence…"
                : "Open to inspect the selected session."
              : changeSummary(observation)}
          </small>
        </span>
        <button disabled={loading} onClick={onRefresh} type="button">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {observation === null ? (
        <ChangesMessage>
          {loading
            ? "Pacium is reading bounded Git status. The terminal remains available."
            : "Refresh to read changed files for this session."}
        </ChangesMessage>
      ) : observation.status === "not_repository" ? (
        <ChangesMessage>
          This terminal is not associated with a Git repository.
        </ChangesMessage>
      ) : observation.status === "error" ? (
        <ChangesMessage tone="error">
          {observation.error?.message ??
            "Changed-file evidence is unavailable."}{" "}
          The terminal is still running.
        </ChangesMessage>
      ) : observation.files.length === 0 ? (
        <ChangesMessage>
          Git reports no staged, unstaged, conflicted, or untracked files.
        </ChangesMessage>
      ) : (
        <>
          <div className="changes-totals">
            <span>{observation.totals.fileCount} files</span>
            <span className="changes-additions">
              +{observation.totals.additions}
            </span>
            <span className="changes-deletions">
              −{observation.totals.deletions}
            </span>
            {observation.totals.unavailableLineCount > 0 && (
              <span>
                {observation.totals.unavailableLineCount} counts unavailable
              </span>
            )}
          </div>
          <ul className="changed-file-list">
            {observation.files.map((file) => (
              <ChangedFileRow file={file} key={file.path} />
            ))}
          </ul>
          {observation.truncated && (
            <p className="changes-truncated" role="note">
              Showing the first 500 files in oversight order. Use Git directly
              for the complete status.
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

function ChangedFileRow({ file }: { file: GitChangedFile }) {
  return (
    <li className={file.conflicted ? "is-conflicted" : undefined}>
      <div className="changed-file-copy">
        <strong title={file.path}>{file.path}</strong>
        {file.previousPath !== null && (
          <small title={file.previousPath}>From {file.previousPath}</small>
        )}
      </div>
      <div className="changed-file-evidence">
        <span>{changeKindLabel(file.kind)}</span>
        {file.conflicted && <span>Conflict</span>}
        {file.staged && <span>Staged</span>}
        {file.unstaged && <span>Unstaged</span>}
        {file.untracked && <span>Untracked</span>}
        {file.binary && <span>Binary</span>}
        {file.large && <span>Large</span>}
      </div>
      <span className="changed-file-stats">
        {file.additions === null || file.deletions === null ? (
          "Line count unavailable"
        ) : (
          <>
            <span className="changes-additions">+{file.additions}</span>
            <span className="changes-deletions">−{file.deletions}</span>
          </>
        )}
      </span>
    </li>
  );
}

function ChangesMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <p
      className={`repository-changes-message is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function changeSummary(observation: GitChangesObservation): string {
  switch (observation.status) {
    case "ready":
      return observation.files.length === 0
        ? "Working tree clear"
        : `${observation.files.length} reported changes`;
    case "not_repository":
      return "No repository";
    case "error":
      return "Git evidence unavailable";
  }
}

function changeKindLabel(kind: GitChangedFile["kind"]): string {
  switch (kind) {
    case "added":
      return "Added";
    case "modified":
      return "Modified";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "copied":
      return "Copied";
    case "type_changed":
      return "Type changed";
    case "untracked":
      return "Untracked";
    case "conflicted":
      return "Conflicted";
  }
}
