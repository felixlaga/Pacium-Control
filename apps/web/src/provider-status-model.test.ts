import type { SessionSummary } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  buildProviderStatus,
  providerStatusState,
  type ProviderStatusState,
} from "./provider-status-model.js";

const now = "2026-07-28T10:00:00.000Z";

function providerSession(
  state:
    "ready" | "unavailable" | "unsupported" | "degraded" | "failed" = "ready",
): SessionSummary {
  return {
    id: "53cfec56-181c-4e9c-b187-8f323780c175",
    epoch: 2,
    displayName: "Codex",
    cwd: "/work/pacium",
    shell: "/bin/zsh",
    launchPreset: "codex",
    commandLabel: "Codex",
    agentClassification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
      observedAt: now,
    },
    providerObservation: {
      contractVersion: 1,
      provider: "codex",
      adapterVersion: "1",
      providerVersion: state === "unavailable" ? null : "0.145.0",
      health: {
        state,
        source:
          state === "ready" || state === "degraded" || state === "failed"
            ? "native"
            : "none",
        confidence:
          state === "unavailable"
            ? "low"
            : state === "ready" ||
                state === "degraded" ||
                state === "failed" ||
                state === "unsupported"
              ? "confirmed"
              : "low",
        detail: `<${state}> observer detail`,
      },
      capabilities: [
        {
          id: "usage",
          availability: "unknown",
          source: "none",
          confidence: "low",
          detail: "No usage evidence yet.",
        },
        {
          id: "activity",
          availability: "supported",
          source: "native",
          confidence: "confirmed",
          detail: "Native activity is available.",
        },
        {
          id: "attention",
          availability: "unsupported",
          source: "none",
          confidence: "confirmed",
          detail: "Attention is unavailable in this runtime.",
        },
      ],
      attention: null,
      activities: [],
      diagnostics: [
        {
          code: "codex.test_failure",
          severity: state === "failed" ? "error" : "warning",
          message: "<diagnostic> fixed safe message",
          observedAt: now,
          fields: [
            { name: "provider_version", value: "must-not-render" },
            { name: "attempt", value: 2 },
          ],
        },
      ],
      observedAt: now,
      staleAfter: "2026-07-28T10:05:00.000Z",
    },
    repository: {
      status: "ready",
      root: "/work/pacium",
      name: "pacium",
      branch: "dev",
      headCommit: "a".repeat(40),
      headState: "branch",
      worktreeKind: "main",
      observedAt: now,
      error: null,
    },
    runtime: "pty",
    processState: "live",
    pid: 42,
    cols: 100,
    rows: 30,
    createdAt: now,
    exitedAt: null,
    exitCode: null,
    exitSignal: null,
  };
}

describe("provider status projection", () => {
  it.each([
    ["ready", "Ready"],
    ["unavailable", "Unavailable"],
    ["unsupported", "Unsupported"],
    ["degraded", "Degraded"],
    ["failed", "Failed"],
  ] as const)(
    "projects %s health with deterministic recovery",
    (state, label) => {
      const status = buildProviderStatus(providerSession(state), now);

      expect(status).toMatchObject({
        provider: "codex",
        providerLabel: "Codex",
        state,
        stateLabel: label,
        detail: `<${state}> observer detail`,
        adapterVersion: "1",
        terminalAvailable: true,
        terminalDetail:
          "Direct terminal process is live; observer health does not control it.",
      });
      expect(status?.recovery.length).toBeGreaterThan(20);
    },
  );

  it("expires a ready snapshot without requiring provider attention", () => {
    const stale = buildProviderStatus(
      providerSession("ready"),
      "2026-07-28T10:05:00.000Z",
    );

    expect(stale).toMatchObject({
      state: "stale",
      stateLabel: "Stale",
      recovery:
        "Wait for fresh authenticated evidence or inspect Terminal. Stale evidence is not current agent state.",
    });
    expect(
      providerStatusState(
        "ready",
        "2026-07-28T10:05:00.000Z",
        "2026-07-28T10:04:59.999Z",
      ),
    ).toBe("ready");
    expect(
      providerStatusState(
        "degraded",
        "2026-07-28T10:05:00.000Z",
        "2026-07-28T11:00:00.000Z",
      ),
    ).toBe("degraded");
  });

  it("orders capabilities and preserves provider-specific availability", () => {
    const status = buildProviderStatus(providerSession(), now);

    expect(
      status?.capabilities.map(
        ({ id, label, availabilityLabel, sourceLabel, confidenceLabel }) => ({
          id,
          label,
          availabilityLabel,
          sourceLabel,
          confidenceLabel,
        }),
      ),
    ).toEqual([
      {
        id: "attention",
        label: "Attention",
        availabilityLabel: "Unsupported",
        sourceLabel: "Local capability probe",
        confidenceLabel: "Confirmed",
      },
      {
        id: "activity",
        label: "Activity",
        availabilityLabel: "Supported",
        sourceLabel: "Provider native",
        confidenceLabel: "Confirmed",
      },
      {
        id: "usage",
        label: "Usage",
        availabilityLabel: "Unknown",
        sourceLabel: "No provider event",
        confidenceLabel: "Low confidence",
      },
    ]);
  });

  it("projects only safe diagnostic code, message, severity, and time", () => {
    const status = buildProviderStatus(providerSession("failed"), now);
    const serialized = JSON.stringify(status);

    expect(status?.diagnostics).toEqual([
      {
        code: "codex.test_failure",
        severity: "error",
        severityLabel: "Error",
        message: "<diagnostic> fixed safe message",
        observedAt: now,
      },
    ]);
    expect(serialized).not.toContain("must-not-render");
    expect(serialized).not.toContain("provider_version");
    expect(serialized).not.toContain("attempt");
  });

  it.each([
    ["creating", true, "launch is still pending"],
    ["live", true, "process is live"],
    ["exited", false, "process exited"],
    ["closing", false, "process is closing"],
    ["failed", false, "process failed"],
  ] as const)(
    "keeps %s terminal truth independent from provider status",
    (processState, terminalAvailable, detail) => {
      const status = buildProviderStatus(
        { ...providerSession("failed"), processState },
        now,
      );

      expect(status?.terminalAvailable).toBe(terminalAvailable);
      expect(status?.terminalDetail).toContain(detail);
    },
  );

  it("omits provider status for shells", () => {
    expect(
      buildProviderStatus(
        {
          ...providerSession(),
          launchPreset: "shell",
          providerObservation: null,
        },
        now,
      ),
    ).toBeNull();
  });

  it("keeps every visible state in the bounded state vocabulary", () => {
    const states: ProviderStatusState[] = [
      "ready",
      "unavailable",
      "unsupported",
      "degraded",
      "failed",
      "stale",
    ];

    expect(new Set(states).size).toBe(6);
  });
});
