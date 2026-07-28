import { useEffect, useState } from "react";
import type { TerminalTextExcerpt } from "@pacium/terminal-ui";

import {
  attentionConfidenceLabel,
  attentionSourceLabel,
  attentionStateLabel,
} from "./attention-model.js";
import type {
  ActivityFact,
  ActivityFactKind,
  ActivityFactTarget,
  ActivitySourceSummary,
  RecentActivity,
} from "./recent-activity-model.js";
import { ProviderStatusPanel } from "./provider-status.js";

export function RecentActivityPanel({
  activity,
  connectionBoundary,
  onOpenSource,
  onReadTerminalExcerpt,
  onRefresh,
}: {
  activity: RecentActivity | null;
  connectionBoundary: string;
  onOpenSource: (target: ActivityFactTarget) => void;
  onReadTerminalExcerpt: () => TerminalTextExcerpt | null;
  onRefresh: () => void;
}) {
  const [terminalExcerpt, setTerminalExcerpt] = useState<
    TerminalTextExcerpt | "unavailable" | null
  >(null);
  const fallbackBoundary = `${connectionBoundary}:${
    activity?.terminalFallback.boundaryKey ?? "no-session"
  }`;

  useEffect(() => {
    setTerminalExcerpt(null);
  }, [fallbackBoundary]);

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

      {activity.providerStatus !== null && (
        <ProviderStatusPanel
          onOpenTerminal={() => onOpenSource("terminal")}
          status={activity.providerStatus}
        />
      )}

      <section
        aria-labelledby="activity-facts-heading"
        className="activity-section"
      >
        <h2 id="activity-facts-heading">Recent facts</h2>
        {activity.facts.length === 0 ? (
          <p className="activity-empty" role="status">
            No valid recent provider, process, Git, or verification facts are
            available.
          </p>
        ) : (
          <ol className="activity-fact-list">
            {activity.facts.map((fact) => (
              <ActivityFactRow
                fact={fact}
                key={fact.id}
                onOpenSource={onOpenSource}
              />
            ))}
          </ol>
        )}
      </section>

      {activity.terminalFallback.recommended && (
        <section
          aria-labelledby="activity-terminal-fallback-heading"
          className="activity-section activity-terminal-fallback"
        >
          <header>
            <span>
              <h2 id="activity-terminal-fallback-heading">Terminal fallback</h2>
              <p>{activity.terminalFallback.reason}</p>
            </span>
            {terminalExcerpt === null ? (
              <button
                onClick={() => {
                  setTerminalExcerpt(onReadTerminalExcerpt() ?? "unavailable");
                }}
                type="button"
              >
                Show recent terminal text
              </button>
            ) : (
              <span className="activity-terminal-fallback-actions">
                <button
                  onClick={() => {
                    setTerminalExcerpt(
                      onReadTerminalExcerpt() ?? "unavailable",
                    );
                  }}
                  type="button"
                >
                  Refresh excerpt
                </button>
                <button onClick={() => setTerminalExcerpt(null)} type="button">
                  Hide
                </button>
              </span>
            )}
          </header>
          {terminalExcerpt !== null && (
            <TerminalFallbackResult result={terminalExcerpt} />
          )}
        </section>
      )}

      <section
        aria-labelledby="activity-sources-heading"
        className="activity-section activity-sources"
      >
        <h2 id="activity-sources-heading">Evidence sources</h2>
        <ul>
          {activity.sources
            .filter(({ id }) => id !== "provider")
            .map((source) => (
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
        Validated local evidence only. Terminal text and agent narrative are not
        interpreted as activity.
      </p>
    </section>
  );
}

function ActivityFactRow({
  fact,
  onOpenSource,
}: {
  fact: ActivityFact;
  onOpenSource: (target: ActivityFactTarget) => void;
}) {
  return (
    <li>
      <article className={`activity-card is-${fact.tone} is-${fact.kind}`}>
        <header>
          <span className="activity-card-kind">
            <i aria-hidden="true" />
            {activityKindLabel(fact.kind)}
          </span>
          <EvidenceTime
            meaning={fact.timestampMeaning}
            timestamp={fact.timestamp}
          />
        </header>
        <strong>{fact.title}</strong>
        <p>{fact.detail}</p>
        <footer>
          <span className="activity-card-metadata">
            {fact.metadata.map((item) => (
              <small key={item}>{item}</small>
            ))}
          </span>
          <button
            aria-label={`Open ${targetLabel(fact.target)} source for ${fact.title}`}
            onClick={() => onOpenSource(fact.target)}
            type="button"
          >
            {targetLabel(fact.target)}
          </button>
        </footer>
      </article>
    </li>
  );
}

export function TerminalFallbackResult({
  result,
}: {
  result: TerminalTextExcerpt | "unavailable";
}) {
  if (result === "unavailable") {
    return (
      <p className="activity-terminal-fallback-state" role="status">
        The rendered terminal buffer is unavailable. Open this terminal and try
        again; its process state is unchanged.
      </p>
    );
  }
  if (result.status === "empty") {
    return (
      <p className="activity-terminal-fallback-state" role="status">
        No non-empty recent terminal text is available. No agent state was
        inferred.
      </p>
    );
  }
  return (
    <div className="activity-terminal-excerpt">
      <span aria-label="Terminal excerpt evidence labels">
        <small>Terminal-derived</small>
        <small>Low confidence</small>
        <small>Not interpreted</small>
        <small>
          {result.lineCount} {plural(result.lineCount, "line")}
          {result.truncated ? " · bounded" : ""}
        </small>
      </span>
      <pre>{result.text}</pre>
    </div>
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

function activityKindLabel(kind: ActivityFactKind): string {
  switch (kind) {
    case "process_started":
    case "process_exited":
      return "Process";
    case "provider_session":
      return "Session";
    case "provider_prompt":
      return "Prompt";
    case "provider_turn":
      return "Turn";
    case "provider_message":
      return "Message";
    case "provider_tool":
      return "Tool";
    case "provider_plan":
      return "Plan";
    case "provider_approval":
      return "Approval";
    case "provider_question":
      return "Question";
    case "provider_usage":
      return "Usage";
    case "provider_completion":
      return "Completion";
    case "provider_failure":
      return "Failure";
    case "git_changes":
      return "Working tree";
    case "git_commit":
      return "Commit";
    case "verification":
      return "Check";
  }
}

function targetLabel(target: ActivityFactTarget): string {
  switch (target) {
    case "terminal":
      return "Terminal";
    case "changes":
      return "Changes";
    case "history":
      return "History";
    case "checks":
      return "Checks";
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
    case "degraded":
      return "Degraded";
    case "stale":
      return "Stale";
    case "error":
      return "Error";
  }
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
