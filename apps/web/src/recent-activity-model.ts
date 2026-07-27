import type { SessionSummary } from "@pacium/contracts";

import type { AttentionResult } from "./attention-model.js";
import {
  visibleRepositoryChanges,
  type RepositoryChangesViewState,
} from "./repository-changes-model.js";
import {
  visibleRepositoryHistory,
  type RepositoryHistoryViewState,
} from "./repository-history-model.js";
import {
  visibleVerificationObservation,
  type RepositoryVerificationViewState,
} from "./repository-verification-model.js";

export const MAX_RECENT_ACTIVITY_COMMITS = 3;
export const MAX_RECENT_ACTIVITY_FACTS = 7;

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
  const facts = [
    ...processFacts(input.session),
    ...gitFacts(input),
    ...verificationFacts(input.verification),
  ].toSorted(compareActivityFacts);
  const sources = sourceSummaries(input);
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

function gitFacts({
  changes,
  history,
}: RecentActivityInput): ActivityFact[] {
  const facts: ActivityFact[] = [];
  const changeObservation = visibleRepositoryChanges(changes);
  if (
    changeObservation?.status === "ready" &&
    validTimestamp(changeObservation.observedAt)
  ) {
    const { additions, conflictCount, deletions, fileCount } =
      changeObservation.totals;
    const clean = fileCount === 0;
    facts.push({
      id: `git:changes:${changeObservation.observedAt}`,
      source: "git",
      title: clean
        ? "Working tree observed clean"
        : `${fileCount} changed ${plural(fileCount, "file")} observed`,
      detail: clean
        ? "Git reported no staged, unstaged, conflicted, or untracked files."
        : `+${additions} −${deletions}${
            conflictCount > 0
              ? ` · ${conflictCount} ${plural(conflictCount, "conflict")}`
              : ""
          }`,
      timestamp: changeObservation.observedAt,
      timestampMeaning: "observed",
    });
  }

  const historyObservation = visibleRepositoryHistory(history);
  if (historyObservation?.status === "ready") {
    for (const commit of historyObservation.commits.slice(
      0,
      MAX_RECENT_ACTIVITY_COMMITS,
    )) {
      if (!validTimestamp(commit.authoredAt)) {
        continue;
      }
      facts.push({
        id: `git:commit:${commit.id}`,
        source: "git",
        title: commit.subject,
        detail: `Git commit ${commit.id.slice(0, 8)} · author recorded as ${commit.authorName}`,
        timestamp: commit.authoredAt,
        timestampMeaning: "occurred",
      });
    }
  }
  return facts;
}

function verificationFacts(
  state: RepositoryVerificationViewState,
): ActivityFact[] {
  const observation = visibleVerificationObservation(state);
  if (observation === null || observation.run === null) {
    return [];
  }
  const run = observation.run;
  const timestamp = run.completedAt ?? run.startedAt;
  if (!validTimestamp(timestamp)) {
    return [];
  }
  const preset =
    observation.presets.find(({ id }) => id === run.presetId)?.label ??
    run.presetId;
  return [
    {
      id: `verification:${run.runId}:${run.status}`,
      source: "verification",
      title: verificationTitle(run.status),
      detail: verificationDetail(preset, run),
      timestamp,
      timestampMeaning: "occurred",
    },
  ];
}

function sourceSummaries({
  changes,
  history,
  verification,
}: RecentActivityInput): ActivitySourceSummary[] {
  return [
    changesSummary(changes),
    historySummary(history),
    verificationSummary(verification),
  ];
}

function changesSummary(
  state: RepositoryChangesViewState,
): ActivitySourceSummary {
  const loading = loadingSummary("changes", "Git changes", state.status);
  const observation = visibleRepositoryChanges(state);
  if (observation === null) {
    return loading;
  }
  switch (observation.status) {
    case "ready":
      return {
        id: "changes",
        label: "Git changes",
        status: state.status === "loading" ? "loading" : "ready",
        detail: `${observation.totals.fileCount} changed ${plural(
          observation.totals.fileCount,
          "file",
        )} observed.`,
      };
    case "not_repository":
      return {
        id: "changes",
        label: "Git changes",
        status: "unavailable",
        detail: "No Git repository is associated with this terminal.",
      };
    case "error":
      return {
        id: "changes",
        label: "Git changes",
        status: "error",
        detail:
          observation.error?.message ?? "Changed-file evidence is unavailable.",
      };
  }
}

