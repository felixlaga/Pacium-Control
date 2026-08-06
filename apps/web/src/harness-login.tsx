import { useState } from "react";

import { isValidHarnessTarget } from "./harness-model.js";
import { handleModalKeyDown } from "./modal-focus.js";

export function HarnessLoginButton({
  target,
  onTargetChange,
  onConnect,
  disabled,
}: {
  target: string;
  onTargetChange: (target: string) => void;
  onConnect: (target: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="harness-login">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="harness-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <KeyIcon />
        <span>Harness</span>
      </button>
      {open ? (
        <HarnessLoginPopover
          disabled={disabled}
          onClose={() => setOpen(false)}
          onConnect={onConnect}
          onTargetChange={onTargetChange}
          target={target}
        />
      ) : null}
    </div>
  );
}

export function HarnessLoginPopover({
  disabled,
  onClose,
  onConnect,
  onTargetChange,
  target,
}: {
  disabled: boolean;
  onClose: () => void;
  onConnect: (target: string) => void;
  onTargetChange: (target: string) => void;
  target: string;
}) {
  return (
    <div
      aria-label="Log in to harness"
      className="harness-popover"
      onKeyDown={(event) =>
        handleModalKeyDown(event, event.currentTarget, onClose)
      }
      role="dialog"
    >
      <label className="harness-field">
        <span className="harness-field-label">SSH target</span>
        <input
          autoComplete="off"
          className="harness-input"
          onChange={(event) => onTargetChange(event.target.value)}
          placeholder="user@host"
          ref={(element) => {
            element?.focus();
          }}
          spellCheck={false}
          type="text"
          value={target}
        />
      </label>
      <p className="harness-help">
        Opens a terminal, connects over SSH, and starts Tailscale login when the
        harness is signed out.
      </p>
      <button
        className="harness-connect"
        disabled={disabled || !isValidHarnessTarget(target)}
        onClick={() => {
          if (submitHarnessConnect(target, disabled, onConnect)) {
            onClose();
          }
        }}
        type="button"
      >
        Connect &amp; log in
      </button>
    </div>
  );
}

/**
 * Fires onConnect only for a valid, enabled target and reports whether the
 * popover should close.
 */
export function submitHarnessConnect(
  target: string,
  disabled: boolean,
  onConnect: (target: string) => void,
): boolean {
  if (disabled || !isValidHarnessTarget(target)) {
    return false;
  }
  onConnect(target);
  return true;
}

export function TailscaleLoginBanner({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  return (
    <div className="harness-banner" role="status">
      <span className="harness-banner-text">
        Tailscale needs you to sign in.
      </span>
      <a
        className="harness-banner-open"
        href={url}
        rel="noreferrer noopener"
        target="_blank"
      >
        Open login page
      </a>
      <button
        className="harness-banner-dismiss"
        onClick={onDismiss}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}

function KeyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
      viewBox="0 0 16 16"
      width={size}
    >
      <circle cx="5" cy="8" r="2.6" />
      <path d="M7.6 8h6.65M11.4 8v2.3M13.7 8v1.7" />
    </svg>
  );
}
