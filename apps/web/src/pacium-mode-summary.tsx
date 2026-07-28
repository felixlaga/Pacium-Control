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
      title={summary.detail}
    >
      <div className="pacium-mode-summary-heading">
        <div>
          <span>Workspace</span>
          <strong>{summary.title}</strong>
        </div>
        <span>{summary.freshness}</span>
      </div>
      <span className="visually-hidden">{summary.detail}</span>
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
          Context
        </button>
      )}
    </section>
  );
}
