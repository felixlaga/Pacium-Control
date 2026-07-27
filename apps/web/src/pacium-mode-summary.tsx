import type { PaciumModeSummary } from "./pacium-mode-summary-model.js";

export function PaciumModeSummaryCard({
  summary,
  onOpenContext,
  onRetry,
}: {
  summary: PaciumModeSummary;
  onOpenContext: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label="Pacium workspace definition"
      className={`pacium-mode-summary status-${summary.status}`}
    >
      <div className="pacium-mode-summary-heading">
        <div>
          <span>Configured workspace</span>
          <strong>{summary.title}</strong>
        </div>
        <span>{summary.freshness}</span>
      </div>
      <p>{summary.detail}</p>
      {summary.stats.length > 0 && (
        <dl>
          {summary.stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(summary.status === "error" || summary.status === "loading") && (
        <button disabled={!summary.canRetry} onClick={onRetry} type="button">
          Retry
        </button>
      )}
      {summary.status === "ready" && (
        <button
          className="pacium-context-open"
          id="pacium-context-trigger"
          onClick={onOpenContext}
          type="button"
        >
          Open context
        </button>
      )}
    </section>
  );
}
