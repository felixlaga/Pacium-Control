import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentClassificationCard } from "./agent-classification.js";

describe("agent classification evidence", () => {
  it("renders source and confidence without inventing activity", () => {
    const markup = renderToStaticMarkup(
      <AgentClassificationCard
        classification={{
          type: "codex",
          label: "Codex CLI",
          source: "launch_preset",
          confidence: "confirmed",
          observedAt: "2026-07-27T10:00:00.000Z",
        }}
      />,
    );

    expect(markup).toContain("Codex CLI");
    expect(markup).toContain("<dt>Evidence</dt><dd>Launch preset</dd>");
    expect(markup).toContain("<dt>Confidence</dt><dd>Confirmed</dd>");
    expect(markup).toContain("does not confirm current activity or attention");
    expect(markup.toLocaleLowerCase()).not.toContain("working");
  });
});
