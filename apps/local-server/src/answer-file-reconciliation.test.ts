import type { QueueDeliveryRecord } from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import { reconcileAnswerFile } from "./answer-file-reconciliation.js";
import type { QueueFileReadResult } from "./queue-file-reader.js";

const observedAt = "2026-07-27T16:00:00.000Z";
const delivery = {
  deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
  decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
  decisionHash: "c".repeat(64),
  target: {
    type: "answer_file" as const,
    methodId: "answers",
    methodLabel: "Pacium answers",
    path: "/private/tmp/PACIUM-ANSWERS",
  },
  payloadHash: "d".repeat(64),
  payloadByteLength: 512,
  requestedAt: "2026-07-27T15:00:00.000Z",
  outcome: {
    status: "delivered" as const,
    recordedAt: "2026-07-27T15:00:01.000Z",
    evidence: {
      kind: "answer_file_created" as const,
      byteLength: 512,
      contentHash: "d".repeat(64),
    },
    error: null,
  },
  deliveryHash: "e".repeat(64),
} satisfies QueueDeliveryRecord;

describe("answer-file reconciliation", () => {
  it("labels exact bytes as a present transport artifact only", async () => {
    await expect(
      reconcileAnswerFile(delivery, {
        now: () => observedAt,
        read: readResult({
          status: "stable",
          byteLength: 512,
          contentHash: delivery.payloadHash,
        }),
      }),
    ).resolves.toEqual({
      status: "transport_artifact_present",
      source: "filesystem_observed",
      observedAt,
      reason: null,
      byteLength: 512,
      contentHash: delivery.payloadHash,
    });
  });

  it("does not infer acknowledgement from a missing target", async () => {
    await expect(
      reconcileAnswerFile(delivery, {
        now: () => observedAt,
        read: readResult({ status: "missing" }),
      }),
    ).resolves.toMatchObject({
      status: "acknowledgement_unavailable",
      source: "filesystem_observed",
      reason: "answer_file_missing",
    });
  });

  it("surfaces changed, unsafe, oversized, and unreadable targets", async () => {
    const cases: Array<
      [QueueFileReadResult["status"], string, Partial<QueueFileReadResult>]
    > = [
      [
        "stable",
        "answer_file_changed",
        { byteLength: 20, contentHash: "f".repeat(64) },
      ],
      ["unsafe_type", "answer_file_unsafe", {}],
      ["oversized", "answer_file_oversized", { byteLength: 70_000 }],
      ["changing", "answer_file_unreadable", {}],
      ["invalid_utf8", "answer_file_unreadable", {}],
      ["read_error", "answer_file_unreadable", {}],
    ];
    for (const [status, reason, overrides] of cases) {
      await expect(
        reconcileAnswerFile(delivery, {
          now: () => observedAt,
          read: readResult({ status, ...overrides }),
        }),
      ).resolves.toMatchObject({
        status: "target_conflict",
        source: "filesystem_observed",
        reason,
      });
    }
  });

  it("keeps role-prompt acknowledgement provider-unavailable", async () => {
    const target: Extract<
      QueueDeliveryRecord["target"],
      { type: "role_prompt" }
    > = {
      type: "role_prompt",
      methodId: "meta-prompt",
      methodLabel: "Meta prompt",
      role: "meta",
      sessionId: "1d49b467-b5ce-4dc9-a6a8-6a618f9e68af",
      sessionEpoch: 2,
    };
    const read = vi.fn();
    await expect(
      reconcileAnswerFile(
        { ...delivery, target, deliveryHash: "f".repeat(64) },
        { now: () => observedAt, read },
      ),
    ).resolves.toMatchObject({
      status: "acknowledgement_unavailable",
      source: "provider_unavailable",
      reason: "role_prompt_unobserved",
    });
    expect(read).not.toHaveBeenCalled();
  });
});

function readResult(
  overrides: Partial<QueueFileReadResult> & {
    status: QueueFileReadResult["status"];
  },
) {
  const { status, ...rest } = overrides;
  const result: QueueFileReadResult = {
    status,
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    text: null,
    error:
      status === "read_error"
        ? { code: "READ_FAILED", message: "Synthetic read failure." }
        : null,
    ...rest,
  };
  return vi.fn(() => Promise.resolve(result));
}
