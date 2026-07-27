import type { SessionSummary } from "@pacium/contracts";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

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
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const availability = sessionActionAvailability(session);
  const live = session.processState === "live";

  useEffect(() => {
    firstActionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const stopPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="session-actions-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="session-actions-title"
        className="session-actions-menu"
        onMouseDown={stopPropagation}
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
            detail="New PTY · same preset and folder"
            disabled={!availability.canDuplicate}
            icon="⧉"
            label="Duplicate session"
            onClick={onDuplicate}
          />
          <ActionButton
            detail={
              availability.canRelaunch
                ? "New PTY from retained launch context"
                : "Available after this process ends"
            }
            disabled={!availability.canRelaunch}
            icon="↻"
            label="Relaunch ended session"
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
            detail="PTY keeps running"
            icon="—"
            label="Close browser view"
            onClick={onCloseView}
          />
        </div>

        <div className="session-action-group process-actions">
          <ActionButton
            detail="Send SIGINT · process may continue"
            disabled={!availability.canInterrupt}
            icon="^C"
            label="Interrupt process"
            onClick={onInterrupt}
          />
          <ActionButton
            danger
            detail={
              live
                ? "Confirm, send SIGTERM, then force if needed"
                : "Remove this ended session record"
            }
            disabled={!availability.canTerminate}
            icon="×"
            label={live ? "Terminate process and close" : "Remove session"}
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
