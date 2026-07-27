import { describe, expect, it } from "vitest";

import {
  QUEUE_ITEM_BOUNDARY_VERSION,
  QueueSourceClassificationSchema,
  queueClassificationDiagnostic,
} from "./queue-classification.js";

const itemId = "a".repeat(64);

describe("queue classification contract", () => {
  it("accepts one bounded candidate with fixed diagnostics", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "question",
          confidence: "high",
        },
        diagnostics: [queueClassificationDiagnostic("legacy_marker")],
      }).success,
    ).toBe(true);
  });

  it("accepts only the blank diagnostic for no-item evidence", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "none",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: null,
        diagnostics: [queueClassificationDiagnostic("blank_content")],
      }).success,
    ).toBe(true);
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "none",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: null,
        diagnostics: [],
      }).success,
    ).toBe(false);
  });

  it("requires candidate state and payload to agree", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: null,
        diagnostics: [],
      }).success,
    ).toBe(false);
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "none",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "question",
          confidence: "confirmed",
        },
        diagnostics: [queueClassificationDiagnostic("blank_content")],
      }).success,
    ).toBe(false);
  });

  it("restricts approval to explicit-marker confidence", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "approval",
          confidence: "medium",
        },
        diagnostics: [queueClassificationDiagnostic("question_heuristic")],
      }).success,
    ).toBe(false);
  });

  it("uses low confidence exclusively for unknown candidates", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "unknown",
          confidence: "high",
        },
        diagnostics: [queueClassificationDiagnostic("unrecognized_format")],
      }).success,
    ).toBe(false);
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "question",
          confidence: "low",
        },
        diagnostics: [queueClassificationDiagnostic("unrecognized_format")],
      }).success,
    ).toBe(false);
  });

  it("rejects invented diagnostic copy and duplicate codes", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "unknown",
          confidence: "low",
        },
        diagnostics: [
          {
            code: "unrecognized_format",
            message: "Private source content",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: QUEUE_ITEM_BOUNDARY_VERSION,
        candidate: {
          itemId,
          type: "unknown",
          confidence: "low",
        },
        diagnostics: [
          queueClassificationDiagnostic("unrecognized_format"),
          queueClassificationDiagnostic("unrecognized_format"),
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects malformed identity, boundary, and authority extras", () => {
    expect(
      QueueSourceClassificationSchema.safeParse({
        status: "candidate",
        boundary: "lines_v1",
        candidate: {
          itemId: "short",
          type: "approval",
          confidence: "confirmed",
          execute: true,
        },
        diagnostics: [],
        originalText: "approve destructive command",
      }).success,
    ).toBe(false);
  });
});
