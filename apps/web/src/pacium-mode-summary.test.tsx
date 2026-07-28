import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumModeSummaryCard } from "./pacium-mode-summary.js";

describe("Pacium mode summary semantics", () => {
  it("renders one compact workspace row", () => {
    const markup = renderToStaticMarkup(
      <PaciumModeSummaryCard
        onOpenContext={() => undefined}
        onRetry={() => undefined}
        summary={{
          status: "ready",
          title: "Agent & oversight",
          detail: "Configured references only.",
          freshness: "Server definition",
          canRetry: true,
          stats: [
            { label: "Roles", value: "2/2" },
            { label: "Workers", value: "3" },
          ],
        }}
      />,
    );

    expect(markup).toContain('aria-label="Pacium workspace definition"');
    expect(markup).toContain("Agent &amp; oversight");
    expect(markup).not.toContain("<dl>");
    expect(markup).toContain(">Context</button>");
  });

  it("renders hostile error evidence as text and exposes bounded retry", () => {
    const markup = renderToStaticMarkup(
      <PaciumModeSummaryCard
        onOpenContext={() => undefined}
        onRetry={() => undefined}
        summary={{
          status: "error",
          title: "Pacium configuration unavailable",
          detail: "<script>terminal=false</script>",
          freshness: "Last accepted definition · disconnected",
          canRetry: false,
          stats: [],
        }}
      />,
    );

    expect(markup).toContain("&lt;script&gt;terminal=false&lt;/script&gt;");
    expect(markup).toContain("<button disabled");
    expect(markup).toContain("Retry");
  });
});
