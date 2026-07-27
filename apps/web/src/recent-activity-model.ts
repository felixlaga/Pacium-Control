import type { SessionSummary } from "@pacium/contracts";

import type { AttentionResult } from "./attention-model.js";
import type { RepositoryChangesViewState } from "./repository-changes-model.js";
import type { RepositoryHistoryViewState } from "./repository-history-model.js";
import type { RepositoryVerificationViewState } from "./repository-verification-model.js";

export const MAX_RECENT_ACTIVITY_COMMITS = 3;
export const MAX_RECENT_ACTIVITY_FACTS = 8;

export type ActivityFactSource = "process" | "git" | "verification";
export type ActivityTimestampMeaning = "occurred" | "observed";
export type ActivitySourceId = "changes" | "history" | "verification";
export type ActivitySourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "error";

export interface ActivityCurrentEvidence {
  attention: AttentionResult;
  processState: SessionSummary["processState"];
  processDetail: string;
}

export interface ActivityFact {
  id: string;
  source: ActivityFactSource;
  title: string;
  detail: string;
  timestamp: string;
  timestampMeaning: ActivityTimestampMeaning;
}

export interface ActivitySourceSummary {
  id: ActivitySourceId;
  label: string;
  status: ActivitySourceStatus;
  detail: string;
}

export interface RecentActivity {
  current: ActivityCurrentEvidence;
  facts: ActivityFact[];
  sources: ActivitySourceSummary[];
  loading: boolean;
  partial: boolean;
}

export interface RecentActivityInput {
  session: SessionSummary;
  attention: AttentionResult;
  changes: RepositoryChangesViewState;
  history: RepositoryHistoryViewState;
  verification: RepositoryVerificationViewState;
}

export function buildRecentActivity(input: RecentActivityInput): RecentActivity {
  const facts = processFacts(input.session);
  const sources = sourceLoadingSummaries(input);
  return {
    current: {
      attention: input.attention,
      processState: input.session.processState,
      processDetail: processDetail(input.session),
    },
    facts: facts.slice(0, MAX_RECENT_ACTIVITY_FACTS),
    sources,
    loading: sources.some(({ status }) => status === "loading"),
    partial: sources.some(
      ({ status }) => status === "idle" || status === "error",
    ),
  };
}

function processFacts(session: SessionSummary): ActivityFact[] {
  const facts: ActivityFact[] = [];
  if (validTimestamp(session.createdAt)) {
    facts.push({
      id: `process:${session.id}:${session.epoch}:started`,
      source: "process",
      title: "Terminal process started",
      detail: "Pacium created this direct PTY process.",
      timestamp: session.createdAt,
      timestampMeaning: "occurred",
    });
  }
  if (session.exitedAt !== null && validTimestamp(session.exitedAt)) {
    facts.push({
      id: `process:${session.id}:${session.epoch}:exited`,
      source: "process",
      title: "Terminal process exited",
      detail: processExitDetail(session),
      timestamp: session.exitedAt,
      timestampMeaning: "occurred",
    });
  }
  return facts.toSorted(compareActivityFacts);
}

function processDetail(session: SessionSummary): string {
  if (session.processState === "live") {
    return "Process is live; assigned-task activity is unverified.";
  }
  if (session.processState === "creating") {
    return "Process launch is pending; assigned-task activity is unverified.";
  }
  return processExitDetail(session);
}

function processExitDetail(session: SessionSummary): string {
  if (session.exitSignal !== null) {
    return `Process ended from signal ${session.exitSignal}; task outcome is unverified.`;
  }
  if (session.exitCode !== null) {
    return `Process exited with code ${session.exitCode}; task outcome is unverified.`;
  }
  return "Process ended without exit evidence; task outcome is unknown.";
}

function sourceLoadingSummaries({
  changes,
  history,
  verification,
}: RecentActivityInput): ActivitySourceSummary[] {
  return [
    loadingSummary("changes", "Git changes", changes.status),
    loadingSummary("history", "Git history", history.status),
    loadingSummary("verification", "Verification", verification.status),
  ];
}

function loadingSummary(
  id: ActivitySourceId,
  label: string,
  state: "idle" | "loading" | "loaded",
): ActivitySourceSummary {
  if (state === "idle") {
    return {
      id,
      label,
      status: "idle",
      detail: "Not inspected yet.",
    };
  }
  if (state === "loading") {
    return {
      id,
      label,
      status: "loading",
      detail: "Reading bounded local evidence.",
    };
  }
  return {
    id,
    label,
    status: "ready",
    detail: "Local evidence is available.",
  };
}

function compareActivityFacts(left: ActivityFact, right: ActivityFact): number {
  return (
    Date.parse(right.timestamp) - Date.parse(left.timestamp) ||
    left.id.localeCompare(right.id)
  );
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
