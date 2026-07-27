import type { KeyboardEvent } from "react";

import {
  canSendPaciumPrompt,
  validatePaciumPrompt,
  type PaciumPromptState,
} from "./pacium-prompt-model.js";
import type {
  PaciumPromptTarget,
  PaciumPromptTargetId,
  PaciumPromptTargetProjection,
} from "./pacium-prompt-target-model.js";

export function PaciumPromptComposer({
  projection,
  state,
  onDraftChange,
  onSend,
  onTargetChange,
}: {
  projection: PaciumPromptTargetProjection;
  state: PaciumPromptState;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onTargetChange: (targetId: PaciumPromptTargetId | null) => void;
}) {
  const validation = validatePaciumPrompt(state.draft);
  const selectedTarget =
    projection.targets.find((target) => target.id === state.targetId) ?? null;
  const pending = state.pending !== null;
  const canSend = canSendPaciumPrompt(state, projection);

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if ((event.metaKey || event.ctrlKey) && canSend) {
      onSend();
    }
  };

  return (
    <section
      aria-busy={pending}
      aria-labelledby="pacium-prompt-heading"
      className="pacium-prompt-composer"
    >
      <header>
        <div>
          <span>Pacium input</span>
          <strong id="pacium-prompt-heading">Send to one exact terminal</strong>
        </div>
        <small>{validation.characterCount.toLocaleString()} / 4,000</small>
      </header>

      <div className="pacium-prompt-fields">
        <label>
          <span>Target</span>
          <select
            aria-describedby="pacium-prompt-target-help"
            disabled={pending || projection.targets.length === 0}
            onChange={(event) =>
              onTargetChange(
                event.currentTarget.value === ""
                  ? null
                  : (event.currentTarget.value as PaciumPromptTargetId),
              )
            }
            value={state.targetId ?? ""}
          >
            <option value="">Select target</option>
            <TargetOptions
              label="Primary roles"
              targets={projection.targets.filter(
                (target) => target.kind === "role",
              )}
            />
            <TargetOptions
              label="Workers"
              targets={projection.targets.filter(
                (target) => target.kind === "worker",
              )}
            />
          </select>
        </label>

        <label className="pacium-prompt-field">
          <span>Prompt</span>
          <textarea
            aria-describedby="pacium-prompt-validation pacium-prompt-boundary"
            disabled={pending}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder="Type one control-free line…"
            rows={2}
            value={state.draft}
          />
        </label>
      </div>

      <div className="pacium-prompt-evidence">
        <p id="pacium-prompt-target-help">
          {selectedTarget === null
            ? projection.message
            : `${selectedTarget.label} · ${selectedTarget.statusLabel} · ${selectedTarget.detail}`}
        </p>
        <p
          className={validation.valid ? undefined : "validation-error"}
          id="pacium-prompt-validation"
        >
          {pending
            ? "Sending terminal input. Duplicate send is locked."
            : (validation.error ??
              "Ready. Press Command or Control + Enter to send.")}
        </p>
        <p id="pacium-prompt-boundary">
          Sends terminal input only. It is not an approval and does not confirm
          agent handling.
        </p>
      </div>

      <button
        className="primary-button"
        disabled={!canSend}
        onClick={onSend}
        type="button"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </section>
  );
}

function TargetOptions({
  label,
  targets,
}: {
  label: string;
  targets: readonly PaciumPromptTarget[];
}) {
  if (targets.length === 0) {
    return null;
  }
  return (
    <optgroup label={label}>
      {targets.map((target) => (
        <option disabled={!target.available} key={target.id} value={target.id}>
          {target.label} — {target.statusLabel}
        </option>
      ))}
    </optgroup>
  );
}
