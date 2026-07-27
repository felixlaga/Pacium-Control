import { describe, expect, it } from "vitest";

import type { QueueDeliveryRecord } from "@pacium/contracts";

import {
  computeQueueDeliveryHash,
  hasValidQueueDeliveryHash,
  type UnhashedQueueDelivery,
} from "./queue-delivery-hash.js";

const delivery: UnhashedQueueDelivery = {
  deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  decisionHash: "c".repeat(64),
  target: {
    type: "answer_file",
    methodId: "answers",
    methodLabel: "Pacium answers",
    path: "/private/tmp/PACIUM-ANSWERS",
  },
  payloadHash: "d".repeat(64),
  payloadByteLength: 512,
  requestedAt: "2026-07-27T15:00:00.000Z",
  outcome: null,
};

describe("queue delivery hashing", () => {
  it("produces a deterministic canonical lower-case SHA-256 hash", () => {
    expect(computeQueueDeliveryHash(delivery)).toBe(
      "d7ab50c1ca325a23e2ed33a6f8bf1b32eeb81f13f3b894a715385875a563838f",
    );
    const reordered = {
      outcome: delivery.outcome,
      requestedAt: delivery.requestedAt,
      payloadByteLength: delivery.payloadByteLength,
      payloadHash: delivery.payloadHash,
      target: delivery.target,
      decisionHash: delivery.decisionHash,
      decisionId: delivery.decisionId,
      deliveryId: delivery.deliveryId,
    };
    expect(computeQueueDeliveryHash(reordered)).toBe(
      computeQueueDeliveryHash(delivery),
    );
  });

  it("detects target and outcome tampering", () => {
    const record: QueueDeliveryRecord = {
      ...delivery,
      deliveryHash: computeQueueDeliveryHash(delivery),
    };
    expect(hasValidQueueDeliveryHash(record)).toBe(true);
    expect(
      hasValidQueueDeliveryHash({
        ...record,
        target: {
          ...record.target,
          methodLabel: "Changed",
        },
      }),
    ).toBe(false);
    expect(
      hasValidQueueDeliveryHash({
        ...record,
        outcome: {
          status: "failed",
          recordedAt: "2026-07-27T15:00:01.000Z",
          evidence: null,
          error: {
            code: "DELIVERY_WRITE_FAILED",
            message:
              "The configured transport failed before delivery could be confirmed.",
          },
        },
      }),
    ).toBe(false);
  });
});
