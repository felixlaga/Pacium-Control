import type { ProviderStatusPresentation } from "./provider-status-model.js";

export function ProviderStatusPanel({
  status,
  onOpenTerminal,
}: {
  status: ProviderStatusPresentation;
  onOpenTerminal: () => void;
}) {
  return (
    <section
      aria-labelledby="provider-status-heading"
      className={`activity-section provider-status is-${status.state}`}
    >
      <header>
        <span>
          <small>{status.providerLabel}</small>
          <h2 id="provider-status-heading">Provider status</h2>
        </span>
        <strong className="provider-status-state">{status.stateLabel}</strong>
      </header>

      <p className="provider-status-detail">{status.detail}</p>

      <dl className="provider-status-metadata">
        <div>
          <dt>Provider</dt>
          <dd>{status.providerVersion}</dd>
        </div>
        <div>
          <dt>Adapter</dt>
          <dd>{status.adapterVersion}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {status.sourceLabel} · {status.confidenceLabel}
          </dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd>
            <time dateTime={status.observedAt} title={status.observedAt}>
              Observed {new Date(status.observedAt).toLocaleTimeString()}
            </time>
            {" · "}
            <time dateTime={status.staleAfter} title={status.staleAfter}>
              fresh until {new Date(status.staleAfter).toLocaleTimeString()}
            </time>
          </dd>
        </div>
      </dl>

      <div className="provider-terminal-boundary">
        <span>
          <strong>
            {status.terminalAvailable
              ? "Terminal remains available"
              : "Terminal process is not live"}
          </strong>
          <small>{status.terminalDetail}</small>
        </span>
        {status.terminalAvailable && (
          <button onClick={onOpenTerminal} type="button">
            Open terminal
          </button>
        )}
      </div>

      <div className="provider-status-group">
        <h3>Capabilities</h3>
        <ul className="provider-capability-list">
          {status.capabilities.map((capability) => (
            <li className={`is-${capability.availability}`} key={capability.id}>
              <span>
                <strong>{capability.label}</strong>
                <small>{capability.detail}</small>
              </span>
              <span>
                <b>{capability.availabilityLabel}</b>
                <small>
                  {capability.sourceLabel} · {capability.confidenceLabel}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {status.diagnostics.length > 0 && (
        <div className="provider-status-group provider-diagnostic-group">
          <h3>Diagnostics</h3>
          <ul>
            {status.diagnostics.map((diagnostic) => (
              <li
                className={`is-${diagnostic.severity}`}
                key={`${diagnostic.code}:${diagnostic.observedAt}`}
              >
                <header>
                  <strong>{diagnostic.severityLabel}</strong>
                  <code>{diagnostic.code}</code>
                  <time
                    dateTime={diagnostic.observedAt}
                    title={diagnostic.observedAt}
                  >
                    {new Date(diagnostic.observedAt).toLocaleTimeString()}
                  </time>
                </header>
                <p>{diagnostic.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="provider-recovery" role="note">
        <strong>Next step</strong>
        {status.recovery}
      </p>
    </section>
  );
}
