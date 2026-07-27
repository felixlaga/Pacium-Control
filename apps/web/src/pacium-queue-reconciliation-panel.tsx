import type {
  QueueArtifactObservation,
  QueueItemReconciliation,
  QueueResolutionAction,
  QueueResolutionRequest,
} from "@pacium/contracts";
import { MAX_QUEUE_DECISION_NOTE_BYTES } from "@pacium/contracts";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { queueSourceConflictLabel } from "./pacium-queue-model.js";

export function PaciumQueueReconciliationPanel({
  errorMessage,
  onResolve,
  reconciliation,
  status,
}: {
  errorMessage: string | null;
  onResolve: (request: QueueResolutionRequest) => void;
  reconciliation: QueueItemReconciliation;
  status: "idle" | "submitting" | "error";
}) {
  const latestAttempt = reconciliation.attempts.at(-1) ?? null;
  const actions = availableActions(reconciliation);
  const [pendingAction, setPendingAction] =
    useState<QueueResolutionAction | null>(null);
  const [note, setNote] = useState("");
  const [relatedDecisionId, setRelatedDecisionId] = useState(
    reconciliation.priorDecisions.decisions[0]?.decisionId ?? "",
  );

  useEffect(() => {
    setPendingAction(null);
    setNote("");
    setRelatedDecisionId(
      reconciliation.priorDecisions.decisions[0]?.decisionId ?? "",
    );
  }, [
    reconciliation.decisionId,
    reconciliation.lifecycle.status,
    reconciliation.attempts.length,
  ]);

  const submitting = status === "submitting";
  const noteBytes = new TextEncoder().encode(note).byteLength;
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

      {actions.length > 0 && (
        <div className="queue-resolution-actions">
          <h4>Record human evidence</h4>
          <div role="group" aria-label="Lifecycle evidence labels">
            {actions.map((action) => (
              <button
                disabled={submitting}
                key={action}
                onClick={() => {
                  setPendingAction(action);
                  setNote("");
                }}
                type="button"
              >
                {actionLabel(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingAction !== null && (
        <form
          className="queue-resolution-confirmation"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (
              submitting ||
              noteBytes > MAX_QUEUE_DECISION_NOTE_BYTES ||
              (latestAttempt === null && pendingAction !== "superseded")
            ) {
              return;
            }
            const related = reconciliation.priorDecisions.decisions.find(
              (decision) => decision.decisionId === relatedDecisionId,
            );
            if (pendingAction === "superseded" && related === undefined) {
              return;
            }
            onResolve({
              decisionId: reconciliation.decisionId,
              decisionHash: reconciliation.decisionHash,
              action: pendingAction,
              delivery:
                pendingAction === "superseded" || latestAttempt === null
                  ? null
                  : {
                      deliveryId: latestAttempt.deliveryId,
                      deliveryHash: latestAttempt.deliveryHash,
                    },
              relatedDecision:
                pendingAction === "superseded" && related !== undefined
                  ? {
                      decisionId: related.decisionId,
                      decisionHash: related.decisionHash,
                    }
                  : null,
              note: note.trim().length === 0 ? null : note,
            });
          }}
        >
          <strong>Review {actionLabel(pendingAction).toLowerCase()}</strong>
          <p>{actionExplanation(pendingAction)}</p>
          {pendingAction === "superseded" && (
            <label>
              Replacement decision
              <select
                disabled={submitting}
                onChange={(event) =>
                  setRelatedDecisionId(event.currentTarget.value)
                }
                value={relatedDecisionId}
              >
                {reconciliation.priorDecisions.decisions.map((decision) => (
                  <option key={decision.decisionId} value={decision.decisionId}>
                    {decision.itemType === "question" ? "Question" : "Approval"}{" "}
                    · {formatTimestamp(decision.decidedAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Evidence note <span>optional</span>
            <textarea
              aria-describedby="queue-resolution-note-bound"
              aria-invalid={noteBytes > MAX_QUEUE_DECISION_NOTE_BYTES}
              disabled={submitting}
              onChange={(event) => setNote(event.currentTarget.value)}
              rows={3}
              value={note}
            />
          </label>
          <small
            className={
              noteBytes > MAX_QUEUE_DECISION_NOTE_BYTES ? "is-invalid" : ""
            }
            id="queue-resolution-note-bound"
          >
            {noteBytes} / {MAX_QUEUE_DECISION_NOTE_BYTES} UTF-8 bytes
          </small>
          <div>
            <button
              disabled={submitting}
              onClick={() => {
                setPendingAction(null);
                setNote("");
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              disabled={
                submitting ||
                noteBytes > MAX_QUEUE_DECISION_NOTE_BYTES ||
                (pendingAction === "superseded" &&
                  relatedDecisionId.length === 0)
              }
              type="submit"
            >
              {submitting ? "Recording…" : "Confirm label"}
            </button>
          </div>
        </form>
      )}

      {errorMessage !== null && (
        <div className="queue-resolution-error" role="alert">
          <strong>Lifecycle label not confirmed</strong>
          <p>{errorMessage}</p>
          <p>
            External queue, target, and terminal state were not changed. Reopen
            this exact item before another deliberate attempt.
          </p>
        </div>
      )}
    </section>
  );
}

function availableActions(
  reconciliation: QueueItemReconciliation,
): QueueResolutionAction[] {
  const current = reconciliation.lifecycle.status;
  if (
    current === "applied" ||
    current === "unable_to_apply" ||
    current === "superseded"
  ) {
    return [];
  }
  const seen = new Set(
    reconciliation.lifecycle.history.map((resolution) => resolution.action),
  );
  const actions: QueueResolutionAction[] = [];
  if (reconciliation.attempts.length > 0) {
    if (current !== "acknowledged" && !seen.has("acknowledged")) {
      actions.push("acknowledged");
    }
    if (!seen.has("applied")) {
      actions.push("applied");
    }
    if (!seen.has("unable_to_apply")) {
      actions.push("unable_to_apply");
    }
    if (
      reconciliation.retry.status === "locked" &&
      !seen.has("confirmed_not_delivered")
    ) {
      actions.push("confirmed_not_delivered");
    }
  }
  if (
    reconciliation.priorDecisions.decisions.length > 0 &&
    !seen.has("superseded")
  ) {
    actions.push("superseded");
  }
  return actions;
}

function actionLabel(action: QueueResolutionAction): string {
  switch (action) {
    case "acknowledged":
      return "Mark acknowledged";
    case "applied":
      return "Mark applied";
    case "unable_to_apply":
      return "Mark unable to apply";
    case "confirmed_not_delivered":
      return "Confirm not delivered";
    case "superseded":
      return "Mark superseded";
  }
}

function actionExplanation(action: QueueResolutionAction): string {
  switch (action) {
    case "acknowledged":
      return "Record that a human verified acknowledgement. Pacium cannot infer this from terminal or artifact evidence.";
    case "applied":
      return "Record that a human verified the decision was applied. This label does not execute the requested action.";
    case "unable_to_apply":
      return "Record that a human verified the decision could not be applied. Existing attempts remain immutable.";
    case "confirmed_not_delivered":
      return "Record that a human verified the first attempt did not arrive. This unlocks the sole retry but does not send it.";
    case "superseded":
      return "Link this decision to another immutable decision from the same source. Neither record is deleted.";
  }
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
