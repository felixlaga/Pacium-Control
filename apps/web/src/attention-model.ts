import type { SessionSummary } from "@pacium/contracts";

export type AttentionState =
  | "working"
  | "waiting"
  | "needs_input"
  | "finished"
  | "failed"
  | "stale"
  | "unknown";

export type AttentionSource =
  "native" | "hook" | "human" | "process" | "terminal" | "none";

export type AttentionConfidence = "confirmed" | "high" | "medium" | "low";

export interface AttentionObservation {
  state: Exclude<AttentionState, "stale">;
  source: Exclude<AttentionSource, "none">;
  confidence: AttentionConfidence;
  observedAt: string;
  staleAfter: string;
  reason: string;
}

export interface AttentionResult {
  state: AttentionState;
  source: AttentionSource;
  confidence: AttentionConfidence;
  observedAt: string;
  staleAfter: string;
  reason: string;
}

const SOURCE_RANK: Record<AttentionSource, number> = {
  native: 5,
  hook: 4,
  human: 3,
  process: 2,
  terminal: 1,
  none: 0,
};

const CONFIDENCE_RANK: Record<AttentionConfidence, number> = {
  confirmed: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function reduceAttention(
  observations: readonly AttentionObservation[],
  now: string,
): AttentionResult {
  const nowMilliseconds = parseTimestamp(now);
  const normalizedNow =
    nowMilliseconds === null ? "1970-01-01T00:00:00.000Z" : now;
  const valid = observations
    .filter(validObservation)
    .toSorted(compareObservations);
  const winner = valid[0];

  if (winner === undefined) {
    return {
      state: "unknown",
      source: "none",
      confidence: "low",
      observedAt: normalizedNow,
      staleAfter: normalizedNow,
      reason: "No attention evidence is available.",
    };
  }

  const staleAfter = parseTimestamp(winner.staleAfter);
  if (
    nowMilliseconds !== null &&
    staleAfter !== null &&
    nowMilliseconds >= staleAfter
  ) {
    return {
      ...winner,
      state: "stale",
      reason: `Evidence expired: ${winner.reason}`,
    };
  }
  return winner;
}

export function deriveProcessAttention(
  session: SessionSummary,
  observedAt: string,
): AttentionResult {
  return reduceAttention([processAttentionObservation(session, observedAt)], observedAt);
}

export function deriveSessionAttention(
  session: SessionSummary,
  observedAt: string,
): AttentionResult {
  const providerAttention = session.providerObservation?.attention;
  return reduceAttention(
    [
      ...(providerAttention === null || providerAttention === undefined
        ? []
        : [
            {
              ...providerAttention,
              staleAfter: earlierTimestamp(
                providerAttention.staleAfter,
                session.providerObservation?.staleAfter ??
                  providerAttention.staleAfter,
              ),
            },
          ]),
      processAttentionObservation(session, observedAt),
    ],
    observedAt,
  );
}

function processAttentionObservation(
  session: SessionSummary,
  observedAt: string,
): AttentionObservation {
  const endedAt = session.exitedAt ?? observedAt;
  if (
    session.processState === "failed" ||
    session.exitSignal !== null ||
    (session.exitCode !== null && session.exitCode !== 0)
  ) {
    return {
      state: "failed",
      source: "process",
      confidence: "high",
      observedAt: endedAt,
      staleAfter: addHours(endedAt, 24),
      reason:
        session.exitSignal !== null
          ? `Process ended from signal ${session.exitSignal}.`
          : `Process exited with code ${session.exitCode ?? "unknown"}.`,
    };
  }

  if (session.processState === "exited") {
    return {
      state: "finished",
      source: "process",
      confidence: "medium",
      observedAt: endedAt,
      staleAfter: addHours(endedAt, 24),
      reason: "Process exited cleanly; assigned-task completion is unverified.",
    };
  }

  return {
    state: "unknown",
    source: "process",
    confidence: "low",
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
    reason:
      "Process is live; no provider activity observer is connected yet.",
  };
}

export function attentionStateLabel(state: AttentionState): string {
  switch (state) {
    case "working":
      return "Working";
    case "waiting":
      return "Waiting";
    case "needs_input":
      return "Needs input";
    case "finished":
      return "Finished";
    case "failed":
      return "Failed";
    case "stale":
      return "Stale";
    case "unknown":
      return "Unknown";
  }
}

export function attentionSourceLabel(source: AttentionSource): string {
  switch (source) {
    case "native":
      return "Provider native";
    case "hook":
      return "Provider hook";
    case "human":
      return "Human labelled";
    case "process":
      return "Process observed";
    case "terminal":
      return "Terminal inferred";
    case "none":
      return "No evidence";
  }
}

export function attentionConfidenceLabel(
  confidence: AttentionConfidence,
): string {
  switch (confidence) {
    case "confirmed":
      return "Confirmed";
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

function compareObservations(
  left: AttentionObservation,
  right: AttentionObservation,
): number {
  return (
    SOURCE_RANK[right.source] - SOURCE_RANK[left.source] ||
    CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence] ||
    Date.parse(right.observedAt) - Date.parse(left.observedAt)
  );
}

function validObservation(observation: AttentionObservation): boolean {
  const observedAt = parseTimestamp(observation.observedAt);
  const staleAfter = parseTimestamp(observation.staleAfter);
  return (
    observation.reason.length > 0 &&
    observation.reason.length <= 300 &&
    observedAt !== null &&
    staleAfter !== null &&
    staleAfter >= observedAt
  );
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addMinutes(value: string, minutes: number): string {
  return addMilliseconds(value, minutes * 60_000);
}

function addHours(value: string, hours: number): string {
  return addMilliseconds(value, hours * 3_600_000);
}

function addMilliseconds(value: string, milliseconds: number): string {
  const parsed = parseTimestamp(value);
  return new Date((parsed ?? 0) + milliseconds).toISOString();
}

function earlierTimestamp(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}
