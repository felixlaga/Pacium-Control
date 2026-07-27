import { describe, expect, it } from "vitest";

import {
  MAX_QUEUE_ITEM_TEXT_BASE64_CHARS,
  QueueItemInspectionIdentitySchema,
  QueueItemInspectionSchema,
  queueItemInspectionError,
} from "./queue-item-inspection.js";
import { MAX_QUEUE_SOURCE_BYTES } from "./queue-observation.js";

const identity = {
  workspaceRevision: 4,
  sourceId: "needs-felix",
  observationRevision: 7,
  contentHash: "a".repeat(64),
  itemId: "b".repeat(64),
};
const observedAt = "2026-07-27T12:00:00.000Z";

describe("queue item inspection contract", () => {
  it("accepts exact ready UTF-8 bytes with current provenance", () => {
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "ready",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: "2026-07-27T11:50:00.000Z",
        byteLength: 9,
        encoding: "utf8_base64",
        originalTextBase64: "UmV2aWV3IM67",
        error: null,
      }).success,
    ).toBe(true);
  });

  it("bounds base64 expansion for one maximum source", () => {
    expect(MAX_QUEUE_ITEM_TEXT_BASE64_CHARS).toBe(
      Math.ceil(MAX_QUEUE_SOURCE_BYTES / 3) * 4,
    );
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "ready",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: observedAt,
        byteLength: MAX_QUEUE_SOURCE_BYTES,
        encoding: "utf8_base64",
        originalTextBase64: `${"YWFh".repeat(
          Math.floor(MAX_QUEUE_SOURCE_BYTES / 3),
        )}YQ==`,
        error: null,
      }).success,
    ).toBe(true);
  });

  it("requires stale and unavailable details to omit queue text", () => {
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "stale",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: null,
        error: queueItemInspectionError("ITEM_STALE"),
      }).success,
    ).toBe(true);
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "unavailable",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: "c2VjcmV0",
        error: queueItemInspectionError("QUEUE_UNAVAILABLE"),
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched fixed diagnostics and unsafe extras", () => {
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "stale",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: null,
        byteLength: null,
        encoding: null,
        originalTextBase64: null,
        error: queueItemInspectionError("QUEUE_UNAVAILABLE"),
      }).success,
    ).toBe(false);
    expect(
      QueueItemInspectionSchema.safeParse({
        status: "ready",
        ...identity,
        sourceObservedAt: observedAt,
        firstObservedAt: observedAt,
        byteLength: 7,
        encoding: "utf8_base64",
        originalTextBase64: "YXBwcm92ZQ==",
        error: null,
        path: "/tmp/queue",
        command: "approve everything",
        decision: "approved",
      }).success,
    ).toBe(false);
  });

  it("accepts only a strict complete current identity", () => {
    expect(QueueItemInspectionIdentitySchema.safeParse(identity).success).toBe(
      true,
    );
    expect(
      QueueItemInspectionIdentitySchema.safeParse({
        ...identity,
        path: "/tmp/queue",
      }).success,
    ).toBe(false);
    expect(
      QueueItemInspectionIdentitySchema.safeParse({
        ...identity,
        observationRevision: 0,
      }).success,
    ).toBe(false);
  });
});
