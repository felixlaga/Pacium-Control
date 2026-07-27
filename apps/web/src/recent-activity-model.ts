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
