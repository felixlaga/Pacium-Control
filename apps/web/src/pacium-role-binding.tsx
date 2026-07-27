import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { PaciumBinding, PaciumRoleId } from "@pacium/contracts";

import { handleModalKeyDown } from "./modal-focus.js";
import {
  bindingFromDraft,
  initialPaciumRoleBindingDraft,
  type PaciumRoleBindingDraft,
  type PaciumRoleBindingOptions,
} from "./pacium-role-binding-model.js";
import { roleLabel } from "./pacium-role-model.js";

export function PaciumRoleBindingDialog({
  role,
  binding,
  connected,
  options,
  saving,
  onCancel,
  onSave,
}: {
  role: PaciumRoleId;
  binding: PaciumBinding | null;
  connected: boolean;
  options: PaciumRoleBindingOptions;
  saving: boolean;
  onCancel: () => void;
  onSave: (binding: PaciumBinding) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initial = useMemo(
    () => initialPaciumRoleBindingDraft(binding, options),
    [binding, options],
  );
  const [draft, setDraft] = useState<PaciumRoleBindingDraft | null>(initial);
  const selectedBinding = bindingFromDraft(draft, options);
  const sessionAvailable = options.sessions.length > 0;
  const presetAvailable = options.presets.some((preset) => preset.available);
  const selectedPreset =
    draft?.type === "launch_preset"
      ? (options.presets.find((preset) => preset.id === draft.launchPreset) ??
        null)
      : null;
  const roleName = roleLabel(role);

  useEffect(() => {
    const firstChoice = dialogRef.current?.querySelector<HTMLElement>(
      "input:not(:disabled), select:not(:disabled)",
    );
    const fallback = dialogRef.current?.querySelector<HTMLElement>(
      "button:not(:disabled)",
    );
    (firstChoice ?? fallback)?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedBinding !== null && connected && !saving) {
      onSave(selectedBinding);
    }
  };

  const selectBindingType = (type: "session" | "launch_preset") => {
    if (type === "session") {
      const session = options.sessions[0];
      setDraft(
        session === undefined
          ? null
          : { type: "session", sessionId: session.id },
      );
      return;
    }
    const preset = options.presets.find((candidate) => candidate.available);
    setDraft(
      preset === undefined
        ? null
        : {
            type: "launch_preset",
            launchPreset: preset.id,
            repositoryId: null,
          },
    );
  };

  return (
    <div
      aria-labelledby="pacium-role-binding-title"
      aria-modal="true"
      className="dialog-backdrop"
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
      role="dialog"
    >
      <form
        aria-busy={saving}
        className="dialog-card pacium-role-binding-dialog"
        onSubmit={submit}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Primary role</span>
            <h2 id="pacium-role-binding-title">Assign {roleName}</h2>
          </div>
          <button
            aria-label="Cancel role assignment"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>

        <p className="dialog-note">
          Bind {roleName} to one live Pacium terminal or a fixed launch preset.
          Names and terminal output never assign a role.
        </p>

        <fieldset className="pacium-binding-kind">
          <legend>Binding type</legend>
          <div className="segmented-field">
            <label>
              <input
                checked={draft?.type === "session"}
                disabled={!sessionAvailable || saving}
                name="binding-type"
                onChange={() => selectBindingType("session")}
                type="radio"
              />
              Running session
            </label>
            <label>
              <input
                checked={draft?.type === "launch_preset"}
                disabled={!presetAvailable || saving}
                name="binding-type"
                onChange={() => selectBindingType("launch_preset")}
                type="radio"
              />
              Launch preset
            </label>
          </div>
        </fieldset>

        {draft?.type === "session" ? (
          <fieldset className="pacium-binding-options">
            <legend>Eligible live terminal</legend>
            {options.sessions.map((session) => (
              <label key={session.id}>
                <input
                  checked={draft.sessionId === session.id}
                  disabled={saving}
                  name="role-session"
                  onChange={() =>
                    setDraft({ type: "session", sessionId: session.id })
                  }
                  type="radio"
                />
                <span>
                  <strong>{session.label}</strong>
                  <small>{session.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : draft?.type === "launch_preset" ? (
          <>
            <fieldset className="pacium-binding-options">
              <legend>Fixed launch preset</legend>
              {options.presets.map((preset) => (
                <label key={preset.id}>
                  <input
                    checked={draft.launchPreset === preset.id}
                    disabled={!preset.available || saving}
                    name="role-preset"
                    onChange={() =>
                      setDraft({
                        type: "launch_preset",
                        launchPreset: preset.id,
                        repositoryId: null,
                      })
                    }
                    type="radio"
                  />
                  <span>
                    <strong>{preset.label}</strong>
                    <small>
                      {preset.available
                        ? "Available on this Pacium host"
                        : (preset.unavailableReason ?? "Unavailable")}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="pacium-role-repository">
              <span>Working directory</span>
              <select
                disabled={saving || selectedPreset?.available !== true}
                onChange={(event) =>
                  setDraft({
                    type: "launch_preset",
                    launchPreset: draft.launchPreset,
                    repositoryId:
                      event.target.value.length === 0
                        ? null
                        : event.target.value,
                  })
                }
                value={draft.repositoryId ?? ""}
              >
                <option value="">Server default</option>
                {options.repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.label} · {repository.root}
                  </option>
                ))}
              </select>
              <small>
                Only repositories already accepted in the Pacium definition are
                available.
              </small>
            </label>
          </>
        ) : (
          <div className="dialog-empty-state" role="status">
            <strong>No eligible binding is available.</strong>
            <p>
              Start a general terminal or make a fixed launch preset available,
              then return to this role.
            </p>
          </div>
        )}

        {!connected && (
          <p className="preset-unavailable" role="status">
            Reconnect before saving. Existing terminals are unchanged.
          </p>
        )}

        <div className="dialog-actions">
          <button disabled={saving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={selectedBinding === null || !connected || saving}
            type="submit"
          >
            {saving ? "Saving role…" : `Save ${roleName}`}
          </button>
        </div>
      </form>
    </div>
  );
}
