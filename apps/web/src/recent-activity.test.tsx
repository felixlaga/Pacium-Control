import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RecentActivity } from "./recent-activity-model.js";
import {
  RecentActivityPanel,
  TerminalFallbackResult,
} from "./recent-activity.js";

const activity: RecentActivity = {
  current: {
    attention: {
      state: "unknown",
      source: "process",
      confidence: "low",
      observedAt: "2026-07-27T10:06:00.000Z",
      staleAfter: "2026-07-27T10:11:00.000Z",
      reason: "Process is live; no provider observer is connected.",
    },
    processState: "live",
    processDetail: "Process is live; assigned-task activity is unverified.",
  },
  facts: [
    {
      id: "provider:codex:approval-1",
      kind: "provider_approval",
      tone: "attention",
      source: "provider",
      title: "Approval requested",
      detail: "Command approval requested.",
      metadata: ["Codex", "Provider native", "Confirmed"],
      target: "terminal",
      timestamp: "2026-07-27T10:06:00.000Z",
      timestampMeaning: "occurred",
    },
    {
      id: "git:commit:abc",
      kind: "git_commit",
      tone: "neutral",
      source: "git",
      title: "<script>hostile subject</script>",
      detail: "Git commit abcdef12 · author recorded as <operator>",
      metadata: ["Git history", "abcdef12"],
      target: "history",
      timestamp: "2026-07-27T10:05:00.000Z",
      timestampMeaning: "occurred",
    },
    {
      id: "git:changes:time",
      kind: "git_changes",
      tone: "neutral",
      source: "git",
      title: "2 changed files observed",
      detail: "+12 −3",
      metadata: ["Git observed", "2 changed"],
      target: "changes",
      timestamp: "2026-07-27T10:04:00.000Z",
      timestampMeaning: "observed",
    },
  ],
  sources: [
    {
      id: "provider",
      label: "Codex observer",
      status: "ready",
      detail: "Native observer connected. Fresh until 10:10.",
    },
    {
      id: "changes",
      label: "Git changes",
      status: "ready",
      detail: "2 changed files observed.",
    },
    {
      id: "history",
      label: "Git history",
      status: "ready",
      detail: "4 recent commits inspected.",
    },
    {
      id: "verification",
      label: "Verification",
      status: "empty",
      detail: "Verification is not configured.",
    },
  ],
  terminalFallback: {
    recommended: false,
    reason:
      "Fresh provider evidence is available. Open Terminal from a card for raw context.",
    boundaryKey: "session:3:codex:ready",
  },
  loading: false,
  partial: false,
};

describe("recent activity presentation", () => {
  it("separates current evidence, facts, sources, and timestamp meaning", () => {
    const markup = render(activity);

    expect(markup).toContain("Current evidence");
    expect(markup).toContain("Process observed");
    expect(markup).toContain("Low confidence");
    expect(markup).toContain("Recent facts");
    expect(markup).toContain("Occurred");
    expect(markup).toContain("Observed");
    expect(markup).toContain("Evidence sources");
    expect(markup).toContain("Approval requested");
    expect(markup).toContain("Codex observer");
    expect(markup).toContain("Validated local evidence only");
    expect(markup).toContain("activity-card is-attention");
    expect(markup).toContain("Open Terminal source for Approval requested");
    expect(markup).toContain("Open History source");
    expect(markup).toContain("Open Changes source");
  });

  it("renders hostile evidence as text and never introduces narrative HTML", () => {
    const markup = render(activity);

    expect(markup).toContain("&lt;script&gt;hostile subject&lt;/script&gt;");
    expect(markup).toContain("author recorded as &lt;operator&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("shows refreshing, empty, and partial states without PTY-loss claims", () => {
    const markup = render({
      ...activity,
      facts: [],
      sources: activity.sources.map((source, index) =>
        index === 0
          ? {
              ...source,
              status: "loading",
              detail: "Reading bounded local evidence.",
            }
          : index === 1
            ? {
                ...source,
                status: "error",
                detail: "History inspection timed out.",
              }
            : source,
      ),
      loading: true,
      partial: true,
    });

    expect(markup).toContain("Reading bounded local evidence");
    expect(markup).toContain("Refreshing…");
    expect(markup).toContain("disabled");
    expect(markup).toContain("No valid recent provider");
    expect(markup).toContain("History inspection timed out.");
    expect(markup).toContain("selected terminal remains available");
  });

  it("teaches the next action when no terminal is selected", () => {
    const markup = renderToStaticMarkup(
      <RecentActivityPanel
        activity={null}
        connectionBoundary="connected"
        onOpenSource={() => {}}
        onReadTerminalExcerpt={() => null}
        onRefresh={() => {}}
      />,
    );

    expect(markup).toContain("No terminal selected");
    expect(markup).toContain("Select or create a terminal");
    expect(markup).toContain("disabled");
  });

  it("offers terminal fallback only when the activity model recommends it", () => {
    const fallback = render({
      ...activity,
      terminalFallback: {
        recommended: true,
        reason:
          "Provider evidence is not currently ready. A bounded terminal peek can provide low-confidence context.",
        boundaryKey: "session:3:unavailable",
      },
    });

    expect(fallback).toContain("Terminal fallback");
    expect(fallback).toContain("Show recent terminal text");
    expect(fallback).toContain("low-confidence context");
    expect(fallback).not.toContain("Terminal-derived");
    expect(render(activity)).not.toContain("Show recent terminal text");
  });

  it("labels ready, empty, and unavailable terminal fallback without status inference", () => {
    const ready = renderToStaticMarkup(
      <TerminalFallbackResult
        result={{
          status: "ready",
          text: "<script>terminal text</script>",
          lineCount: 1,
          truncated: true,
        }}
      />,
    );
    const empty = renderToStaticMarkup(
      <TerminalFallbackResult
        result={{
          status: "empty",
          text: "",
          lineCount: 0,
          truncated: false,
        }}
      />,
    );
    const unavailable = renderToStaticMarkup(
      <TerminalFallbackResult result="unavailable" />,
    );

    expect(ready).toContain("Terminal-derived");
    expect(ready).toContain("Low confidence");
    expect(ready).toContain("Not interpreted");
    expect(ready).toContain("&lt;script&gt;terminal text&lt;/script&gt;");
    expect(ready).not.toContain("<script>");
    expect(empty).toContain("No agent state was inferred");
    expect(unavailable).toContain("process state is unchanged");
  });
});

function render(candidate: RecentActivity): string {
  return renderToStaticMarkup(
    <RecentActivityPanel
      activity={candidate}
      connectionBoundary="connected"
      onOpenSource={() => {}}
      onReadTerminalExcerpt={() => null}
      onRefresh={() => {}}
    />,
  );
}
