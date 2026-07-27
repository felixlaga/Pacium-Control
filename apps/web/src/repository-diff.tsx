import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  hiddenDiffLineCount,
  matchingDiffLineIds,
  parseDiffSections,
  toggleCollapsedHunk,
  visibleDiffLines,
} from "./diff-viewer-model.js";
import {
  visibleRepositoryDiff,
  type RepositoryDiffViewState,
} from "./repository-diff-model.js";

export function RepositoryDiffPanel({
  onBack,
  onRefresh,
  state,
}: {
  onBack: () => void;
  onRefresh: () => void;
  state: RepositoryDiffViewState;
}) {
  const observation = visibleRepositoryDiff(state);
  const loading = state.status === "loading";
  const [query, setQuery] = useState("");
  const [wrapped, setWrapped] = useState(false);
  const [collapsedHunks, setCollapsedHunks] = useState<Set<string>>(
    () => new Set(),
  );
  const document = useMemo(
    () =>
      observation?.status === "ready"
        ? parseDiffSections(observation.sections)
        : null,
    [observation],
  );
  const matches = useMemo(
    () =>
      document === null
        ? new Set<string>()
        : matchingDiffLineIds(document, query),
    [document, query],
  );
  const allCollapsed =
    document !== null &&
    document.hunkIds.length > 0 &&
    collapsedHunks.size === document.hunkIds.length;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") {
      return;
    }
    if (event.target instanceof HTMLInputElement) {
      if (query.length > 0) {
        event.preventDefault();
        setQuery("");
      }
      return;
    }
    event.preventDefault();
    onBack();
  };

  return (
    <section
      aria-labelledby="inspector-changes-tab"
      className="repository-diff-panel"
      id="inspector-changes-panel"
      onKeyDown={handleKeyDown}
      role="tabpanel"
      tabIndex={0}
    >
      <header className="repository-diff-heading">
        <button onClick={onBack} type="button">
          ← Back
        </button>
        <span>
          <strong title={selectedPath(state, observation)}>
            {selectedPath(state, observation)}
          </strong>
          <small>
            {loading
              ? "Refreshing bounded Git evidence…"
              : diffSummary(observation)}
          </small>
        </span>
        <button disabled={loading} onClick={onRefresh} type="button">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {observation?.status === "ready" && document !== null ? (
        <>
          <div className="repository-diff-tools">
            <label>
              <span className="visually-hidden">Search diff</span>
              <input
                aria-label="Search diff"
                maxLength={200}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find in diff"
                type="search"
                value={query}
              />
            </label>
            <button
              aria-pressed={wrapped}
              onClick={() => setWrapped((current) => !current)}
              type="button"
            >
              Wrap
            </button>
            <button
              disabled={document.hunkIds.length === 0}
              onClick={() =>
                setCollapsedHunks(
                  allCollapsed ? new Set() : new Set(document.hunkIds),
                )
              }
              type="button"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
          {query.length > 0 && (
            <p className="diff-search-summary" role="status">
              {matches.size} matching {matches.size === 1 ? "line" : "lines"}
            </p>
          )}
          <div
            className={`diff-document ${wrapped ? "is-wrapped" : ""}`}
            tabIndex={0}
          >
            {document.sections.map((section, sectionIndex) => (
              <section
                aria-label={`${sectionSourceLabel(section.source)} diff`}
                className="diff-section"
                key={`${section.source}-${sectionIndex}`}
              >
                {(document.sections.length > 1 ||
                  section.source !== "combined") && (
                  <h3>{sectionSourceLabel(section.source)}</h3>
                )}
                <ol>
                  {visibleDiffLines(section, collapsedHunks).map((line) => {
                    const collapsed =
                      line.hunkId !== null &&
                      line.kind === "hunk_header" &&
                      collapsedHunks.has(line.hunkId);
                    return (
                      <li
                        className={`diff-line is-${line.kind} ${
                          matches.has(line.id) ? "is-search-match" : ""
                        }`}
                        key={line.id}
                      >
                        <span aria-hidden="true" className="diff-old-line">
                          {line.oldLine ?? ""}
                        </span>
                        <span aria-hidden="true" className="diff-new-line">
                          {line.newLine ?? ""}
                        </span>
                        {line.kind === "hunk_header" && line.hunkId !== null ? (
                          <button
                            aria-expanded={!collapsed}
                            onClick={() =>
                              setCollapsedHunks((current) =>
                                toggleCollapsedHunk(current, line.hunkId!),
                              )
                            }
                            type="button"
                          >
                            <span>{line.text}</span>
                            {collapsed && (
                              <small>
                                {hiddenDiffLineCount(section, line.hunkId)}{" "}
                                lines hidden
                              </small>
                            )}
                          </button>
                        ) : (
                          <code>{line.text}</code>
                        )}
                        {(line.oldLine !== null || line.newLine !== null) && (
                          <span className="visually-hidden">
                            {lineNumberLabel(line.oldLine, line.newLine)}
                          </span>
                        )}
                        {matches.has(line.id) && (
                          <span className="visually-hidden">Search match</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
          <footer>
            <span>
              {observation.patchLines} lines · {observation.patchBytes} bytes
            </span>
            <time dateTime={observation.observedAt}>
              Observed {new Date(observation.observedAt).toLocaleTimeString()}
            </time>
          </footer>
        </>
      ) : (
        <DiffMessage
          tone={observation?.status === "error" ? "error" : "neutral"}
        >
          {diffStateMessage(observation, loading)}
        </DiffMessage>
      )}
    </section>
  );
}

function DiffMessage({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "error";
}) {
  return (
    <p
      className={`repository-diff-message is-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function selectedPath(
  state: RepositoryDiffViewState,
  observation: ReturnType<typeof visibleRepositoryDiff>,
): string {
  return (
    observation?.path ??
    (state.status === "idle" ? "Selected file" : state.path)
  );
}

function diffSummary(
  observation: ReturnType<typeof visibleRepositoryDiff>,
): string {
  switch (observation?.status) {
    case "ready":
      return `${observation.patchLines} patch lines`;
    case "empty":
      return "No textual patch";
    case "binary":
      return "Binary file";
    case "too_large":
      return "Patch exceeds safe limits";
    case "not_found":
      return "File is no longer changed";
    case "not_repository":
      return "No repository";
    case "error":
      return "Git diff unavailable";
    case undefined:
      return "Waiting for diff evidence";
  }
}

function diffStateMessage(
  observation: ReturnType<typeof visibleRepositoryDiff>,
  loading: boolean,
): string {
  if (observation === null) {
    return loading
      ? "Pacium is reading one bounded Git patch. The terminal remains available."
      : "Refresh to read this file’s current Git patch.";
  }
  switch (observation.status) {
    case "empty":
      return "Git reports no textual patch for this changed file. Refresh Changes to confirm its current status.";
    case "binary":
      return "Git identifies this as binary content. Pacium does not transport binary patch data.";
    case "too_large":
      return "This patch exceeds Pacium’s safe display limits. Use Git directly for the complete diff.";
    case "not_found":
      return "This path is no longer in the changed-file evidence. Go back and refresh Changes.";
    case "not_repository":
      return "This terminal is no longer associated with a Git repository.";
    case "error":
      return `${
        observation.error?.message ?? "Git diff evidence is unavailable."
      } The terminal is still running.`;
    case "ready":
      return "";
  }
}

function sectionSourceLabel(
  source: "combined" | "staged" | "unstaged" | "untracked",
): string {
  switch (source) {
    case "combined":
      return "Current change";
    case "staged":
      return "Staged";
    case "unstaged":
      return "Unstaged";
    case "untracked":
      return "Untracked";
  }
}

function lineNumberLabel(
  oldLine: number | null,
  newLine: number | null,
): string {
  if (oldLine !== null && newLine !== null) {
    return `Old line ${oldLine}, new line ${newLine}`;
  }
  return oldLine !== null ? `Old line ${oldLine}` : `New line ${newLine}`;
}
