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
        <ul className="pacium-worker-list" title={projection.detail}>
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
      title={`${model.commandLabel} · ${model.repositoryLabel} · ${model.attentionLabel} · ${model.changesLabel}`}
    >
      <header>
        <span aria-hidden="true" className="pacium-worker-glyph">
          W
        </span>
        <span>
          <strong>{model.label}</strong>
          <small>
            {model.statusLabel} · {model.attentionLabel}
          </small>
        </span>
        {model.canOpen && (
          <button onClick={onOpen} type="button">
            Open
          </button>
        )}
      </header>
      <span className="visually-hidden">
        {model.commandEvidence} {model.repositoryEvidence}{" "}
        {model.attentionEvidence} {model.changesEvidence}
      </span>
    </article>
  );
}
