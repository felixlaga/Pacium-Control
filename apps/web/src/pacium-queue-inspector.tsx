import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type {
  QueueApprovalDecisionPayload,
  QueueQuestionAnswerPayload,
} from "@pacium/contracts";

import { PaciumQueueDecisionPanel } from "./pacium-queue-decision-panel.js";
import type { PaciumQueueInspectionState } from "./pacium-queue-inspection-model.js";
import {
  confidenceLabel,
  queueItemTypeLabel,
  queueWaitingLabel,
  requestingRoleLabel,
} from "./pacium-queue-model.js";

export function PaciumQueueInspector({
  onBack,
  onDeliver,
  onRecordApproval,
  onRecordQuestion,
  requestingSessionLabel,
  state,
}: {
  onBack: () => void;
  onDeliver: () => void;
  onRecordApproval: (payload: QueueApprovalDecisionPayload) => void;
  onRecordQuestion: (payload: QueueQuestionAnswerPayload) => void;
  requestingSessionLabel: string | null;
  state: PaciumQueueInspectionState;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selection = state.selection;

  useEffect(() => {
    headingRef.current?.focus();
  }, [selection?.identity.itemId]);

  if (selection === null) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") {
      return;
    }
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    onBack();
  };

  return (
    <section
      aria-labelledby="queue-item-inspector-title"
      className={`pacium-queue-inspector status-${state.status}`}
      onKeyDown={handleKeyDown}
    >
      <header className="pacium-queue-inspector-heading">
        <button onClick={onBack} type="button">
          ← Back
        </button>
        <span>
          <small>Queue item · exact local decision</small>
          <h2 id="queue-item-inspector-title" ref={headingRef} tabIndex={-1}>
            {queueItemTypeLabel(selection.type)} from {selection.sourceLabel}
          </h2>
        </span>
        <span className={`queue-type-badge type-${selection.type}`}>
          {queueItemTypeLabel(selection.type)}
        </span>
      </header>

      {state.status === "loading" ? (
        <QueueInspectorMessage>
          Reading this exact current item. The terminal and source file remain
          unchanged.
        </QueueInspectorMessage>
      ) : state.status === "ready" && state.originalText !== null ? (
        <>
          <section
            aria-labelledby="queue-original-text-title"
            className="queue-original-text"
          >
            <div className="inspector-section-heading">
              <h3 id="queue-original-text-title">Original source text</h3>
              <span>{formatBytes(state.inspection?.byteLength ?? 0)}</span>
            </div>
            <pre data-testid="queue-original-text">{state.originalText}</pre>
            <p>
              Displayed as inert text. Links, markup, terminal escapes, and
              commands are not interpreted.
            </p>
          </section>
          <QueueMeaning
            requestingSessionLabel={requestingSessionLabel}
            state={state}
          />
          <PaciumQueueDecisionPanel
            onDeliver={onDeliver}
            onRecordApproval={onRecordApproval}
            onRecordQuestion={onRecordQuestion}
            state={state}
          />
        </>
      ) : (
        <QueueInspectorMessage tone="error">
          {state.errorMessage ??
            "Current queue text is unavailable. The terminal and source file remain unchanged."}
        </QueueInspectorMessage>
      )}

      <section
        aria-labelledby="queue-provenance-title"
        className="queue-provenance"
      >
        <h3 id="queue-provenance-title">Source and provenance</h3>
        <dl className="metadata">
          <QueueMetadata label="Source">{selection.sourceLabel}</QueueMetadata>
          <QueueMetadata label="Path">
            <code>{selection.sourcePath}</code>
          </QueueMetadata>
          <QueueMetadata label="Source ID">
            <code>{selection.identity.sourceId}</code>
          </QueueMetadata>
          <QueueMetadata label="Workspace revision">
            {selection.identity.workspaceRevision}
          </QueueMetadata>
          <QueueMetadata label="Observation revision">
            {selection.identity.observationRevision}
          </QueueMetadata>
          <QueueMetadata label="Boundary">{selection.boundary}</QueueMetadata>
          <QueueMetadata label="Content hash">
            <code>{selection.identity.contentHash}</code>
          </QueueMetadata>
          <QueueMetadata label="Item ID">
            <code>{selection.identity.itemId}</code>
          </QueueMetadata>
          <QueueMetadata label="Observed">
            <time dateTime={selection.sourceObservedAt}>
              {formatTimestamp(selection.sourceObservedAt)}
            </time>
          </QueueMetadata>
        </dl>
      </section>

      <footer className="queue-inspector-safety">
        Question answers and approval decisions are separate immutable local
        records. Recording never delivers a prompt, writes an answer target, or
        runs the requested action.
      </footer>
    </section>
  );
}

function QueueMeaning({
  requestingSessionLabel,
  state,
}: {
  requestingSessionLabel: string | null;
  state: PaciumQueueInspectionState;
}) {
  const selection = state.selection!;
  return (
    <section aria-labelledby="queue-meaning-title" className="queue-meaning">
      <h3 id="queue-meaning-title">Current interpretation</h3>
      <dl className="metadata">
        <QueueMetadata label="Type">
          {queueItemTypeLabel(selection.type)}
        </QueueMetadata>
        <QueueMetadata label="Confidence">
          {confidenceLabel(selection.confidence)}
        </QueueMetadata>
        <QueueMetadata label="Requester">
          {requestingRoleLabel(selection.requestingRole)}
        </QueueMetadata>
        <QueueMetadata label="Requesting session">
          {requestingSessionLabel ?? "No exact live role session is linked"}
        </QueueMetadata>
        <QueueMetadata label="Waiting">
          <time
            dateTime={selection.firstObservedAt}
            title={`First observed ${formatTimestamp(selection.firstObservedAt)}`}
          >
            {queueWaitingLabel(selection.firstObservedAt)}
          </time>
        </QueueMetadata>
        <QueueMetadata label="Diagnostic">
          {selection.diagnostic ?? "Exact supported marker"}
        </QueueMetadata>
        <QueueMetadata label="Reason">
          Not provided by the whole-source adapter
        </QueueMetadata>
        <QueueMetadata label="Consequence">
          Not provided by the whole-source adapter
        </QueueMetadata>
        <QueueMetadata label="Recommendation">
          Not provided by the whole-source adapter
        </QueueMetadata>
        <QueueMetadata label="Related evidence">
          No terminal or Git evidence is linked yet
        </QueueMetadata>
        <QueueMetadata label="Conflict state">
          {state.reconciliation === null ||
          state.reconciliation.conflicts.length === 0
            ? "No current conflict signal"
            : `${state.reconciliation.conflicts.length} current conflict ${
                state.reconciliation.conflicts.length === 1
                  ? "signal"
                  : "signals"
              }`}
        </QueueMetadata>
      </dl>
    </section>
  );
}

function QueueInspectorMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div className={`queue-inspector-message tone-${tone}`} role="status">
      <span aria-hidden="true">{tone === "error" ? "!" : "…"}</span>
      <p>{children}</p>
    </div>
  );
}

function QueueMetadata({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime())
    ? "Unavailable"
    : timestamp.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  return `${Math.round((bytes / 1_024) * 10) / 10} KiB`;
}
