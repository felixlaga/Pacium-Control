import type {
  QueueArtifactObservation,
  QueueItemReconciliation,
  QueueResolutionAction,
} from "@pacium/contracts";
import type { ReactNode } from "react";

import { queueSourceConflictLabel } from "./pacium-queue-model.js";

export function PaciumQueueReconciliationPanel({
  reconciliation,
}: {
  reconciliation: QueueItemReconciliation;
}) {
  const latestAttempt = reconciliation.attempts.at(-1) ?? null;
  return (
    <section
      aria-labelledby="queue-reconciliation-title"
      className="queue-reconciliation-panel"
    >
      <div className="inspector-section-heading">
        <h3 id="queue-reconciliation-title">Reconciliation evidence</h3>
        <span>Observed + human-labelled</span>
      </div>

      <dl className="metadata queue-reconciliation-summary">
        <div>
          <dt>Lifecycle</dt>
          <dd>{lifecycleLabel(reconciliation.lifecycle.status)}</dd>
        </div>
        <div>
          <dt>Attempts</dt>
          <dd>{reconciliation.attempts.length} of 2 maximum</dd>
        </div>
        <div>
          <dt>Retry</dt>
          <dd>{retryLabel(reconciliation.retry.status)}</dd>
        </div>
        <div>
          <dt>Artifact</dt>
          <dd>{artifactLabel(reconciliation.artifact)}</dd>
        </div>
      </dl>

      <p>{artifactExplanation(reconciliation.artifact)}</p>

      {reconciliation.conflicts.length > 0 && (
        <EvidenceList title="Conflicts">
          {reconciliation.conflicts.map((conflict) => (
            <li key={conflict.conflictId}>
              <strong>{queueSourceConflictLabel(conflict.kind)}</strong>
              <span>
                Observed {formatTimestamp(conflict.observedAt)}
                {conflict.decisionCount > 0
                  ? ` · ${conflict.decisionCount} ${
                      conflict.decisionCount === 1 ? "decision" : "decisions"
                    }`
                  : ""}
              </span>
            </li>
          ))}
        </EvidenceList>
      )}

      {latestAttempt !== null && (
        <EvidenceList title="Latest immutable attempt">
          <li>
            <strong>
              {latestAttempt.outcome?.status ?? "Outcome not durable"}
            </strong>
            <span>
              Requested {formatTimestamp(latestAttempt.requestedAt)} ·{" "}
              {latestAttempt.target.methodLabel}
            </span>
          </li>
        </EvidenceList>
      )}

      {reconciliation.lifecycle.history.length > 0 && (
        <EvidenceList title="Human-labelled history">
          {reconciliation.lifecycle.history.map((resolution) => (
            <li key={resolution.resolutionId}>
              <strong>{lifecycleLabel(resolution.action)}</strong>
              <span>
                {formatTimestamp(resolution.recordedAt)}
                {resolution.note === null ? "" : ` · ${resolution.note}`}
              </span>
            </li>
          ))}
          {reconciliation.lifecycle.historyTruncated && (
            <li>
              <strong>Earlier records retained</strong>
              <span>Only the latest two are shown here.</span>
            </li>
          )}
        </EvidenceList>
      )}

      {reconciliation.priorDecisions.decisions.length > 0 && (
        <EvidenceList title="Other decisions from this source">
          {reconciliation.priorDecisions.decisions.map((decision) => (
            <li key={decision.decisionId}>
              <strong>
                {decision.itemType === "question" ? "Question" : "Approval"}{" "}
                decision
              </strong>
              <span>{formatTimestamp(decision.decidedAt)}</span>
            </li>
          ))}
          {reconciliation.priorDecisions.truncated && (
            <li>
              <strong>More decisions retained</strong>
              <span>The bounded inspector list is truncated.</span>
            </li>
          )}
        </EvidenceList>
      )}
    </section>
  );
}

function EvidenceList({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="queue-reconciliation-evidence">
      <h4>{title}</h4>
      <ul>{children}</ul>
    </div>
  );
}

function artifactLabel(artifact: QueueArtifactObservation | null): string {
  if (artifact === null) {
    return "No delivery attempt";
  }
  if (artifact.status === "transport_artifact_present") {
    return "Transport artifact present";
  }
  if (artifact.status === "target_conflict") {
    return "Target conflict";
  }
  return "Acknowledgement unavailable";
}

function artifactExplanation(
  artifact: QueueArtifactObservation | null,
): string {
  if (artifact === null) {
    return "No transport artifact exists because no delivery attempt has been recorded.";
  }
  if (artifact.status === "transport_artifact_present") {
    return `The exact answer-file artifact was observed (${artifact.byteLength} bytes). This proves transport output only, not acknowledgement or application.`;
  }
  if (artifact.status === "target_conflict") {
    return "The configured answer target no longer matches the immutable delivery artifact. Pacium did not overwrite or interpret it.";
  }
  return artifact.reason === "answer_file_missing"
    ? "The answer-file artifact is missing. Pacium cannot infer whether it was consumed or never arrived."
    : "Provider acknowledgement is unavailable for this terminal prompt. Terminal acceptance is not agent acknowledgement.";
}

function lifecycleLabel(
  status: QueueResolutionAction | "awaiting_evidence",
): string {
  switch (status) {
    case "awaiting_evidence":
      return "Awaiting human evidence";
    case "acknowledged":
      return "Acknowledged · human-labelled";
    case "applied":
      return "Applied · human-labelled";
    case "unable_to_apply":
      return "Unable to apply · human-labelled";
    case "confirmed_not_delivered":
      return "Not delivered · human-confirmed";
    case "superseded":
      return "Superseded · human-labelled";
  }
}

function retryLabel(
  status: QueueItemReconciliation["retry"]["status"],
): string {
  switch (status) {
    case "not_applicable":
      return "Not applicable";
    case "locked":
      return "Locked pending evidence";
    case "ready":
      return "One retry available";
    case "exhausted":
      return "Exhausted";
  }
}

function formatTimestamp(iso: string): string {
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime())
    ? "Unavailable"
    : timestamp.toLocaleString();
}
