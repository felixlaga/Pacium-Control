import type {
  QueueDecisionRecord,
  QueueDeliveryState,
  QueueDeliveryTarget,
} from "@pacium/contracts";
import type { ReactNode } from "react";

export function PaciumQueueDeliveryPanel({
  decision,
  errorMessage,
  onDeliver,
  state,
  status,
}: {
  decision: QueueDecisionRecord;
  errorMessage: string | null;
  onDeliver: () => void;
  state: QueueDeliveryState | null;
  status: "idle" | "submitting" | "error";
}) {
  if (state === null) {
    return (
      <DeliverySection stateClass="state-checking" title="Checking delivery">
        <p role="status">
          Reading the accepted delivery method for this immutable decision.
          Nothing is sent automatically.
        </p>
      </DeliverySection>
    );
  }

  if (state.status === "not_configured") {
    return (
      <DeliverySection
        stateClass="state-not-configured"
        title="Delivery not configured"
      >
        <p role="status">{state.error.message}</p>
        <p>
          Add a compatible method to the accepted Pacium workspace, then reopen
          this exact item. The decision remains stored locally.
        </p>
      </DeliverySection>
    );
  }

  if (state.status === "unavailable") {
    return (
      <DeliverySection
        stateClass="state-unavailable"
        title="Delivery unavailable"
      >
        <TargetSummary target={state.target} />
        <p role="status">{state.error.message}</p>
        <p>
          Pacium did not select another target or invoke a transport. Repair the
          configured boundary and reopen this item to inspect it again.
        </p>
      </DeliverySection>
    );
  }

  if (state.status === "ready" || state.status === "ready_retry") {
    const retry = state.status === "ready_retry";
    const submitting = status === "submitting";
    return (
      <DeliverySection
        stateClass={retry ? "state-ready-retry" : "state-ready"}
        title={retry ? "Ready for one retry" : "Ready for delivery"}
      >
        <TargetSummary target={state.target} />
        {retry && (
          <p role="status">
            Retry 1 of 1 is unlocked by the recorded human confirmation that the
            first attempt was not delivered. The target was checked again.
          </p>
        )}
        <details className="queue-delivery-confirmation">
          <summary>{retry ? "Review retry" : "Review delivery"}</summary>
          <p>{confirmationCopy(state.target, decision)}</p>
          <p>
            {retry
              ? "This is the only permitted retry of the already-recorded decision. It preserves the first attempt and does not infer acknowledgement."
              : "This sends the already-recorded decision only. It does not execute queue text, approve another action, or choose a different target."}
          </p>
          <div className="queue-delivery-actions">
            <button
              disabled={submitting}
              onClick={(event) =>
                event.currentTarget.closest("details")?.removeAttribute("open")
              }
              type="button"
            >
              Cancel
            </button>
            <button disabled={submitting} onClick={onDeliver} type="button">
              {submitting
                ? retry
                  ? "Retrying…"
                  : "Delivering…"
                : retry
                  ? "Confirm retry"
                  : "Confirm delivery"}
            </button>
          </div>
        </details>
        {errorMessage !== null && (
          <div className="queue-delivery-error" role="alert">
            <strong>Delivery outcome needs inspection</strong>
            <p>{errorMessage}</p>
            <p>
              Pacium did not retry. Close and reopen this item to read durable
              delivery state.
            </p>
          </div>
        )}
      </DeliverySection>
    );
  }

  if (state.status === "delivering") {
    return (
      <DeliverySection
        stateClass="state-delivering"
        title="Delivery in progress"
      >
        <TargetSummary target={state.target} />
        <p role="status">
          The durable intent exists and this local server is invoking the one
          configured transport. Do not submit another attempt.
        </p>
      </DeliverySection>
    );
  }

  if (state.status === "delivered") {
    const evidence = state.delivery.outcome?.evidence;
    return (
      <DeliverySection stateClass="state-delivered" title="Delivered">
        <TargetSummary target={state.target} />
        <p role="status">
          {evidence?.kind === "answer_file_created"
            ? "The private answer file was created without overwriting an existing target."
            : "The terminal accepted one comment-prefixed decision line. Agent handling is not confirmed."}
        </p>
        <DeliveryEvidence state={state} />
      </DeliverySection>
    );
  }

  const unknown = state.status === "unknown";
  return (
    <DeliverySection
      stateClass={unknown ? "state-unknown" : "state-failed"}
      title={unknown ? "Delivery outcome unknown" : "Delivery failed"}
    >
      <TargetSummary target={state.target} />
      <p role="alert">{state.error?.message}</p>
      <p>
        {unknown
          ? "The side effect may have occurred. Pacium will not retry this immutable attempt."
          : "The attempt is recorded and will not be retried automatically."}
      </p>
    </DeliverySection>
  );
}

function DeliverySection({
  children,
  stateClass,
  title,
}: {
  children: ReactNode;
  stateClass: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby="queue-delivery-title"
      className={`queue-delivery-panel ${stateClass}`}
    >
      <div className="inspector-section-heading">
        <h3 id="queue-delivery-title">{title}</h3>
        <span>Explicit action</span>
      </div>
      {children}
    </section>
  );
}

function TargetSummary({ target }: { target: QueueDeliveryTarget | null }) {
  if (target === null) {
    return null;
  }
  return (
    <dl className="metadata queue-delivery-target">
      <div>
        <dt>Method</dt>
        <dd>{target.methodLabel}</dd>
      </div>
      {target.type === "answer_file" ? (
        <div>
          <dt>Answer file</dt>
          <dd>
            <code>{target.path}</code>
          </dd>
        </div>
      ) : (
        <>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel(target.role)}</dd>
          </div>
          <div>
            <dt>Live session</dt>
            <dd>
              <code>{target.sessionId}</code> · epoch {target.sessionEpoch}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}

function DeliveryEvidence({ state }: { state: QueueDeliveryState }) {
  if (state.status !== "delivered") {
    return null;
  }
  const outcome = state.delivery.outcome;
  if (outcome?.status !== "delivered" || outcome.evidence === null) {
    return null;
  }
  return (
    <dl className="metadata queue-delivery-evidence">
      <div>
        <dt>Recorded</dt>
        <dd>
          <time dateTime={outcome.recordedAt}>
            {formatTimestamp(outcome.recordedAt)}
          </time>
        </dd>
      </div>
      <div>
        <dt>Payload</dt>
        <dd>{outcome.evidence.byteLength} bytes</dd>
      </div>
      <div>
        <dt>Content hash</dt>
        <dd>
          <code>{outcome.evidence.contentHash}</code>
        </dd>
      </div>
    </dl>
  );
}

function confirmationCopy(
  target: QueueDeliveryTarget,
  decision: QueueDecisionRecord,
): string {
  const decisionLabel =
    decision.kind === "question_answer"
      ? "recorded answer"
      : "recorded outcome";
  return target.type === "answer_file"
    ? `Create one private answer file containing this ${decisionLabel} at ${target.path}. An existing target will not be overwritten.`
    : `Send this ${decisionLabel} as one inert, comment-prefixed decision line to the current ${roleLabel(target.role)} session. Terminal acceptance does not confirm agent handling.`;
}

function roleLabel(role: "meta" | "orchestrator"): string {
  return role === "meta" ? "Meta" : "Orchestrator";
}

function formatTimestamp(iso: string): string {
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime())
    ? "Unavailable"
    : timestamp.toLocaleString();
}
