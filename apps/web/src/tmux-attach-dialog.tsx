import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  TmuxCapability,
  TmuxSessionsObservation,
  TmuxTarget,
} from "@pacium/contracts";

import { handleModalKeyDown } from "./modal-focus.js";

export interface TmuxAttachDialogProps {
  attaching: boolean;
  capability: TmuxCapability;
  connected: boolean;
  error: string | null;
  loading: boolean;
  observation: TmuxSessionsObservation | null;
  onAttach: (target: TmuxTarget) => void;
  onCancel: () => void;
  onRefresh: () => void;
}

export function TmuxAttachDialog({
  attaching,
  capability,
  connected,
  error,
  loading,
  observation,
  onAttach,
  onCancel,
  onRefresh,
}: TmuxAttachDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sessions = observation?.sessions ?? [];
  // The server adopts a late-started tmux socket during discovery, so a ready
  // observation is fresher truth than the boot-time capability snapshot.
  const effectiveState =
    observation?.status === "ready" || observation?.status === "empty"
      ? "ready"
      : capability.state;
  const effectiveDetail =
    effectiveState === "ready" && capability.state !== "ready"
      ? "A running tmux server was discovered on this host."
      : capability.detail;
  const selected =
    sessions.find(({ target }) => target.sessionId === selectedId)?.target ??
    null;

  useEffect(() => {
    if (
      selectedId !== null &&
      !sessions.some(({ target }) => target.sessionId === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [selectedId, sessions]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected !== null && !attaching && connected) {
      onAttach(selected);
    }
  };

  return (
    <div
      aria-labelledby="tmux-attach-title"
      aria-modal="true"
      className="dialog-backdrop"
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
      role="dialog"
    >
      <form className="dialog-card tmux-attach-card" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Optional runtime</span>
            <h2 id="tmux-attach-title">Attach a tmux session</h2>
          </div>
          <button aria-label="Cancel" onClick={onCancel} type="button">
            ×
          </button>
        </div>

        <p className="dialog-note">
          Pacium opens a client for the configured local tmux server. Closing
          the view or client does not kill the tmux server session.
        </p>

        <div className="tmux-capability-row">
          <span className={`status-dot is-${effectiveState}`} />
          <div>
            <strong>
              {effectiveState === "ready"
                ? (capability.version ?? "tmux ready")
                : effectiveState === "unavailable"
                  ? "tmux unavailable"
                  : "tmux not configured"}
            </strong>
            <small>{effectiveDetail}</small>
          </div>
          <button
            disabled={!connected || loading || attaching}
            onClick={onRefresh}
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <fieldset className="tmux-session-list">
          <legend>Available sessions</legend>
          {loading && sessions.length === 0 ? (
            <p className="tmux-empty-state">
              Inspecting the configured socket…
            </p>
          ) : error !== null ? (
            <p className="tmux-error-state" role="alert">
              {error} Direct terminals remain available.
            </p>
          ) : observation?.status === "empty" ? (
            <p className="tmux-empty-state">
              No sessions are currently published by this tmux server.
            </p>
          ) : observation !== null &&
            observation.status !== "ready" &&
            observation.error !== null ? (
            <p className="tmux-error-state" role="alert">
              {observation.error.message} Direct terminals remain available.
            </p>
          ) : sessions.length > 0 ? (
            sessions.map((session) => (
              <label
                className={`tmux-session-option ${
                  selectedId === session.target.sessionId ? "is-selected" : ""
                }`}
                key={session.target.sessionId}
              >
                <input
                  checked={selectedId === session.target.sessionId}
                  disabled={!connected || attaching}
                  name="tmux-session"
                  onChange={() => setSelectedId(session.target.sessionId)}
                  type="radio"
                  value={session.target.sessionId}
                />
                <span>
                  <strong>{session.target.sessionName}</strong>
                  <small>
                    {session.target.sessionId} · {session.windows}{" "}
                    {session.windows === 1 ? "window" : "windows"} ·{" "}
                    {session.attachedClients} attached
                  </small>
                  <small>
                    {session.currentPath ?? "Current path unavailable"}
                  </small>
                </span>
              </label>
            ))
          ) : (
            <p className="tmux-empty-state">
              Refresh to inspect the configured tmux server.
            </p>
          )}
        </fieldset>

        <p className="field-helper">
          List observed{" "}
          {observation === null
            ? "not yet"
            : new Date(observation.observedAt).toLocaleString()}
          . The target is revalidated immediately before attachment.
        </p>

        <div className="dialog-actions">
          <button disabled={attaching} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={selected === null || !connected || attaching}
            type="submit"
          >
            {attaching ? "Attaching…" : "Attach session"}
          </button>
        </div>
      </form>
    </div>
  );
}
