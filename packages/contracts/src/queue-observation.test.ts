import { describe, expect, it } from "vitest";

import type { QueueSourceClassification } from "./queue-classification.js";
import { queueClassificationDiagnostic } from "./queue-classification.js";
import {
  QueueSourceObservationSchema,
  QueueSourcesObservationSchema,
} from "./queue-observation.js";

const observedAt = "2026-07-27T12:00:00.000Z";
const emptyHash =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const questionClassification: QueueSourceClassification = {
  status: "candidate",
  boundary: "whole_source_v1",
  candidate: {
    itemId: "a".repeat(64),
    type: "question",
    confidence: "high",
  },
  diagnostics: [queueClassificationDiagnostic("legacy_marker")],
};

describe("queue source observation contract", () => {
  it("accepts complete stable and empty provenance", () => {
    expect(
      QueueSourceObservationSchema.safeParse(
        source({
          status: "stable",
          byteLength: 14,
          modifiedAt: observedAt,
          contentHash:
            "d9014c4624844aa5bac314773d6b689ad467fa4e1d1a50a1b8a99d9c39fd6f9d",
          classification: questionClassification,
        }),
      ).success,
    ).toBe(true);
    expect(
      QueueSourceObservationSchema.safeParse(
        source({
          status: "empty",
          byteLength: 0,
          modifiedAt: observedAt,
          contentHash: emptyHash,
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects hashes on partial or degraded evidence", () => {
    expect(
      QueueSourceObservationSchema.safeParse(
        source({ status: "changing", contentHash: emptyHash }),
      ).success,
    ).toBe(false);
    expect(
      QueueSourceObservationSchema.safeParse(
        source({
          status: "stable",
          byteLength: 1,
          modifiedAt: observedAt,
        }),
      ).success,
    ).toBe(false);
  });

  it("keeps classification exclusive to stable nonempty evidence", () => {
    expect(
      QueueSourceObservationSchema.safeParse(
        source({
          status: "stable",
          byteLength: 14,
          modifiedAt: observedAt,
          contentHash: "d".repeat(64),
        }),
      ).success,
    ).toBe(false);
    expect(
      QueueSourceObservationSchema.safeParse(
        source({
          status: "empty",
          byteLength: 0,
          modifiedAt: observedAt,
          contentHash: emptyHash,
          classification: questionClassification,
        }),
      ).success,
    ).toBe(false);
  });

  it("keeps error detail exclusive to read and watcher failures", () => {
    const error = {
      code: "READ_FAILED",
      message: "The source could not be read.",
    };
    expect(
      QueueSourceObservationSchema.safeParse(
        source({ status: "read_error", error }),
      ).success,
    ).toBe(true);
    expect(
      QueueSourceObservationSchema.safeParse(
        source({ status: "missing", error }),
      ).success,
    ).toBe(false);
    expect(
      QueueSourceObservationSchema.safeParse(source({ status: "watch_error" }))
        .success,
    ).toBe(false);
  });

  it("rejects content and hostile unbounded extras", () => {
    expect(
      QueueSourceObservationSchema.safeParse({
        ...source({ status: "missing" }),
        originalText: "run this command",
        path: "/tmp/queue",
      }).success,
    ).toBe(false);
  });
});

describe("queue aggregate observation contract", () => {
  it("accepts ready ordered source evidence", () => {
    expect(
      QueueSourcesObservationSchema.safeParse({
        status: "ready",
        workspaceRevision: 4,
        observedAt,
        sources: [
          source({ sourceId: "needs-felix", status: "missing" }),
          source({ sourceId: "review", status: "pending" }),
        ],
        error: null,
      }).success,
    ).toBe(true);
  });

  it("requires unavailable aggregates to omit workspace and source evidence", () => {
    expect(
      QueueSourcesObservationSchema.safeParse({
        status: "unconfigured",
        workspaceRevision: null,
        observedAt,
        sources: [],
        error: null,
      }).success,
    ).toBe(true);
    expect(
      QueueSourcesObservationSchema.safeParse({
        status: "config_error",
        workspaceRevision: null,
        observedAt,
        sources: [],
        error: {
          code: "CONFIG_INVALID",
          message: "Queue configuration is unavailable.",
        },
      }).success,
    ).toBe(true);
    expect(
      QueueSourcesObservationSchema.safeParse({
        status: "unconfigured",
        workspaceRevision: 1,
        observedAt,
        sources: [source({ status: "missing" })],
        error: null,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate source identities", () => {
    expect(
      QueueSourcesObservationSchema.safeParse({
        status: "ready",
        workspaceRevision: 1,
        observedAt,
        sources: [source({ status: "missing" }), source({ status: "pending" })],
        error: null,
      }).success,
    ).toBe(false);
  });
});

function source(
  overrides: Partial<{
    sourceId: string;
    status:
      | "pending"
      | "stable"
      | "empty"
      | "missing"
      | "changing"
      | "oversized"
      | "invalid_utf8"
      | "unsafe_type"
      | "read_error"
      | "watch_error";
    byteLength: number | null;
    modifiedAt: string | null;
    contentHash: string | null;
    classification: QueueSourceClassification | null;
    error: { code: string; message: string } | null;
  }> = {},
) {
  return {
    sourceId: "needs-felix",
    observationRevision: 1,
    status: "pending" as const,
    observedAt,
    byteLength: null,
    modifiedAt: null,
    contentHash: null,
    classification: null,
    error: null,
    ...overrides,
  };
}
