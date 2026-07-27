import { createHash } from "node:crypto";

import type { QueueResolutionRecord } from "@pacium/contracts";

export type UnhashedQueueResolution = Omit<
  QueueResolutionRecord,
  "resolutionHash"
>;

export function computeQueueResolutionHash(
  resolution: UnhashedQueueResolution,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(resolution)), "utf8")
    .digest("hex");
}

export function hasValidQueueResolutionHash(
  resolution: QueueResolutionRecord,
): boolean {
  const { resolutionHash, ...unhashed } = resolution;
  return computeQueueResolutionHash(unhashed) === resolutionHash;
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
