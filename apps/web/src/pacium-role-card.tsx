import type { PaciumRoleId } from "@pacium/contracts";

import type { PaciumRoleModel } from "./pacium-role-model.js";

export function PaciumRoleGroup({
  roles,
  onConfigure,
  onLaunch,
  onOpen,
  onRetry,
}: {
  roles: readonly PaciumRoleModel[];
  onConfigure: (role: PaciumRoleId) => void;
  onLaunch: (role: PaciumRoleId) => void;
  onOpen: (sessionId: string) => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="pacium-role-heading"
      className="pacium-role-group"
    >
      <div className="section-heading">
        <span id="pacium-role-heading">Primary roles</span>
        <span>2</span>
      </div>
      <div className="pacium-role-grid">
        {roles.map((role) => (
          <PaciumRoleCard
            key={role.role}
            model={role}
            onConfigure={() => onConfigure(role.role)}
            onLaunch={() => onLaunch(role.role)}
            onOpen={() => {
              if (role.sessionId !== null) {
                onOpen(role.sessionId);
              }
            }}
            onRetry={onRetry}
          />
        ))}
      </div>
    </section>
  );
}

export function PaciumRoleCard({
  model,
  onConfigure,
  onLaunch,
  onOpen,
  onRetry,
}: {
  model: PaciumRoleModel;
  onConfigure: () => void;
  onLaunch: () => void;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const configurationAction =
    model.status === "unconfigured" || model.status === "unassigned"
      ? "Assign"
      : "Change";
  const showConfigure = !["loading", "error", "launching", "binding"].includes(
    model.status,
  );

  return (
    <article
      aria-label={`${model.label} role, ${model.statusLabel}`}
      className={`pacium-role-card status-${model.status}`}
      data-role={model.role}
    >
      <header>
        <span className="pacium-role-glyph" aria-hidden="true">
          {model.role === "meta" ? "M" : "O"}
        </span>
        <div>
          <strong>{model.label}</strong>
          <span>{model.statusLabel}</span>
        </div>
      </header>
      <p>{model.detail}</p>
      {model.context !== null && (
        <small className="pacium-role-context" title={model.context}>
          {model.context}
        </small>
      )}
      <small className="pacium-role-connection">{model.connectionLabel}</small>
      <div className="pacium-role-actions">
        {model.sessionId !== null && model.canOpen && (
          <button onClick={onOpen} type="button">
            Open
          </button>
        )}
        {model.launchPreset !== null && (
          <button
            className="primary-button"
            disabled={!model.canLaunch}
            onClick={onLaunch}
            type="button"
          >
            Launch
          </button>
        )}
        {showConfigure && (
          <button
            disabled={!model.canConfigure}
            onClick={onConfigure}
            type="button"
          >
            {configurationAction}
          </button>
        )}
        {(model.status === "loading" || model.status === "error") && (
          <button disabled={!model.canRetry} onClick={onRetry} type="button">
            Retry
          </button>
        )}
      </div>
    </article>
  );
}
