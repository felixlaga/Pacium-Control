import { createHash } from "node:crypto";

import type { QueueDecisionRecord } from "@pacium/contracts";

export type UnhashedQueueDecision = QueueDecisionRecord extends infer Decision
  ? Decision extends QueueDecisionRecord
    ? Omit<Decision, "decisionHash">
    : never
  : never;

export function computeQueueDecisionHash(
  decision: UnhashedQueueDecision,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(decision)), "utf8")
    .digest("hex");
}

export function hasValidQueueDecisionHash(
  decision: QueueDecisionRecord,
): boolean {
  const { decisionHash, ...unhashed } = decision;
  return computeQueueDecisionHash(unhashed) === decisionHash;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}
