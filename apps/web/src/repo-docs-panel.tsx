import { useEffect, useState } from "react";

import { MarkdownLite } from "./markdown-lite.js";
import {
  docNeedsAttention,
  fetchRepoDocs,
  summarizeDocFreshness,
  type RepoDoc,
  type RepoDocKind,
  type RepoDocsRequest,
} from "./repo-docs-model.js";

export type RepoDocsPanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; docs: RepoDoc[] };

export async function loadRepoDocsPanelState(
  fetchDocs: typeof fetchRepoDocs,
  request: RepoDocsRequest,
): Promise<RepoDocsPanelState> {
  try {
    const response = await fetchDocs(request);
    return { kind: "ready", docs: response.docs };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error && error.message !== ""
          ? error.message
          : "Repository files could not be read.",
    };
  }
}

export function docTabLabel(doc: RepoDoc, docs: RepoDoc[]): string {
  const sameKind = docs.filter((entry) => entry.kind === doc.kind).length;
  if (doc.kind === "backlog" && sameKind <= 1) {
    return "Backlog";
  }
  if (doc.kind === "queue" && sameKind <= 1) {
    return "Queue";
  }
  const cleaned = cleanDocName(doc.fileName);
  return cleaned === "" ? defaultKindLabel(doc.kind) : cleaned;
}

export function autoSelectDocPath(docs: RepoDoc[]): string | null {
  const selected =
    docs.find((doc) => docNeedsAttention(doc)) ??
    docs.find((doc) => doc.kind === "backlog") ??
    docs[0];
  return selected?.path ?? null;
}

export function docStatusNotice(doc: RepoDoc): string | null {
  switch (doc.status) {
    case "stable":
      return null;
    case "empty":
      return "This file is empty.";
    case "changing":
      return "File changed while reading — refresh";
    case "oversized":
      return `Too large to display (${(doc.byteLength / 1024).toFixed(1)} KB)`;
    case "invalid_utf8":
      return "Not valid UTF-8 text — open it in a terminal instead";
    case "unsafe_type":
      return "Not a regular text file, so Pacium does not render it";
    case "read_error":
      return "Could not read this file — check permissions, then refresh";
  }
}

export function repoDocsEmptyMessage(root: string): string {
  const basename = root.replace(/\/+$/, "").split("/").pop();
  const where = basename === undefined || basename === "" ? root : basename;
  return `No agent files here yet. Pacium looks for BACKLOG.md, NEEDS-<NAME>.md and <NAME>-QUEUE.md in ${where}.`;
}

export function RepoDocsPanel({
  root,
  repositoryName,
  accessToken,
  fetchDocs = fetchRepoDocs,
}: {
  root: string;
  repositoryName: string;
  accessToken: string | null;
  fetchDocs?: typeof fetchRepoDocs;
}) {
  const [state, setState] = useState<RepoDocsPanelState>({ kind: "loading" });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void loadRepoDocsPanelState(fetchDocs, { root, accessToken }).then(
      (next) => {
        if (cancelled) {
          return;
        }
        setState(next);
        if (next.kind === "ready") {
          setSelectedPath((previous) =>
            previous !== null && next.docs.some((doc) => doc.path === previous)
              ? previous
              : autoSelectDocPath(next.docs),
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [root, accessToken, fetchDocs, revision]);

  return (
    <RepoDocsPanelView
      onRefresh={() => setRevision((value) => value + 1)}
      onSelect={setSelectedPath}
      repositoryName={repositoryName}
      root={root}
      selectedPath={selectedPath}
      state={state}
    />
  );
}

export function RepoDocsPanelView({
  nowIso,
  onRefresh,
  onSelect,
  repositoryName,
  root,
  selectedPath,
  state,
}: {
  nowIso?: string;
  onRefresh: () => void;
  onSelect: (path: string) => void;
  repositoryName: string;
  root: string;
  selectedPath: string | null;
  state: RepoDocsPanelState;
}) {
  const docs = state.kind === "ready" ? state.docs : [];
  const selected =
    docs.find((doc) => doc.path === selectedPath) ?? docs[0] ?? null;
  return (
    <section aria-label="Repository files" className="repo-docs-panel">
      <header className="repo-docs-header">
        <span className="repo-docs-repo">{repositoryName}</span>
        {docs.length > 0 ? (
          <div className="repo-docs-tabs">
            {docs.map((doc) => {
              const attention = docNeedsAttention(doc);
              const label = docTabLabel(doc, docs);
              const isSelected =
                selected !== null && doc.path === selected.path;
              return (
                <button
                  aria-label={attention ? `${label}, needs attention` : label}
                  aria-pressed={isSelected}
                  className={`repo-docs-tab${isSelected ? " is-selected" : ""}`}
                  key={doc.path}
                  onClick={() => onSelect(doc.path)}
                  type="button"
                >
                  <span className="repo-docs-tab-label">{label}</span>
                  {attention ? (
                    <span aria-hidden="true" className="repo-docs-attention" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          aria-label="Refresh files"
          className="repo-docs-refresh"
          onClick={onRefresh}
          type="button"
        >
          <span aria-hidden="true">↻</span>
        </button>
      </header>
      {state.kind === "loading" ? (
        <p className="repo-docs-loading">Reading files…</p>
      ) : state.kind === "error" ? (
        <div className="repo-docs-error">
          <p>{state.message}</p>
          <button onClick={onRefresh} type="button">
            Retry
          </button>
        </div>
      ) : docs.length === 0 || selected === null ? (
        <div className="repo-docs-empty">
          <p>{repoDocsEmptyMessage(root)}</p>
        </div>
      ) : (
        <>
          <div className="repo-docs-body">
            {selected.status === "stable" && selected.content !== null ? (
              <MarkdownLite text={selected.content} />
            ) : (
              <p className="repo-docs-notice">{docStatusNotice(selected)}</p>
            )}
          </div>
          <footer className="repo-docs-footer">
            <span className="repo-docs-freshness">
              {summarizeDocFreshness(
                selected,
                nowIso ?? new Date().toISOString(),
              )}
            </span>
            {selected.status !== "stable" ? (
              <span className="repo-docs-footer-notice">
                {docStatusNotice(selected)}
              </span>
            ) : null}
          </footer>
        </>
      )}
    </section>
  );
}

function cleanDocName(fileName: string): string {
  return fileName
    .replace(/\.(md|markdown)$/i, "")
    .split(/[-_.\s]+/)
    .filter((word) => word !== "")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function defaultKindLabel(kind: RepoDocKind): string {
  switch (kind) {
    case "backlog":
      return "Backlog";
    case "needs":
      return "Needs";
    case "queue":
      return "Queue";
  }
}
