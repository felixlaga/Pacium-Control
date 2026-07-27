import { describe, expect, it } from "vitest";

import { ProviderObservationSnapshotSchema } from "@pacium/contracts";

import {
  initialProviderObservation,
  PROVIDER_ADAPTER_CONTRACT_VERSION,
} from "./provider-observation.js";

const observedAt = "2026-07-28T10:00:00.000Z";

describe("initial provider observation", () => {
  it("omits provider state from ordinary shell terminals", () => {
    expect(initialProviderObservation("shell", observedAt)).toBeNull();
  });

  it.each(["claude", "codex"] as const)(
    "starts %s unavailable without inventing capabilities",
    (launchPreset) => {
      const observation = initialProviderObservation(launchPreset, observedAt);

      expect(
        ProviderObservationSnapshotSchema.parse(observation),
      ).toMatchObject({
        contractVersion: 1,
        adapterVersion: PROVIDER_ADAPTER_CONTRACT_VERSION,
        provider: launchPreset,
        providerVersion: null,
        health: {
          state: "unavailable",
          source: "none",
          confidence: "low",
        },
        attention: null,
        activities: [],
        diagnostics: [],
        observedAt,
        staleAfter: "2026-07-28T10:05:00.000Z",
      });
      expect(observation?.capabilities).toHaveLength(8);
      expect(
        observation?.capabilities.every(
          ({ availability, source, confidence }) =>
            availability === "unknown" &&
            source === "none" &&
            confidence === "low",
        ),
      ).toBe(true);
    },
  );
});
