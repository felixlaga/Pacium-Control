import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  ProviderStatusPresentation,
  ProviderStatusState,
} from "./provider-status-model.js";
import { ProviderStatusPanel } from "./provider-status.js";

function status(state: ProviderStatusState): ProviderStatusPresentation {
  return {
    provider: "codex",
    providerLabel: "Codex",
    state,
    stateLabel: `${state[0]!.toUpperCase()}${state.slice(1)}`,
    detail: `<${state}> observer detail`,
    recovery: `Recover from ${state} through Terminal.`,
    providerVersion: "0.145.0",
    adapterVersion: "1",
    sourceLabel: state === "unsupported" ? "Local capability probe" : "Native",
    confidenceLabel: "Confirmed",
    observedAt: "2026-07-28T10:00:00.000Z",
    staleAfter: "2026-07-28T10:05:00.000Z",
    terminalDetail:
      "Direct terminal process is live; observer health does not control it.",
    terminalAvailable: true,
    capabilities: [
      {
        id: "activity",
        label: "Activity",
        availability: "supported",
        availabilityLabel: "Supported",
        sourceLabel: "Provider native",
        confidenceLabel: "Confirmed",
        detail: "<activity> is available.",
      },
      {
        id: "usage",
        label: "Usage",
        availability: "unknown",
        availabilityLabel: "Unknown",
        sourceLabel: "No provider event",
        confidenceLabel: "Low confidence",
        detail: "Usage evidence has not arrived.",
      },
    ],
    diagnostics: [
      {
        code: "codex.<failure>",
        severity: "error",
        severityLabel: "Error",
        message: "<script>fixed diagnostic</script>",
        observedAt: "2026-07-28T10:01:00.000Z",
      },
    ],
  };
}

describe("provider status presentation", () => {
  it.each([
    "ready",
    "unavailable",
    "unsupported",
    "degraded",
    "failed",
    "stale",
  ] as const)(
    "renders explicit %s hierarchy and terminal recovery",
    (state) => {
      const markup = renderToStaticMarkup(
        <ProviderStatusPanel
          onOpenTerminal={() => {}}
          status={status(state)}
        />,
      );

      expect(markup).toContain(`provider-status is-${state}`);
      expect(markup).toContain("Provider status");
      expect(markup).toContain(status(state).stateLabel);
      expect(markup).toContain("Terminal remains available");
      expect(markup).toContain("Open terminal");
      expect(markup).toContain("Capabilities");
      expect(markup).toContain("Diagnostics");
      expect(markup).toContain("Next step");
      expect(markup).not.toContain("Approve");
      expect(markup).not.toContain("Answer");
      expect(markup).not.toContain("Retry");
    },
  );

  it("renders hostile bounded evidence only as text", () => {
    const markup = renderToStaticMarkup(
      <ProviderStatusPanel
        onOpenTerminal={() => {}}
        status={status("failed")}
      />,
    );

    expect(markup).toContain("&lt;failed&gt; observer detail");
    expect(markup).toContain("&lt;activity&gt; is available");
    expect(markup).toContain("&lt;script&gt;fixed diagnostic&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("omits the terminal action after the direct process ends", () => {
    const ended = {
      ...status("failed"),
      terminalAvailable: false,
      terminalDetail:
        "Direct terminal process exited; provider health does not prove task outcome.",
    };
    const markup = renderToStaticMarkup(
      <ProviderStatusPanel onOpenTerminal={() => {}} status={ended} />,
    );

    expect(markup).toContain("Terminal process is not live");
    expect(markup).not.toContain("Open terminal");
  });
});
