import { describe, expect, it } from "vitest";

import {
  MAX_PROVIDER_ACTIVITIES,
  MAX_PROVIDER_DIAGNOSTIC_FIELDS,
  ProviderObservationSnapshotSchema,
  type ProviderObservationSnapshot,
} from "./provider-observation.js";

const observedAt = "2026-07-28T10:00:00.000Z";
const staleAfter = "2026-07-28T10:05:00.000Z";

function snapshot(
  override: Partial<ProviderObservationSnapshot> = {},
): ProviderObservationSnapshot {
  return {
    contractVersion: 1,
    provider: "codex",
    adapterVersion: "1.0.0",
    providerVersion: "0.145.0",
    health: {
      state: "ready",
      source: "native",
      confidence: "confirmed",
      detail: "Local native observer is connected.",
    },
    capabilities: [
      {
        id: "activity",
        availability: "supported",
        source: "native",
        confidence: "confirmed",
        detail: "Structured native events are available.",
      },
    ],
    attention: {
      state: "working",
      source: "native",
      confidence: "confirmed",
      observedAt,
      staleAfter,
      reason: "The provider reported an active turn.",
    },
    activities: [
      {
        id: "turn-1:start",
        kind: "turn_started",
        source: "native",
        confidence: "confirmed",
        occurredAt: observedAt,
        observedAt,
        summary: "Turn started.",
        extension: {
          provider: "codex",
          eventType: "turn_start",
          threadId: "thread-1",
          turnId: "turn-1",
          itemType: null,
        },
      },
    ],
    diagnostics: [
      {
        code: "transport.connected",
        severity: "info",
        message: "Native local transport connected.",
        observedAt,
        fields: [{ name: "transport", value: "stdio" }],
      },
    ],
    observedAt,
    staleAfter,
    ...override,
  };
}

describe("provider observation contract", () => {
  it("accepts bounded native evidence", () => {
    expect(ProviderObservationSnapshotSchema.parse(snapshot())).toEqual(
      snapshot(),
    );
  });

  it("keeps questions and approvals distinct", () => {
    const approval = snapshot().activities[0]!;
    const result = ProviderObservationSnapshotSchema.parse(
      snapshot({
        activities: [
          {
            ...approval,
            id: "approval-1",
            kind: "approval_requested",
            extension: {
              provider: "codex",
              eventType: "approval_request",
              threadId: "thread-1",
              turnId: "turn-1",
              itemType: null,
            },
          },
          {
            ...approval,
            id: "question-1",
            kind: "question_requested",
            extension: {
              provider: "codex",
              eventType: "question_request",
              threadId: "thread-1",
              turnId: "turn-1",
              itemType: null,
            },
          },
        ],
      }),
    );

    expect(result.activities.map(({ kind }) => kind)).toEqual([
      "approval_requested",
      "question_requested",
    ]);
  });

  it("rejects cross-provider extensions and unknown fields", () => {
    const activity = snapshot().activities[0]!;
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          activities: [
            {
              ...activity,
              extension: {
                provider: "claude",
                eventType: "tool_start",
                providerSessionId: "claude-1",
                toolName: "Bash",
                modelId: null,
                contextUsedPercent: null,
                totalCostUsd: null,
                totalInputTokens: null,
                totalOutputTokens: null,
              },
            },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse({
        ...snapshot(),
        transcript: "must not pass",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate capabilities, activities, and diagnostic fields", () => {
    const valid = snapshot();
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          capabilities: [valid.capabilities[0]!, valid.capabilities[0]!],
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          activities: [valid.activities[0]!, valid.activities[0]!],
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          diagnostics: [
            {
              ...valid.diagnostics[0]!,
              fields: [
                { name: "transport", value: "stdio" },
                { name: "transport", value: "stdio" },
              ],
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects secret-bearing, nested, and oversized diagnostics", () => {
    const diagnostic = snapshot().diagnostics[0]!;
    for (const name of [
      "authorization",
      "auth.token",
      "provider_password",
      "prompt.input",
      "tool-output",
      "environment",
      "transcript.path",
    ]) {
      expect(
        ProviderObservationSnapshotSchema.safeParse(
          snapshot({
            diagnostics: [
              { ...diagnostic, fields: [{ name, value: "redacted?" }] },
            ],
          }),
        ).success,
      ).toBe(false);
    }
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          diagnostics: [
            {
              ...diagnostic,
              fields: [{ name: "nested", value: { unsafe: true } }],
            },
          ] as unknown as ProviderObservationSnapshot["diagnostics"],
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          diagnostics: [
            {
              ...diagnostic,
              fields: Array.from(
                { length: MAX_PROVIDER_DIAGNOSTIC_FIELDS + 1 },
                (_, index) => ({ name: `field.${index}`, value: index }),
              ),
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects impossible freshness and observation order", () => {
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({ staleAfter: "2026-07-28T09:59:00.000Z" }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          attention: {
            ...snapshot().attention!,
            staleAfter: "2026-07-28T09:59:00.000Z",
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          activities: [
            {
              ...snapshot().activities[0]!,
              occurredAt: "2026-07-28T10:01:00.000Z",
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects unsupported evidence claims and fixed-bound overflow", () => {
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          health: {
            state: "ready",
            source: "none",
            confidence: "low",
            detail: "No evidence.",
          },
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          capabilities: [
            {
              id: "attention",
              availability: "unknown",
              source: "native",
              confidence: "confirmed",
              detail: "Contradictory.",
            },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      ProviderObservationSnapshotSchema.safeParse(
        snapshot({
          activities: Array.from(
            { length: MAX_PROVIDER_ACTIVITIES + 1 },
            (_, index) => ({
              ...snapshot().activities[0]!,
              id: `activity-${index}`,
            }),
          ),
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts bounded typed Claude status usage", () => {
    const result = ProviderObservationSnapshotSchema.parse({
      ...snapshot(),
      provider: "claude",
      activities: [
        {
          id: "claude-status-1",
          kind: "usage_updated",
          source: "hook",
          confidence: "high",
          occurredAt: observedAt,
          observedAt,
          summary: "Claude status snapshot updated.",
          extension: {
            provider: "claude",
            eventType: "status",
            providerSessionId: "claude-session-1",
            toolName: null,
            modelId: "claude-opus-5",
            contextUsedPercent: 41.5,
            totalCostUsd: 1.25,
            totalInputTokens: 12_000,
            totalOutputTokens: 900,
          },
        },
      ],
    });

    expect(result.activities[0]?.extension).toMatchObject({
      provider: "claude",
      eventType: "status",
      contextUsedPercent: 41.5,
      totalInputTokens: 12_000,
    });
  });

  it("rejects impossible Claude status usage", () => {
    const claudeStatus = {
      provider: "claude",
      eventType: "status",
      providerSessionId: "claude-session-1",
      toolName: null,
      modelId: "claude-opus-5",
      contextUsedPercent: 101,
      totalCostUsd: -1,
      totalInputTokens: -1,
      totalOutputTokens: 1.5,
    };

    expect(
      ProviderObservationSnapshotSchema.safeParse({
        ...snapshot(),
        provider: "claude",
        activities: [
          {
            ...snapshot().activities[0]!,
            extension: claudeStatus,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
