import type { QueueSourceObservationStatus } from "@pacium/contracts";

import type { PaciumQueueProjection } from "./pacium-queue-model.js";

export function PaciumQueueSources({
  projection,
  onRefresh,
}: {
  projection: PaciumQueueProjection;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Queue source observation"
      className={`pacium-queue-sources status-${projection.status}`}
    >
      <div className="section-heading">
        <span>Queue sources</span>
        <span>{projection.sources.length}</span>
      </div>
      <div className="pacium-queue-source-list">
        {projection.sources.length === 0 ? (
          <p>{projection.message}</p>
        ) : (
          projection.sources.map(({ source, observation }) => {
            const status = observation?.status ?? "pending";
            const label = queueStatusLabel(status);
            return (
              <article
                aria-label={`${source.label} queue source, ${label}`}
                className={`pacium-queue-source status-${status}`}
                key={source.id}
              >
                <span
                  aria-hidden="true"
                  className="pacium-queue-source-indicator"
                />
                <div>
                  <strong>{source.label}</strong>
                  <span>
                    {label} · {requestingRoleLabel(source.requestingRole)}
                  </span>
                  <small title={source.path}>
                    {sourceEvidenceDetail(observation)}
                  </small>
                </div>
              </article>
            );
          })
        )}
      </div>
      <footer>
        <span>{projection.message}</span>
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

function requestingRoleLabel(role: "meta" | "orchestrator" | "unknown") {
  return role === "meta"
    ? "Meta"
    : role === "orchestrator"
      ? "Orchestrator"
      : "Unknown requester";
}

function sourceEvidenceDetail(
  observation: PaciumQueueProjection["sources"][number]["observation"],
): string {
  if (observation === null) {
    return "Waiting for current source evidence";
  }
  if (observation.error !== null) {
    return observation.error.message;
  }
  const hash =
    observation.contentHash === null
      ? null
      : observation.contentHash.slice(0, 8);
  if (observation.byteLength !== null && hash !== null) {
    return `${formatBytes(observation.byteLength)} · ${hash} · observed`;
  }
  if (observation.byteLength !== null) {
    return `${formatBytes(observation.byteLength)} · observed`;
  }
  return `Observed ${observation.observedAt}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  return `${Math.round((bytes / 1_024) * 10) / 10} KiB`;
}
