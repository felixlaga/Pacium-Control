import { useEffect, useState, type FormEvent } from "react";
import {
  MAX_QUEUE_ANSWER_BYTES,
  MAX_QUEUE_DECISION_NOTE_BYTES,
  type QueueApprovalDecisionPayload,
  type QueueDecisionRecord,
  type QueueQuestionAnswerPayload,
} from "@pacium/contracts";

import type { PaciumQueueInspectionState } from "./pacium-queue-inspection-model.js";
import { PaciumQueueDeliveryPanel } from "./pacium-queue-delivery-panel.js";

export function PaciumQueueDecisionPanel({
  onDeliver,
  onRecordApproval,
  onRecordQuestion,
  state,
}: {
  onDeliver: () => void;
  onRecordApproval: (payload: QueueApprovalDecisionPayload) => void;
  onRecordQuestion: (payload: QueueQuestionAnswerPayload) => void;
  state: PaciumQueueInspectionState;
}) {
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState<
    "approved" | "denied" | null
  >(null);
  const selection = state.selection;

  useEffect(() => {
    setAnswer("");
    setNote("");
    setConfirmation(null);
  }, [selection?.identity.itemId, state.decisionState?.status]);

  if (
    selection === null ||
    state.status !== "ready" ||
    state.decisionState === null
  ) {
    return null;
  }

  if (state.decisionState.status === "decided") {
    return (
      <>
        <ImmutableDecision decision={state.decisionState.decision} />
        <PaciumQueueDeliveryPanel
          decision={state.decisionState.decision}
          errorMessage={state.deliveryErrorMessage}
          onDeliver={onDeliver}
          state={state.deliveryState}
          status={state.deliveryStatus}
        />
      </>
    );
  }

  if (state.decisionState.status === "unavailable") {
    return (
      <section
        aria-labelledby="queue-decision-title"
        className="queue-decision-panel state-unavailable"
      >
        <h3 id="queue-decision-title">Decision unavailable</h3>
        <p role="status">{state.decisionState.error.message}</p>
        <p>
          Inspect or repair local decision state before trying again. Pacium did
          not change the queue source, terminal, or delivery target.
        </p>
      </section>
    );
  }

  if (selection.type !== "question" && selection.type !== "approval") {
    return (
      <section
        aria-labelledby="queue-decision-title"
        className="queue-decision-panel"
      >
        <h3 id="queue-decision-title">No decision action</h3>
        <p>
          Only an exact question can be answered and only an explicit approval
          request can be approved or denied.
        </p>
      </section>
    );
  }

  const submitting = state.decisionStatus === "submitting";
  const blocked = state.decisionStatus === "error";
  const answerBytes = utf8ByteLength(answer);
  const noteBytes = utf8ByteLength(note);
  const answerTooLarge = answerBytes > MAX_QUEUE_ANSWER_BYTES;
  const noteTooLarge = noteBytes > MAX_QUEUE_DECISION_NOTE_BYTES;
  const normalizedNote = note.trim().length === 0 ? null : note;

  return (
    <section
      aria-labelledby="queue-decision-title"
      className={`queue-decision-panel type-${selection.type}`}
    >
      <div className="inspector-section-heading">
        <h3 id="queue-decision-title">
          {selection.type === "question" ? "Answer" : "Approval decision"}
        </h3>
        <span>Local record only</span>
      </div>

      {selection.type === "question" ? (
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (
              submitting ||
              blocked ||
              answer.trim().length === 0 ||
              answerTooLarge ||
              noteTooLarge
            ) {
              return;
            }
            onRecordQuestion({
              answer,
              note: normalizedNote,
            });
          }}
        >
          <label>
            Answer
            <textarea
              aria-describedby="queue-answer-bound"
              aria-invalid={answerTooLarge}
              disabled={submitting || blocked}
              maxLength={MAX_QUEUE_ANSWER_BYTES}
              onChange={(event) => setAnswer(event.currentTarget.value)}
              placeholder="State the direction or judgment clearly."
              required
              rows={5}
              value={answer}
            />
            <small
              className={answerTooLarge ? "is-invalid" : ""}
              id="queue-answer-bound"
            >
              {answerBytes} / {MAX_QUEUE_ANSWER_BYTES} UTF-8 bytes
            </small>
          </label>
          <DecisionNote
            disabled={submitting || blocked}
            note={note}
            noteBytes={noteBytes}
            noteTooLarge={noteTooLarge}
            setNote={setNote}
          />
          <button
            disabled={
              submitting ||
              blocked ||
              answer.trim().length === 0 ||
              answerTooLarge ||
              noteTooLarge
            }
            type="submit"
          >
            {submitting ? "Recording answer…" : "Record answer"}
          </button>
          <p>
            This records an answer. It cannot approve an action and is not
            delivered in this step.
          </p>
        </form>
      ) : (
        <div>
          <DecisionNote
            disabled={submitting || blocked}
            note={note}
            noteBytes={noteBytes}
            noteTooLarge={noteTooLarge}
            setNote={setNote}
          />
          {confirmation === null ? (
            <div
              aria-label="Approval outcomes"
              className="queue-approval-actions"
              role="group"
            >
              <button
                disabled={submitting || blocked || noteTooLarge}
                onClick={() => setConfirmation("denied")}
                type="button"
              >
                Deny
              </button>
              <button
                className="primary"
                disabled={submitting || blocked || noteTooLarge}
                onClick={() => setConfirmation("approved")}
                type="button"
              >
                Approve
              </button>
            </div>
          ) : (
            <div
              aria-live="polite"
              className={`queue-approval-confirmation outcome-${confirmation}`}
            >
              <strong>
                Confirm {confirmation === "approved" ? "approval" : "denial"}
              </strong>
              <p>
                Record this exact {selection.sourceLabel} request as{" "}
                <b>{confirmation}</b>? The decision is immutable and is not
                delivered in this step.
              </p>
              <div>
                <button
                  disabled={submitting || noteTooLarge}
                  onClick={() => setConfirmation(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={confirmation === "approved" ? "primary" : ""}
                  disabled={submitting || noteTooLarge}
                  onClick={() =>
                    onRecordApproval({
                      outcome: confirmation,
                      note: normalizedNote,
                    })
                  }
                  type="button"
                >
                  {submitting
                    ? "Recording…"
                    : confirmation === "approved"
                      ? "Confirm approval"
                      : "Confirm denial"}
                </button>
              </div>
            </div>
          )}
          <p>
            Approval controls are separate from question answers. Recording does
            not run, send, or deliver the requested action.
          </p>
        </div>
      )}

      {state.decisionErrorMessage !== null && (
        <div className="queue-decision-error" role="alert">
          <strong>Decision not recorded</strong>
          <p>{state.decisionErrorMessage}</p>
          <p>
            Close and reopen this item to inspect current durable state before
            another deliberate attempt.
          </p>
        </div>
      )}
    </section>
  );
}

