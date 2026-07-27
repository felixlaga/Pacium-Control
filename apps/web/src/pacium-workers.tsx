import type {
  PaciumWorkerModel,
  PaciumWorkersProjection,
} from "./pacium-worker-model.js";

export function PaciumWorkers({
  projection,
  onOpen,
}: {
  projection: PaciumWorkersProjection;
  onOpen: (sessionId: string) => void;
}) {
  return (
    <section
      aria-labelledby="pacium-workers-heading"
      className="pacium-workers"
    >
      <div className="section-heading">
        <span id="pacium-workers-heading">Workers</span>
        <span>{projection.workers.length}</span>
      </div>
      {projection.status !== "ready" || projection.workers.length === 0 ? (
        <p className={`pacium-workers-empty status-${projection.status}`}>
          {projection.detail}
        </p>
      ) : (
        <>
          <p className="pacium-workers-boundary">{projection.detail}</p>
          <ul className="pacium-worker-list">
            {projection.workers.map((worker) => (
              <li key={worker.id}>
                <PaciumWorkerRow
                  model={worker}
                  onOpen={() => {
                    if (worker.sessionId !== null && worker.canOpen) {
                      onOpen(worker.sessionId);
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PaciumWorkerRow({
  model,
  onOpen,
}: {
  model: PaciumWorkerModel;
  onOpen: () => void;
}) {
  return (
    <article
      aria-label={`${model.label} worker, ${model.statusLabel}, attention ${model.attentionLabel}`}
      className={`pacium-worker-row status-${model.status}`}
    >
      <header>
        <span aria-hidden="true" className="pacium-worker-glyph">
          W
        </span>
        <span>
          <strong>{model.label}</strong>
          <small>{model.statusLabel}</small>
        </span>
        {model.canOpen && (
          <button onClick={onOpen} type="button">
            Open
          </button>
        )}
      </header>
      <dl>
        <Evidence
          detail={model.commandEvidence}
          label="Runtime"
          value={model.commandLabel}
        />
        <Evidence
          detail={model.repositoryEvidence}
          label="Repository"
          value={model.repositoryLabel}
        />
        <Evidence
          detail={model.attentionEvidence}
          label="Attention"
          value={model.attentionLabel}
        />
        <Evidence
          detail={model.changesEvidence}
          label="Changes"
          value={model.changesLabel}
        />
      </dl>
      {model.attentionObservedAt !== null && (
        <time dateTime={model.attentionObservedAt}>
          Attention observed {formatTime(model.attentionObservedAt)}
        </time>
      )}
    </article>
  );
}

function Evidence({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div title={detail}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <span className="visually-hidden">{detail}</span>
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "at an unavailable time"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
