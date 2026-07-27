import {
  attentionConfidenceLabel,
  attentionSourceLabel,
  attentionStateLabel,
} from "./attention-model.js";
import type {
  ActivityFact,
  ActivitySourceSummary,
  RecentActivity,
} from "./recent-activity-model.js";

export function RecentActivityPanel({
  activity,
  onRefresh,
}: {
  activity: RecentActivity | null;
  onRefresh: () => void;
}) {
  if (activity === null) {
    return (
      <section
        aria-labelledby="inspector-activity-tab"
        className="recent-activity-panel"
        id="inspector-activity-panel"
        role="tabpanel"
        tabIndex={0}
      >
        <header>
          <span>
            <strong>Recent activity</strong>
            <small>No terminal selected</small>
          </span>
          <button disabled type="button">
            Refresh
          </button>
        </header>
        <p className="activity-empty" role="status">
          Select or create a terminal to inspect its local activity evidence.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="inspector-activity-tab"
      className="recent-activity-panel"
      id="inspector-activity-panel"
      role="tabpanel"
      tabIndex={0}
    >
      <header>
        <span>
          <strong>Recent activity</strong>
          <small>{activitySummary(activity)}</small>
        </span>
        <button disabled={activity.loading} onClick={onRefresh} type="button">
          {activity.loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section
        aria-labelledby="activity-current-heading"
        className="activity-section"
      >
        <h2 id="activity-current-heading">Current evidence</h2>
        <div className="activity-current-grid">
          <article className="activity-current-card">
            <header>
              <span>Attention</span>
              <strong>
                {attentionStateLabel(activity.current.attention.state)}
              </strong>
            </header>
            <p>{activity.current.attention.reason}</p>
            <footer>
              <span>
                {attentionSourceLabel(activity.current.attention.source)}
              </span>
              <span>
                {attentionConfidenceLabel(
                  activity.current.attention.confidence,
                )}
              </span>
              <EvidenceTime
                meaning="observed"
                timestamp={activity.current.attention.observedAt}
              />
            </footer>
          </article>
          <article className="activity-current-card">
            <header>
              <span>Process</span>
              <strong>{activity.current.processState}</strong>
            </header>
            <p>{activity.current.processDetail}</p>
            <footer>
              <span>Process observed</span>
              <span>Not task narration</span>
            </footer>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="activity-facts-heading"
        className="activity-section"
      >
        <h2 id="activity-facts-heading">Recent facts</h2>
        {activity.facts.length === 0 ? (
          <p className="activity-empty" role="status">
            No valid recent process, Git, or verification facts are available.
          </p>
        ) : (
          <ol className="activity-fact-list">
            {activity.facts.map((fact) => (
              <ActivityFactRow fact={fact} key={fact.id} />
            ))}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="activity-sources-heading"
        className="activity-section activity-sources"
      >
        <h2 id="activity-sources-heading">Evidence sources</h2>
        <ul>
          {activity.sources.map((source) => (
            <ActivitySourceRow key={source.id} source={source} />
          ))}
        </ul>
        {activity.partial && (
          <p className="activity-partial-note" role="note">
            Some evidence is not available. The selected terminal remains
            available.
          </p>
        )}
      </section>

      <p className="activity-boundary-note" role="note">
        Deterministic local facts only. Terminal text and agent narrative are
        not interpreted as activity.
      </p>
    </section>
  );
}

function ActivityFactRow({ fact }: { fact: ActivityFact }) {
  return (
    <li>
      <article>
        <header>
          <span>{sourceLabel(fact.source)}</span>
          <EvidenceTime
            meaning={fact.timestampMeaning}
            timestamp={fact.timestamp}
          />
        </header>
        <strong>{fact.title}</strong>
        <p>{fact.detail}</p>
      </article>
    </li>
  );
}

function ActivitySourceRow({ source }: { source: ActivitySourceSummary }) {
  return (
    <li className={`is-${source.status}`}>
      <span>
        <strong>{source.label}</strong>
        <small>{source.detail}</small>
      </span>
      <span>{sourceStatusLabel(source.status)}</span>
    </li>
  );
}

function EvidenceTime({
  meaning,
  timestamp,
}: {
  meaning: "occurred" | "observed";
  timestamp: string;
}) {
  return (
    <time dateTime={timestamp} title={timestamp}>
      {meaning === "observed" ? "Observed" : "Occurred"}{" "}
      {new Date(timestamp).toLocaleTimeString()}
    </time>
  );
}

function activitySummary(activity: RecentActivity): string {
  if (activity.loading) {
    return activity.facts.length > 0
      ? "Refreshing bounded local evidence"
      : "Reading bounded local evidence";
  }
  if (activity.partial) {
    return `${activity.facts.length} ${plural(activity.facts.length, "fact")} · partial evidence`;
  }
  return `${activity.facts.length} ${plural(activity.facts.length, "fact")} · fully inspected`;
}

function sourceLabel(source: ActivityFact["source"]): string {
  switch (source) {
    case "process":
      return "Process";
    case "git":
      return "Git";
    case "verification":
      return "Verification";
  }
}

function sourceStatusLabel(status: ActivitySourceSummary["status"]): string {
  switch (status) {
    case "idle":
      return "Not read";
    case "loading":
      return "Reading";
    case "ready":
      return "Ready";
    case "empty":
      return "No evidence";
    case "unavailable":
      return "Unavailable";
    case "error":
      return "Error";
  }
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
