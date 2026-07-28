import type {
  DiagnosticsComponent,
  DiagnosticsSnapshot,
} from "@pacium/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  acceptDiagnosticsSnapshot,
  beginDiagnosticsRequest,
  canDownloadDiagnostics,
  diagnosticsFilename,
  diagnosticsJson,
  initialDiagnosticsState,
  previewDiagnostics,
  rejectDiagnosticsRequest,
  type DiagnosticsViewState,
} from "./diagnostics-model.js";
import { handleModalKeyDown } from "./modal-focus.js";
import type { ConnectionState } from "./transport.js";

interface DiagnosticsDialogProps {
  connection: ConnectionState;
  load: () => Promise<DiagnosticsSnapshot>;
  onClose: () => void;
  initialState?: DiagnosticsViewState;
}

export function DiagnosticsDialog({
  connection,
  load,
  onClose,
  initialState,
}: DiagnosticsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const generationRef = useRef(initialState?.requestGeneration ?? 0);
  const mountedRef = useRef(true);
  const [state, setState] = useState(initialState ?? initialDiagnosticsState());
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const request = useCallback(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setDownloadError(null);
    setState((current) => ({
      ...beginDiagnosticsRequest(current),
      requestGeneration: generation,
    }));
    void load().then(
      (snapshot) => {
        if (mountedRef.current) {
          setState((current) =>
            acceptDiagnosticsSnapshot(current, generation, snapshot),
          );
        }
      },
      (error: unknown) => {
        if (mountedRef.current) {
          setState((current) =>
            rejectDiagnosticsRequest(
              current,
              generation,
              error instanceof Error
                ? error.message
                : "Pacium diagnostics could not be loaded.",
            ),
          );
        }
      },
    );
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    if (initialState === undefined) {
      request();
    }
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, [initialState, request]);

  const previewed = canDownloadDiagnostics(state);
  const download = () => {
    if (!previewed || state.snapshot === null) {
      return;
    }
    try {
      const anchor = document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([diagnosticsJson(state.snapshot)], {
          type: "application/json;charset=utf-8",
        }),
      );
      anchor.href = url;
      anchor.download = diagnosticsFilename(state.snapshot.generatedAt);
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadError(null);
    } catch {
      setDownloadError(
        "The browser could not write the diagnostics file. No file was saved.",
      );
    }
  };

  return (
    <div className="diagnostics-backdrop">
      <section
        aria-labelledby="diagnostics-title"
        aria-modal="true"
        className="diagnostics-dialog"
        onKeyDown={(event) =>
          handleModalKeyDown(event, dialogRef.current, onClose)
        }
        ref={dialogRef}
        role="dialog"
      >
        <header className="diagnostics-header">
          <div>
            <span className="eyebrow">Local support view</span>
            <h2 id="diagnostics-title">Diagnostics</h2>
            <p>
              Bounded application health without terminal, queue, Git, or
              provider content.
            </p>
          </div>
          <div className="diagnostics-header-actions">
            <button
              disabled={state.phase === "loading"}
              onClick={request}
              type="button"
            >
              {state.phase === "loading"
                ? "Refreshing…"
                : state.phase === "error"
                  ? "Retry"
                  : "Refresh"}
            </button>
            <button
              aria-label="Close diagnostics"
              autoFocus
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <div className="diagnostics-scroll">
          {connection !== "connected" && (
            <DiagnosticsNotice tone="warning">
              The browser is {connection}. This diagnostics read cannot stop
              server-owned terminal processes. Reconnect, then retry.
            </DiagnosticsNotice>
          )}
          {state.phase === "loading" && state.snapshot === null && (
            <DiagnosticsNotice>Loading bounded diagnostics…</DiagnosticsNotice>
          )}
          {state.error !== null && (
            <DiagnosticsNotice tone="error">
              {state.snapshot === null
                ? state.error
                : `Refresh failed; the snapshot below is stale. ${state.error}`}{" "}
              This read did not send input or stop any terminal.
            </DiagnosticsNotice>
          )}

          {state.snapshot !== null && (
            <DiagnosticsSnapshotView snapshot={state.snapshot} />
          )}

          {state.snapshot === null &&
            state.phase !== "loading" &&
            state.error === null && (
              <DiagnosticsNotice>
                No diagnostics have been requested. Running terminals are
                unchanged.
              </DiagnosticsNotice>
            )}

          {state.snapshot !== null && (
            <section
              aria-labelledby="diagnostics-export-title"
              className="diagnostics-section diagnostics-export"
            >
              <div className="diagnostics-section-heading">
                <div>
                  <span className="eyebrow">Explicit local export</span>
                  <h3 id="diagnostics-export-title">Support JSON</h3>
                </div>
                <div className="diagnostics-export-actions">
                  <button
                    onClick={() =>
                      setState((current) => previewDiagnostics(current))
                    }
                    type="button"
                  >
                    Preview export
                  </button>
                  <button
                    disabled={!previewed}
                    onClick={download}
                    type="button"
                  >
                    Download JSON
                  </button>
                </div>
              </div>
              <p>
                Download unlocks only after the exact JSON is visible. The
                browser creates the file; Pacium does not persist or upload it.
              </p>
              {downloadError !== null && (
                <DiagnosticsNotice tone="error">
                  {downloadError}
                </DiagnosticsNotice>
              )}
              {previewed && (
                <pre
                  aria-label="Exact diagnostics JSON"
                  className="diagnostics-json-preview"
                  tabIndex={0}
                >
                  {diagnosticsJson(state.snapshot)}
                </pre>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

export function DiagnosticsSnapshotView({
  snapshot,
}: {
  snapshot: DiagnosticsSnapshot;
}) {
  const sessions = snapshot.overview.sessions;
  return (
    <>
      <section
        aria-labelledby="diagnostics-overview-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <div>
            <span className="eyebrow">Snapshot</span>
            <h3 id="diagnostics-overview-title">Current health</h3>
          </div>
          <HealthBadge state={snapshot.overview.state} />
        </div>
        <dl className="diagnostics-facts">
          <Fact label="Pacium" value={snapshot.application.paciumVersion} />
          <Fact
            label="Protocol"
            value={String(snapshot.application.protocolVersion)}
          />
          <Fact label="Node" value={snapshot.application.nodeVersion} />
          <Fact
            label="Runtime"
            value={`${snapshot.application.platform} · ${snapshot.application.architecture}`}
          />
          <Fact label="Sessions" value={String(sessions.total)} />
          <Fact
            label="Session runtimes"
            value={`${sessions.directPty} PTY · ${sessions.tmux} tmux`}
          />
          <Fact
            label="Queue"
            value={`${snapshot.overview.queueStatus} · ${snapshot.overview.queueSources} sources`}
          />
          <Fact
            label="Queue items"
            value={`${Object.values(snapshot.overview.queueItems).reduce(
              (total, count) => total + count,
              0,
            )} · ${snapshot.overview.queueConflicts} conflicts`}
          />
          <Fact
            label="tmux"
            value={
              snapshot.overview.tmuxVersion ?? snapshot.overview.tmuxStatus
            }
          />
          <Fact
            label="Generated"
            value={new Date(snapshot.generatedAt).toLocaleString()}
          />
        </dl>
        {sessions.total === 0 && (
          <p className="diagnostics-empty">
            No terminal sessions are currently reported. This is a valid empty
            workspace, not a failure.
          </p>
        )}
      </section>

      <section
        aria-labelledby="diagnostics-versions-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <h3 id="diagnostics-versions-title">Runtime versions</h3>
        </div>
        <dl className="diagnostics-facts">
          <Fact
            label="node-pty"
            value={snapshot.application.dependencyVersions.nodePty}
          />
          <Fact
            label="xterm headless"
            value={snapshot.application.dependencyVersions.xtermHeadless}
          />
          <Fact
            label="xterm browser"
            value={snapshot.application.dependencyVersions.xtermBrowser}
          />
          <Fact
            label="React"
            value={snapshot.application.dependencyVersions.react}
          />
          <Fact label="ws" value={snapshot.application.dependencyVersions.ws} />
          <Fact
            label="Zod"
            value={snapshot.application.dependencyVersions.zod}
          />
        </dl>
      </section>

      <section
        aria-labelledby="diagnostics-components-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <h3 id="diagnostics-components-title">Components</h3>
        </div>
        <div className="diagnostics-components">
          {snapshot.components.map((component) => (
            <ComponentCard component={component} key={component.id} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="diagnostics-codes-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <h3 id="diagnostics-codes-title">Fixed diagnostic codes</h3>
          <span>
            {snapshot.diagnostics.length}
            {snapshot.diagnosticsTruncated ? "+" : ""}
          </span>
        </div>
        {snapshot.diagnostics.length === 0 ? (
          <p className="diagnostics-empty">
            No fixed diagnostic codes are present in this snapshot.
          </p>
        ) : (
          <div className="diagnostics-table-wrap">
            <table className="diagnostics-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Code</th>
                  <th>Severity</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.diagnostics.map((diagnostic) => (
                  <tr key={`${diagnostic.component}:${diagnostic.code}`}>
                    <td>{humanize(diagnostic.component)}</td>
                    <th>{diagnostic.code}</th>
                    <td>{diagnostic.severity}</td>
                    <td>{diagnostic.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="diagnostics-sessions-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <h3 id="diagnostics-sessions-title">Sanitized sessions</h3>
          <span>
            {snapshot.sessions.length}
            {snapshot.sessionsTruncated ? "+" : ""}
          </span>
        </div>
        {snapshot.sessions.length === 0 ? (
          <p className="diagnostics-empty">No sanitized session rows.</p>
        ) : (
          <div className="diagnostics-table-wrap">
            <table className="diagnostics-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Preset</th>
                  <th>Runtime</th>
                  <th>Process</th>
                  <th>Size</th>
                  <th>Provider</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sessions.map((session) => (
                  <tr key={session.label}>
                    <th>{session.label}</th>
                    <td>{session.launchPreset}</td>
                    <td>
                      {session.runtime}
                      {session.tmuxMode === null
                        ? ""
                        : ` · ${session.tmuxMode}`}
                    </td>
                    <td>{session.processState}</td>
                    <td>
                      {session.cols}×{session.rows}
                    </td>
                    <td>
                      {session.provider === null
                        ? "Not observed"
                        : `${session.provider.id} · ${session.provider.health}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="diagnostics-redaction-title"
        className="diagnostics-section"
      >
        <div className="diagnostics-section-heading">
          <h3 id="diagnostics-redaction-title">Redaction boundary</h3>
        </div>
        <div className="diagnostics-manifest">
          <ManifestList
            label="Included metadata"
            values={snapshot.redactionManifest.included}
          />
          <ManifestList
            label="Always omitted"
            values={snapshot.redactionManifest.omitted}
          />
        </div>
      </section>
    </>
  );
}

function ComponentCard({ component }: { component: DiagnosticsComponent }) {
  return (
    <article className="diagnostics-component">
      <div>
        <strong>{humanize(component.id)}</strong>
        <HealthBadge state={component.state} />
      </div>
      <p>{component.summary}</p>
      {component.operatorAction !== null && (
        <small>{component.operatorAction}</small>
      )}
    </article>
  );
}

function ManifestList({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  return (
    <div>
      <strong>{label}</strong>
      <ul>
        {values.map((value) => (
          <li key={value}>{humanize(value)}</li>
        ))}
      </ul>
    </div>
  );
}

function HealthBadge({ state }: { state: string }) {
  return (
    <span className={`diagnostics-health is-${state}`}>
      <span aria-hidden="true">●</span>
      {humanize(state)}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DiagnosticsNotice({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "error";
}) {
  return (
    <p className={`diagnostics-notice is-${tone}`} role="status">
      {children}
    </p>
  );
}

function humanize(value: string): string {
  const normalized = value.replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
