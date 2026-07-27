import type { AgentClassification } from "@pacium/contracts";

import {
  classificationConfidenceLabel,
  classificationSourceLabel,
} from "./agent-classification-model.js";

export function AgentClassificationCard({
  classification,
}: {
  classification: AgentClassification;
}) {
  return (
    <div className="agent-classification-card">
      <header>
        <span aria-hidden="true" className="agent-classification-glyph">
          {agentTypeGlyph(classification.type)}
        </span>
        <span>
          <strong>{classification.label}</strong>
          <small>{classificationSourceLabel(classification.source)}</small>
        </span>
      </header>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{classification.type}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{classificationSourceLabel(classification.source)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{classificationConfidenceLabel(classification.confidence)}</dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>
            <time dateTime={classification.observedAt}>
              {formatObservedAt(classification.observedAt)}
            </time>
          </dd>
        </div>
      </dl>
      <p>
        Launch evidence identifies the CLI. It does not confirm current activity
        or attention.
      </p>
    </div>
  );
}

function agentTypeGlyph(type: AgentClassification["type"]): string {
  switch (type) {
    case "shell":
      return ">_";
    case "codex":
      return "C";
    case "claude":
      return "A";
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