function historySummary(
  state: RepositoryHistoryViewState,
): ActivitySourceSummary {
  const loading = loadingSummary("history", "Git history", state.status);
  const observation = visibleRepositoryHistory(state);
  if (observation === null) {
    return loading;
  }
  switch (observation.status) {
    case "ready":
      return {
        id: "history",
        label: "Git history",
        status: state.status === "loading" ? "loading" : "ready",
        detail: `${observation.commits.length} recent ${plural(
          observation.commits.length,
          "commit",
        )} inspected.`,
      };
    case "empty":
      return {
        id: "history",
        label: "Git history",
        status: "empty",
        detail: "The repository has an unborn HEAD and no commits.",
      };
    case "not_repository":
      return {
        id: "history",
        label: "Git history",
        status: "unavailable",
        detail: "No Git repository is associated with this terminal.",
      };
    case "error":
      return {
        id: "history",
        label: "Git history",
        status: "error",
        detail: observation.error?.message ?? "Commit history is unavailable.",
      };
  }
}

function verificationSummary(
  state: RepositoryVerificationViewState,
): ActivitySourceSummary {
  const loading = loadingSummary(
    "verification",
    "Verification",
    state.status,
  );
  const observation = visibleVerificationObservation(state);
  if (observation === null) {
    return loading;
  }
  switch (observation.status) {
    case "ready":
      return {
        id: "verification",
        label: "Verification",
        status: state.status === "loading" ? "loading" : "ready",
        detail:
          observation.run === null
            ? `${observation.presets.length} configured ${plural(
                observation.presets.length,
                "preset",
              )}; no run observed.`
            : `${verificationTitle(observation.run.status)} evidence is available.`,
      };
    case "unconfigured":
      return {
        id: "verification",
        label: "Verification",
        status: "empty",
        detail: "Verification is not configured.",
      };
    case "no_presets":
      return {
        id: "verification",
        label: "Verification",
        status: "empty",
        detail: "No verification presets match this repository.",
      };
    case "not_repository":
      return {
        id: "verification",
        label: "Verification",
        status: "unavailable",
        detail: "No Git repository is associated with this terminal.",
      };
    case "error":
      return {
        id: "verification",
        label: "Verification",
        status: "error",
        detail:
          observation.error?.message ?? "Verification evidence is unavailable.",
      };
  }
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

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function verificationTitle(
  status:
    | "running"
    | "cancelling"
    | "passed"
    | "failed"
    | "timed_out"
    | "cancelled"
    | "error",
): string {
  switch (status) {
    case "running":
      return "Verification started";
    case "cancelling":
      return "Verification cancellation requested";
    case "passed":
      return "Verification passed";
    case "failed":
      return "Verification failed";
    case "timed_out":
      return "Verification timed out";
    case "cancelled":
      return "Verification cancelled";
    case "error":
      return "Verification could not run";
  }
}

function verificationDetail(
  preset: string,
  run: NonNullable<
    NonNullable<
      ReturnType<typeof visibleVerificationObservation>
    >["run"]
  >,
): string {
  if (run.status === "running" || run.status === "cancelling") {
    return `${preset} · started at observed HEAD ${
      run.headCommitAtStart?.slice(0, 8) ?? "unavailable"
    }`;
  }
  const duration =
    run.durationMs === null
      ? "duration unavailable"
      : `${(run.durationMs / 1000).toFixed(1)} s`;
  const outcome =
    run.exitCode !== null
      ? `exit ${run.exitCode}`
      : run.signal !== null
        ? run.signal
        : run.error?.code.replaceAll("_", " ") ?? "no exit evidence";
  return `${preset} · ${duration} · ${outcome}`;
}
