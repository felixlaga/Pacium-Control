import { createHash } from "node:crypto";

import type { QueueDeliveryRecord } from "@pacium/contracts";

export type UnhashedQueueDelivery = Omit<QueueDeliveryRecord, "deliveryHash">;

export function computeQueueDeliveryHash(
  delivery: UnhashedQueueDelivery,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(delivery)), "utf8")
    .digest("hex");
}

export function hasValidQueueDeliveryHash(
  delivery: QueueDeliveryRecord,
): boolean {
  const { deliveryHash, ...unhashed } = delivery;
  return computeQueueDeliveryHash(unhashed) === deliveryHash;
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
