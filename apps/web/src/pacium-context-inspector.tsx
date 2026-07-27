import { useEffect, useRef, type KeyboardEvent } from "react";
import type {
  PaciumContextSourceObservation,
  PaciumRecentDecisionSummary,
} from "@pacium/contracts";

import type { PaciumContextViewState } from "./pacium-context-model.js";

export function PaciumContextInspector({
  state,
  onBack,
  onRefresh,
}: {
  state: PaciumContextViewState;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const observation =
    state.observation?.status === "ready" ||
    state.observation?.status === "partial"
      ? state.observation
      : null;
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onBack();
    }
  };
  return (
    <section
      aria-labelledby="pacium-context-title"
      className="pacium-context-inspector"
      onKeyDown={handleKeyDown}
    >
      <div className="pacium-context-toolbar">
        <button
          aria-label="Back to session inspector"
          onClick={onBack}
          type="button"
        >
          ← Back
        </button>
        <button
          disabled={state.status === "loading"}
          onClick={onRefresh}
          type="button"
        >
          {state.status === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <header className="pacium-context-heading">
        <span>Control context</span>
        <h2 id="pacium-context-title" ref={headingRef} tabIndex={-1}>
          Objective, plan, and decisions
        </h2>
        <p>
          Configured files and immutable local evidence only. Pacium does not
          infer tasks, progress, or resulting work.
        </p>
      </header>

      {state.status === "loading" && observation === null && (
        <p aria-live="polite" className="inspector-empty">
          Reading the two accepted context sources and recent local decisions.
          Terminals remain available.
        </p>
      )}
      {state.status === "error" && observation === null && (
        <section className="pacium-context-error" role="status">
          <h3>Context unavailable</h3>
          <p>{state.error ?? "Control context could not be inspected."}</p>
          <p>No terminal, configured source, or queue state was changed.</p>
        </section>
      )}
      {observation !== null && (
        <>
          {state.status === "loading" && (
            <p aria-live="polite" className="pacium-context-refreshing">
              Refreshing. Prior accepted evidence remains visible.
            </p>
          )}
          <ContextSourceSection
            source={observation.objective}
            text={state.objectiveText}
          />
          <ContextSourceSection
            source={observation.plan}
            text={state.planText}
          />
          <RecentDecisions
            state={observation.recentDecisions}
            workspaceId={observation.workspaceId}
          />
          <footer className="pacium-context-freshness">
            <span>
              Workspace revision {observation.workspaceRevision} · observed{" "}
              {formatTime(observation.observedAt)}
            </span>
            {observation.status === "partial" && (
              <strong>Partial evidence</strong>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

function ContextSourceSection({
  source,
  text,
}: {
  source: PaciumContextSourceObservation;
  text: string | null;
}) {
  const title = source.kind === "objective" ? "Objective" : "Plan";
  return (
    <section
      aria-labelledby={`pacium-context-${source.kind}`}
      className={`pacium-context-source status-${source.status}`}
    >
      <div className="inspector-section-heading">
        <h3 id={`pacium-context-${source.kind}`}>{title}</h3>
        <span>{sourceStatusLabel(source.status)}</span>
      </div>
      {source.status === "unconfigured" ? (
        <p>
          No {source.kind} file is configured. Pacium did not choose another
          path.
        </p>
      ) : (
        <>
          <dl>
            <Metadata label="Path" value={source.path} />
            <Metadata label="Observed" value={formatTime(source.observedAt)} />
            {source.modifiedAt !== null && (
              <Metadata
                label="Modified"
                value={formatTime(source.modifiedAt)}
              />
            )}
            {source.byteLength !== null && (
              <Metadata
                label="Bytes"
                value={source.byteLength.toLocaleString()}
              />
            )}
            {source.contentHash !== null && (
              <Metadata label="SHA-256" value={shortHash(source.contentHash)} />
            )}
          </dl>
          {source.status === "ready" && text !== null ? (
            <pre className="pacium-context-text">{text}</pre>
          ) : source.status === "empty" ? (
            <p>The configured file is empty. Pacium did not invent context.</p>
          ) : (
            <p>
              {source.error?.message ??
                "The configured context text is unavailable."}{" "}
              Repair the configured file outside Pacium and Refresh.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function RecentDecisions({
  state,
  workspaceId,
}: {
  state: Extract<
    NonNullable<
      Extract<
        PaciumContextViewState["observation"],
        { status: "ready" | "partial" }
      >
    >,
    { status: "ready" | "partial" }
  >["recentDecisions"];
  workspaceId: string;
}) {
  return (
    <section
      aria-labelledby="pacium-recent-decisions"
      className={`pacium-recent-decisions status-${state.status}`}
    >
      <div className="inspector-section-heading">
        <h3 id="pacium-recent-decisions">Recent decisions</h3>
        <span>
          {state.status === "ready" ? state.decisions.length : "Unavailable"}
        </span>
      </div>
      <p>
        Local decisions, transport attempts, and human labels are separate
        evidence. They do not prove provider handling or resulting Git work.
      </p>
      {state.status === "unavailable" ? (
        <p>{state.error.message}</p>
      ) : state.decisions.length === 0 ? (
        <p>No immutable local decisions are recorded for this profile.</p>
      ) : (
        <ol>
          {state.decisions.map((decision) => (
            <DecisionCard
              decision={decision}
              key={decision.decisionId}
              workspaceId={workspaceId}
            />
          ))}
        </ol>
      )}
      {state.status === "ready" && state.truncated && (
        <p>Only the 12 newest immutable decisions are shown.</p>
      )}
    </section>
  );
}

function DecisionCard({
  decision,
  workspaceId,
}: {
  decision: PaciumRecentDecisionSummary;
  workspaceId: string;
}) {
  const sourceLabel =
    decision.sourceLabel ??
    `Former source ${shortIdentifier(decision.sourceId)}`;
  return (
    <li>
      <article className="pacium-recent-decision">
        <header>
          <span>
            {decision.response.kind === "question_answer"
              ? "Question answered"
              : decision.response.outcome === "approved"
                ? "Approval granted"
                : "Approval denied"}
          </span>
          <time dateTime={decision.decidedAt}>
            {formatTime(decision.decidedAt)}
          </time>
        </header>
        {decision.response.kind === "question_answer" && (
          <blockquote>
            {decision.response.preview}
            {decision.response.truncated && (
              <span aria-label="Answer preview truncated">…</span>
            )}
          </blockquote>
        )}
        <dl>
          <Metadata
            label="Source"
            value={`${sourceLabel}${decision.sourceCurrent ? "" : " · no longer configured"}`}
          />
          <Metadata
            label="Decision"
            value={shortIdentifier(decision.decisionId)}
          />
          <Metadata
            label="Workspace"
            value={
              decision.workspaceId === workspaceId
                ? workspaceId
                : `${decision.workspaceId} · former`
            }
          />
          <Metadata label="Transport" value={deliveryLabel(decision)} />
          <Metadata label="Lifecycle" value={lifecycleLabel(decision)} />
        </dl>
      </article>
    </li>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function sourceStatusLabel(
  status: PaciumContextSourceObservation["status"],
): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "empty":
      return "Empty";
    case "unconfigured":
      return "Not configured";
    case "missing":
      return "Missing";
    case "changing":
      return "Changing";
    case "oversized":
      return "Too large";
    case "invalid_utf8":
      return "Invalid UTF-8";
    case "unsafe_type":
      return "Unsafe type";
    case "unreadable":
      return "Unreadable";
  }
}

function deliveryLabel(decision: PaciumRecentDecisionSummary): string {
  const delivery = decision.delivery;
  if (delivery === null) {
    return "Not attempted";
  }
  const status =
    delivery.status === "delivering"
      ? "Transport in progress"
      : delivery.status === "delivered"
        ? delivery.evidenceKind === "answer_file_created"
          ? "Answer artifact created"
          : "Terminal transport accepted"
        : delivery.status === "failed"
          ? "Transport failed"
          : "Transport outcome unknown";
  return `${status} · attempt ${delivery.attemptCount} of 2 maximum`;
}

function lifecycleLabel(decision: PaciumRecentDecisionSummary): string {
  const lifecycle = decision.lifecycle;
  if (lifecycle === null) {
    return "Provider unavailable · no human label";
  }
  return `${lifecycleActionLabel(lifecycle.action)} · human labelled · ${formatTime(
    lifecycle.recordedAt,
  )}`;
}

function lifecycleActionLabel(
  action: NonNullable<PaciumRecentDecisionSummary["lifecycle"]>["action"],
): string {
  switch (action) {
    case "acknowledged":
      return "Acknowledged";
    case "applied":
      return "Applied";
    case "unable_to_apply":
      return "Unable to apply";
    case "confirmed_not_delivered":
      return "Confirmed not delivered";
    case "superseded":
      return "Superseded";
  }
}

function shortIdentifier(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "time unavailable"
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
