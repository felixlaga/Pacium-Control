import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  MAX_DIRECTORY_PATH_CHARS,
  type DirectoryListing,
} from "@pacium/contracts";

import {
  addRecentDirectory,
  directoryBreadcrumbs,
  loadRecentDirectories,
  resolveDirectoryPickerKeyAction,
  saveRecentDirectories,
  type DirectoryPickerKeyAction,
} from "./directory-picker-model.js";
import { handleModalKeyDown } from "./modal-focus.js";

const RECENT_DIRECTORIES_STORAGE_KEY = "pacium.recentDirectories";

export function DirectoryPicker({
  initialPath,
  loadDirectories,
  onCancel,
  onSelect,
}: {
  initialPath: string;
  loadDirectories: (path?: string) => Promise<DirectoryListing>;
  onCancel: () => void;
  onSelect: (path: string) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const requestSequenceRef = useRef(0);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [requestedPath, setRequestedPath] = useState(initialPath);
  const [pathDraft, setPathDraft] = useState(initialPath);
  const [pathEditing, setPathEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentPaths, setRecentPaths] = useState(loadBrowserRecentDirectories);

  const navigate = useCallback(
    async (path?: string) => {
      const sequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = sequence;
      setLoading(true);
      setError(null);
      if (path !== undefined) {
        setRequestedPath(path);
      }
      try {
        const next = await loadDirectories(path);
        if (requestSequenceRef.current !== sequence) {
          return;
        }
        setListing(next);
        setRequestedPath(next.currentPath);
        setQuery("");
      } catch (caught) {
        if (requestSequenceRef.current !== sequence) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Pacium could not browse that host directory.",
        );
      } finally {
        if (requestSequenceRef.current === sequence) {
          setLoading(false);
        }
      }
    },
    [loadDirectories],
  );

  useEffect(() => {
    void navigate(initialPath);
  }, [initialPath, navigate]);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (
      listing?.entries.filter(
        (entry) =>
          (showHidden || !entry.hidden) &&
          (normalizedQuery.length === 0 ||
            entry.name.toLocaleLowerCase().includes(normalizedQuery)),
      ) ?? []
    );
  }, [listing, query, showHidden]);

  const chooseCurrent = () => {
    if (listing === null) {
      return;
    }
    const nextRecent = addRecentDirectory(recentPaths, listing.currentPath);
    setRecentPaths(nextRecent);
    saveBrowserRecentDirectories(nextRecent);
    onSelect(listing.currentPath);
  };

  const openPathEditor = () => {
    setPathDraft(listing?.currentPath ?? requestedPath);
    setPathEditing(true);
    window.requestAnimationFrame(() => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    });
  };

  const closePathEditor = () => {
    setPathEditing(false);
    window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>(".directory-edit-path")
        ?.focus();
    });
  };

  const applyKeyAction = (
    action: DirectoryPickerKeyAction,
    event: ReactKeyboardEvent<HTMLElement>,
  ): boolean => {
    if (action === null) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action.kind === "edit-path") {
      openPathEditor();
    } else if (action.kind === "confirm-current") {
      if (!loading && error === null) {
        chooseCurrent();
      }
    } else if (action.kind === "focus-filter") {
      filterInputRef.current?.focus();
    } else {
      resultRefs.current[action.index]?.focus();
    }
    return true;
  };

  return (
    <div className="dialog-backdrop directory-picker-backdrop">
      <section
        aria-labelledby="directory-picker-title"
        aria-modal="true"
        className="directory-picker-card"
        onKeyDown={(event) => {
          const handled = applyKeyAction(
            resolveDirectoryPickerKeyAction({
              ctrlKey: event.ctrlKey,
              key: event.key,
              metaKey: event.metaKey,
              resultCount: visibleEntries.length,
              source: "dialog",
            }),
            event,
          );
          if (!handled) {
            handleModalKeyDown(event, dialogRef.current, onCancel);
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <header className="directory-picker-header">
          <div>
            <span className="eyebrow">Pacium host</span>
            <h2 id="directory-picker-title">Choose a working directory</h2>
            <p>Browse folders on the machine that runs your agents.</p>
          </div>
          <button
            aria-label="Back to new terminal"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="directory-picker-body">
          <aside className="directory-locations" aria-label="Locations">
            <span className="directory-section-label">Locations</span>
            <button
              className={
                listing?.currentPath === listing?.defaultPath ? "is-active" : ""
              }
              onClick={() => void navigate()}
              title="Open the server-owned default directory"
              type="button"
            >
              <span aria-hidden="true">⌁</span>
              Pacium default
            </button>
            {listing !== null && (
              <button
                className={
                  listing.currentPath === listing.homePath ? "is-active" : ""
                }
                onClick={() => void navigate(listing.homePath)}
                type="button"
              >
                <span aria-hidden="true">⌂</span>
                Home
              </button>
            )}

            {recentPaths.length > 0 && (
              <>
                <span className="directory-section-label recent-label">
                  Recent
                </span>
                {recentPaths.map((path) => (
                  <button
                    className={listing?.currentPath === path ? "is-active" : ""}
                    key={path}
                    onClick={() => void navigate(path)}
                    title={path}
                    type="button"
                  >
                    <span aria-hidden="true">↗</span>
                    <span>{compactHostPath(path)}</span>
                  </button>
                ))}
              </>
            )}
          </aside>

          <main className="directory-browser">
            <div className="directory-toolbar">
              {pathEditing ? (
                <form
                  className="directory-path-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const nextPath = pathDraft.trim();
                    setPathEditing(false);
                    void navigate(nextPath);
                  }}
                >
                  <label
                    className="visually-hidden"
                    htmlFor="directory-host-path"
                  >
                    Absolute path on the Pacium host
                  </label>
                  <input
                    id="directory-host-path"
                    maxLength={MAX_DIRECTORY_PATH_CHARS}
                    onChange={(event) => setPathDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        closePathEditor();
                      }
                    }}
                    ref={pathInputRef}
                    spellCheck={false}
                    value={pathDraft}
                  />
                  <button
                    disabled={pathDraft.trim().length === 0 || loading}
                    type="submit"
                  >
                    Go
                  </button>
                  <button
                    aria-label="Cancel path editing"
                    onClick={closePathEditor}
                    type="button"
                  >
                    ×
                  </button>
                </form>
              ) : (
                <>
                  <button
                    aria-label="Go to parent directory"
                    disabled={listing?.parentPath == null || loading}
                    onClick={() => {
                      if (listing?.parentPath !== null && listing !== null) {
                        void navigate(listing.parentPath);
                      }
                    }}
                    title="Parent directory"
                    type="button"
                  >
                    ↑
                  </button>
                  <nav aria-label="Current directory" className="breadcrumbs">
                    {(listing === null
                      ? [
                          {
                            label: compactHostPath(requestedPath),
                            path: requestedPath,
                          },
                        ]
                      : directoryBreadcrumbs(listing.currentPath)
                    ).map((breadcrumb, index, breadcrumbs) => (
                      <span key={breadcrumb.path}>
                        <button
                          aria-current={
                            index === breadcrumbs.length - 1
                              ? "location"
                              : undefined
                          }
                          disabled={loading}
                          onClick={() => void navigate(breadcrumb.path)}
                          title={breadcrumb.path}
                          type="button"
                        >
                          {breadcrumb.label}
                        </button>
                        {index < breadcrumbs.length - 1 && (
                          <span aria-hidden="true">/</span>
                        )}
                      </span>
                    ))}
                  </nav>
                  <button
                    aria-keyshortcuts="Meta+L Control+L"
                    aria-label="Edit absolute host path"
                    className="directory-edit-path"
                    onClick={openPathEditor}
                    title="Edit host path (Cmd/Ctrl+L)"
                    type="button"
                  >
                    <span aria-hidden="true">⌘ L</span>
                  </button>
                </>
              )}
            </div>

            <div className="directory-filter-row">
              <label className="directory-search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Filter directories"
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    applyKeyAction(
                      resolveDirectoryPickerKeyAction({
                        ctrlKey: event.ctrlKey,
                        key: event.key,
                        metaKey: event.metaKey,
                        resultCount: visibleEntries.length,
                        source: "filter",
                      }),
                      event,
                    );
                  }}
                  placeholder="Filter folders"
                  ref={filterInputRef}
                  type="search"
                  value={query}
                />
              </label>
              <label className="hidden-directory-toggle">
                <input
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                  type="checkbox"
                />
                Hidden
              </label>
            </div>

            <div
              aria-busy={loading}
              aria-live="polite"
              className="directory-results"
            >
              {loading && (
                <div className="directory-state">
                  <span className="directory-spinner" aria-hidden="true" />
                  <strong>Reading host folders…</strong>
                  <p>Your running terminals are unaffected.</p>
                </div>
              )}
              {!loading && error !== null && (
                <div className="directory-state directory-error">
                  <span aria-hidden="true">!</span>
                  <strong>Folder unavailable</strong>
                  <p>{error}</p>
                  <p>
                    Running terminals and the new-terminal form are unchanged.
                  </p>
                  <button
                    onClick={() => void navigate(requestedPath)}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              )}
              {!loading && error === null && visibleEntries.length === 0 && (
                <div className="directory-state">
                  <span aria-hidden="true">◇</span>
                  <strong>No matching folders</strong>
                  <p>
                    {query.length > 0
                      ? "Clear the filter or show hidden folders."
                      : "This directory has no visible child folders."}
                  </p>
                </div>
              )}
              {!loading &&
                error === null &&
                visibleEntries.map((entry, index) => (
                  <button
                    aria-label={`Open ${entry.name}${entry.repository ? ", Git repository" : ", folder"}`}
                    className="directory-row"
                    key={entry.path}
                    onClick={() => void navigate(entry.path)}
                    onKeyDown={(event) => {
                      applyKeyAction(
                        resolveDirectoryPickerKeyAction({
                          ctrlKey: event.ctrlKey,
                          key: event.key,
                          metaKey: event.metaKey,
                          resultCount: visibleEntries.length,
                          resultIndex: index,
                          source: "result",
                        }),
                        event,
                      );
                    }}
                    ref={(node) => {
                      resultRefs.current[index] = node;
                    }}
                    title={entry.path}
                    type="button"
                  >
                    <span
                      className={`directory-icon ${
                        entry.repository ? "is-repository" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {entry.repository ? "⌘" : "▱"}
                    </span>
                    <span className="directory-row-copy">
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.repository ? "Git repository" : "Folder"}
                      </small>
                    </span>
                    {entry.hidden && (
                      <span className="directory-hidden-label">Hidden</span>
                    )}
                    <span className="directory-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
            </div>

            {listing?.truncated === true && (
              <p className="directory-truncated">
                This folder has more entries than Pacium displays. Filter by
                name or navigate to a narrower location.
              </p>
            )}
          </main>
        </div>

        <footer className="directory-picker-footer">
          <div>
            <span>Selected host path</span>
            <code>{listing?.currentPath ?? requestedPath}</code>
          </div>
          <div>
            <button onClick={onCancel} type="button">
              Back
            </button>
            <button
              aria-keyshortcuts="Meta+Enter Control+Enter"
              className="primary-button"
              disabled={listing === null || loading || error !== null}
              onClick={chooseCurrent}
              type="button"
            >
              Use current folder
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function compactHostPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

function loadBrowserRecentDirectories(): string[] {
  try {
    return loadRecentDirectories(
      window.localStorage,
      RECENT_DIRECTORIES_STORAGE_KEY,
    );
  } catch {
    return [];
  }
}

function saveBrowserRecentDirectories(paths: string[]): void {
  try {
    saveRecentDirectories(
      window.localStorage,
      RECENT_DIRECTORIES_STORAGE_KEY,
      paths,
    );
  } catch {
    // Browser-local recents are best-effort and never block selection.
  }
}
