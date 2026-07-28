import type { QueueSourceObservationStatus } from "@pacium/contracts";

import {
  queueClassificationPresentation,
  queueItemTypeLabel,
  queueWaitingLabel,
  requestingRoleLabel,
  type PaciumQueueProjection,
} from "./pacium-queue-model.js";
import {
  queueItemSelection,
  type QueueItemSelection,
} from "./pacium-queue-inspection-model.js";

export function PaciumQueueSources({
  onOpenItem,
  projection,
  onRefresh,
}: {
  onOpenItem: (selection: QueueItemSelection) => void;
  projection: PaciumQueueProjection;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Pacium queue"
      className={`pacium-queue-sources status-${projection.status}`}
    >
      <div className="section-heading">
        <span>Queue</span>
        <span>{projection.itemCount}</span>
      </div>
      <div className="pacium-queue-source-list">
        {projection.sources.length === 0 ? (
          <p>{projection.message}</p>
        ) : (
          projection.sources.map(({ source, observation }) => {
            const status = observation?.status ?? "pending";
            const label = queueStatusLabel(status);
            const classification = queueClassificationPresentation(observation);
            const conflicts = observation?.conflicts ?? [];
            const selection = queueItemSelection(
              source,
              observation,
              projection.workspaceRevision,
            );
            const className = `pacium-queue-source status-${status}${
              classification === null
                ? ""
                : ` classification-${classification.kind}`
            }`;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className="pacium-queue-source-indicator"
                />
                <div>
                  <strong>
                    {selection === null
                      ? source.label
                      : `${queueItemTypeLabel(selection.type)} from ${
                          source.label
                        }`}
                  </strong>
                  <span>
                    {selection === null
                      ? `${label} · ${requestingRoleLabel(
                          source.requestingRole,
                        )}`
                      : `${requestingRoleLabel(source.requestingRole)} · ${queueWaitingLabel(
                          selection.firstObservedAt,
                        )}`}
                  </span>
                  {conflicts.length > 0 ? (
                    <small className="pacium-queue-conflict">Conflict</small>
                  ) : null}
                </div>
                {selection !== null ? (
                  <span aria-hidden="true" className="queue-row-chevron">
                    ›
                  </span>
                ) : null}
              </>
            );
            return selection === null ? (
              <article
                aria-label={`${source.label} queue source, ${label}${
                  classification === null ? "" : `, ${classification.label}`
                }`}
                className={className}
                key={source.id}
              >
                {content}
              </article>
            ) : (
              <button
                aria-label={`${queueItemTypeLabel(selection.type)} from ${
                  source.label
                }, ${requestingRoleLabel(source.requestingRole)}, ${
                  selection.confidence
                } confidence, ${queueWaitingLabel(selection.firstObservedAt)}${
                  conflicts.length === 0
                    ? ""
                    : `, ${conflicts.length} conflict ${
                        conflicts.length === 1 ? "signal" : "signals"
                      }`
                }`}
                className={`${className} pacium-queue-item`}
                disabled={projection.disconnected}
                id={`queue-item-${source.id}`}
                key={source.id}
                onClick={() => onOpenItem(selection)}
                type="button"
              >
                {content}
              </button>
            );
          })
        )}
      </div>
      <footer>
        <button
          disabled={!projection.canRefresh}
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
      </footer>
    </section>
  );
}

function queueStatusLabel(status: QueueSourceObservationStatus): string {
  switch (status) {
    case "pending":
      return "Reading";
    case "stable":
      return "Stable";
    case "empty":
      return "Empty";
    case "missing":
      return "Missing";
    case "changing":
      return "Changing";
    case "oversized":
      return "Oversized";
    case "invalid_utf8":
      return "Invalid text";
    case "unsafe_type":
      return "Unsafe file";
    case "read_error":
      return "Read error";
    case "watch_error":
      return "Watch error";
  }
}
