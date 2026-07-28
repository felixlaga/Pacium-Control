import type { RelaunchManifest, SessionSummary } from "@pacium/contracts";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import { handleModalKeyDown } from "./modal-focus.js";
import { sessionActionAvailability } from "./session-actions-model.js";

interface SessionActionsMenuProps {
  onClose: () => void;
  onCloseView: () => void;
  onCopyDirectory: () => void;
  onDuplicate: () => void;
  onInterrupt: () => void;
  onRelaunch: () => void;
  onRename: () => void;
  onRevealRepository: () => void;
  onTerminate: () => void;
  session: SessionSummary;
}

export function SessionActionsMenu({
  onClose,
  onCloseView,
  onCopyDirectory,
  onDuplicate,
  onInterrupt,
  onRelaunch,
  onRename,
  onRevealRepository,
  onTerminate,
  session,
}: SessionActionsMenuProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const availability = sessionActionAvailability(session);
  const live = session.processState === "live";

  useEffect(() => {
    firstActionRef.current?.focus();
  }, []);

  const stopPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="session-actions-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="session-actions-title"
        aria-modal="true"
        className="session-actions-menu"
        onKeyDown={(event) =>
          handleModalKeyDown(event, dialogRef.current, onClose)
        }
        onMouseDown={stopPropagation}
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">Session actions</span>
            <h2 id="session-actions-title">{session.displayName}</h2>
            <p>
              {session.commandLabel} · {session.processState}
            </p>
          </div>
          <button
            aria-label="Close session actions"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="session-action-group">
          <ActionButton
            ref={firstActionRef}
            detail="Change Pacium’s label only"
            disabled={!availability.canRename}
            icon="Aa"
            label="Rename session"
            onClick={onRename}
          />
          <ActionButton
            detail={
              session.runtime === "tmux"
                ? "Use explicit reattach for this external target"
                : "New PTY · same preset and folder"
            }
            disabled={!availability.canDuplicate}
            icon="⧉"
            label="Duplicate session"
            onClick={onDuplicate}
          />
          <ActionButton
            detail={
              availability.canRelaunch
                ? session.runtime === "tmux"
                  ? "New client for the retained tmux target"
                  : "New PTY from retained launch context"
                : "Available after this process ends"
            }
            disabled={!availability.canRelaunch}
            icon="↻"
            label={
              session.runtime === "tmux"
                ? "Reattach ended tmux client"
                : "Relaunch ended session"
            }
            onClick={onRelaunch}
          />
        </div>

        <div className="session-action-group">
          <ActionButton
            detail={session.cwd}
            disabled={!availability.canCopyDirectory}
            icon="⌘"
            label="Copy working directory"
            onClick={onCopyDirectory}
          />
          <ActionButton
            detail={
              availability.canRevealRepository
                ? "Opens on the Pacium host"
                : "No Git repository detected"
            }
            disabled={!availability.canRevealRepository}
            icon="↗"
            label="Reveal repository on host"
            onClick={onRevealRepository}
          />
          <ActionButton
            detail={
              session.runtime === "tmux"
                ? "Client and tmux server session keep running"
                : "PTY keeps running"
            }
            icon="—"
            label="Close browser view"
            onClick={onCloseView}
          />
        </div>

        <div className="session-action-group process-actions">
          <ActionButton
            detail={
              session.runtime === "tmux"
                ? "Send SIGINT · tmux server session may continue"
                : "Send SIGINT · process may continue"
            }
            disabled={!availability.canInterrupt}
            icon="^C"
            label="Interrupt process"
            onClick={onInterrupt}
          />
          <ActionButton
            danger
            detail={
              live
                ? session.runtime === "tmux"
                  ? "Disconnect this client only · tmux session may continue"
                  : "Confirm, send SIGTERM, then force if needed"
                : "Remove this ended session record"
            }
            disabled={!availability.canTerminate}
            icon="×"
            label={
              live
                ? session.runtime === "tmux"
                  ? "Disconnect tmux client and close"
                  : "Terminate process and close"
                : "Remove session"
            }
            onClick={onTerminate}
          />
        </div>
      </section>
    </div>
  );
}