function DecisionNote({
  disabled,
  note,
  noteBytes,
  noteTooLarge,
  setNote,
}: {
  disabled: boolean;
  note: string;
  noteBytes: number;
  noteTooLarge: boolean;
  setNote: (value: string) => void;
}) {
  return (
    <label>
      Note <span>Optional</span>
      <textarea
        aria-describedby="queue-decision-note-bound"
        aria-invalid={noteTooLarge}
        disabled={disabled}
        maxLength={MAX_QUEUE_DECISION_NOTE_BYTES}
        onChange={(event) => setNote(event.currentTarget.value)}
        placeholder="Add bounded context for the local record."
        rows={3}
        value={note}
      />
      <small
        className={noteTooLarge ? "is-invalid" : ""}
        id="queue-decision-note-bound"
      >
        {noteBytes} / {MAX_QUEUE_DECISION_NOTE_BYTES} UTF-8 bytes
      </small>
    </label>
  );
}

function ImmutableDecision({ decision }: { decision: QueueDecisionRecord }) {
  return (
    <section
      aria-labelledby="queue-decision-title"
      className="queue-decision-panel state-decided"
    >
      <div className="inspector-section-heading">
        <h3 id="queue-decision-title">Immutable local decision</h3>
        <span>Stored locally</span>
      </div>
      <dl className="metadata">
        <div>
          <dt>Outcome</dt>
          <dd>
            {decision.kind === "question_answer"
              ? "Question answered"
              : decision.payload.outcome === "approved"
                ? "Approved"
                : "Denied"}
          </dd>
        </div>
        {decision.kind === "question_answer" && (
          <div>
            <dt>Answer</dt>
            <dd className="queue-decision-text">{decision.payload.answer}</dd>
          </div>
        )}
        {decision.payload.note !== null && (
          <div>
            <dt>Note</dt>
            <dd className="queue-decision-text">{decision.payload.note}</dd>
          </div>
        )}
        <div>
          <dt>Actor</dt>
          <dd>{decision.actor.label}</dd>
        </div>
        <div>
          <dt>Decided</dt>
          <dd>
            <time dateTime={decision.decidedAt}>
              {formatTimestamp(decision.decidedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Decision ID</dt>
          <dd>
            <code>{decision.decisionId}</code>
          </dd>
        </div>
        <div>
          <dt>Decision hash</dt>
          <dd>
            <code>{decision.decisionHash}</code>
          </dd>
        </div>
      </dl>
      <p>
        This record cannot be edited here. Delivery remains a separate explicit
        action below.
      </p>
    </section>
  );
}

function formatTimestamp(iso: string): string {
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime())
    ? "Unavailable"
    : timestamp.toLocaleString();
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
