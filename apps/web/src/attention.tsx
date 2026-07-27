import {
  attentionConfidenceLabel,
  attentionSourceLabel,
  attentionStateLabel,
  type AttentionResult,
} from "./attention-model.js";

export function AttentionEvidenceCard({
  attention,
}: {
  attention: AttentionResult;
}) {
  return (
    <div className={`attention-card attention-${attention.state}`}>
      <header>
        <span aria-hidden="true" className="attention-glyph">
          {attentionGlyph(attention.state)}
        </span>
        <span>
          <strong>{attentionStateLabel(attention.state)}</strong>
          <small>
            {attentionSourceLabel(attention.source)} ·{" "}
            {attentionConfidenceLabel(attention.confidence)}
          </small>
        </span>
      </header>
      <p>{attention.reason}</p>
      <time dateTime={attention.observedAt}>
        Observed {formatObservedAt(attention.observedAt)}
      </time>
    </div>
  );
}

function attentionGlyph(state: AttentionResult["state"]): string {
  switch (state) {
    case "working":
      return "●";
    case "waiting":
      return "◐";
    case "needs_input":
      return "!";
    case "finished":
      return "✓";
    case "failed":
      return "×";
    case "stale":
      return "◌";
    case "unknown":
      return "?";
  }
}

function formatObservedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