interface ActionButtonProps {
  danger?: boolean;
  detail: string;
  disabled?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    { danger = false, detail, disabled = false, icon, label, onClick },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={danger ? "is-danger" : undefined}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <span aria-hidden="true" className="session-action-icon">
          {icon}
        </span>
        <span>
          <strong>{label}</strong>
          <small>{detail}</small>
        </span>
      </button>
    );
  },
);

interface RenameSessionDialogProps {
  onCancel: () => void;
  onRename: (displayName: string) => void;
  session: SessionSummary;
}

export function RenameSessionDialog({
  onCancel,
  onRename,
  session,
}: RenameSessionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState(session.displayName);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = displayName.trim();
    if (normalized.length > 0) {
      onRename(normalized);
    }
  };

  return (
    <div
      aria-labelledby="rename-session-title"
      aria-modal="true"
      className="dialog-backdrop"
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
      role="dialog"
    >
      <form className="dialog-card rename-session-card" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Session metadata</span>
            <h2 id="rename-session-title">Rename terminal</h2>
          </div>
          <button aria-label="Cancel rename" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <label htmlFor="rename-session-input">
          <span>Display name</span>
          <input
            autoFocus
            id="rename-session-input"
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <p className="dialog-note">
          This changes Pacium’s label. It does not rename the shell process,
          repository, or tmux session.
        </p>
        <div className="dialog-actions">
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={displayName.trim().length === 0}
            type="submit"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
}

interface RelaunchSessionDialogProps {
  connected: boolean;
  manifest: RelaunchManifest;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RelaunchSessionDialog({
  connected,
  manifest,
  onCancel,
  onConfirm,
}: RelaunchSessionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const provider =
    manifest.runtime === "tmux" ? "tmux" : (manifest.provider ?? "Shell");
  const command = [manifest.command.executable, ...manifest.command.args].join(
    " ",
  );
  return (
    <div
      aria-labelledby="relaunch-session-title"
      aria-modal="true"
      className="dialog-backdrop"
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
      role="dialog"
    >
      <div className="dialog-card relaunch-session-card">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Retained launch manifest</span>
            <h2 id="relaunch-session-title">Relaunch {manifest.displayName}</h2>
          </div>
          <button aria-label="Cancel relaunch" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <p className="dialog-note">
          {manifest.runtime === "tmux"
            ? "Pacium will revalidate the retained target and start a fresh tmux client with a new immutable Pacium session ID. The external tmux server session is not restarted or killed."
            : "Pacium will start a fresh PTY with a new immutable session ID. The previous process is not adopted or changed."}
        </p>
        <dl className="relaunch-manifest-facts">
          <div>
            <dt>Provider</dt>
            <dd>{provider}</dd>
          </div>
          <div>
            <dt>Command</dt>
            <dd>{command}</dd>
          </div>
          <div>
            <dt>Working directory</dt>
            <dd>{manifest.cwd}</dd>
          </div>
          <div>
            <dt>Repository at launch</dt>
            <dd>{manifest.repository?.root ?? "No repository recorded"}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>
              {manifest.environmentKeys.length === 0
                ? "No inherited keys recorded"
                : `${manifest.environmentKeys.join(", ")} · key names only`}
            </dd>
          </div>
          <div>
            <dt>Provider resume</dt>
            <dd>
              {manifest.runtime === "tmux"
                ? "Not applicable · the exact tmux target is revalidated"
                : manifest.resumeReference === null
                ? "No native resume identifier observed · provider state is not resumed automatically"
                : `${manifest.resumeReference.provider} identifier retained · not resumed automatically`}
            </dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            autoFocus
            className="primary-button"
            disabled={!connected}
            onClick={onConfirm}
            type="button"
          >
            {manifest.runtime === "tmux"
              ? "Reattach tmux client"
              : "Start fresh process"}
          </button>
        </div>
        {!connected && (
          <p className="dialog-note" role="status">
            Reconnect to the local Pacium server before relaunching. Existing
            terminals are unchanged.
          </p>
        )}
      </div>
    </div>
  );
}
