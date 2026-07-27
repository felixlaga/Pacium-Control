import type {
  LaunchPresetId,
  ProviderCapabilityId,
  ProviderId,
  ProviderObservationSnapshot,
} from "@pacium/contracts";

export const PROVIDER_ADAPTER_CONTRACT_VERSION = "1";

const PROVIDER_CAPABILITIES: readonly ProviderCapabilityId[] = [
  "attention",
  "activity",
  "tools",
  "approvals",
  "questions",
  "plan",
  "usage",
  "completion",
];

export function initialProviderObservation(
  launchPreset: LaunchPresetId,
  observedAt: string,
): ProviderObservationSnapshot | null {
  const provider = providerForPreset(launchPreset);
  if (provider === null) {
    return null;
  }
  return {
    contractVersion: 1,
    provider,
    adapterVersion: PROVIDER_ADAPTER_CONTRACT_VERSION,
    providerVersion: null,
    health: {
      state: "unavailable",
      source: "none",
      confidence: "low",
      detail:
        "No provider observer is connected; terminal and process evidence remain available.",
    },
    capabilities: PROVIDER_CAPABILITIES.map((id) => ({
      id,
      availability: "unknown",
      source: "none",
      confidence: "low",
      detail: "Capability has not been detected for this provider session.",
    })),
    attention: null,
    activities: [],
    diagnostics: [],
    observedAt,
    staleAfter: addMinutes(observedAt, 5),
  };
}

function providerForPreset(launchPreset: LaunchPresetId): ProviderId | null {
  switch (launchPreset) {
    case "claude":
      return "claude";
    case "codex":
      return "codex";
    case "shell":
      return null;
  }
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}
