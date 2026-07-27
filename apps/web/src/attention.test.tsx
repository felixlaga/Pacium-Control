import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttentionEvidenceCard } from "./attention.js";

describe("attention evidence rendering", () => {
  it("renders process-only uncertainty with source and confidence text", () => {
    const markup = renderToStaticMarkup(
      <AttentionEvidenceCard
        attention={{
          state: "unknown",
          source: "process",
          confidence: "low",
          observedAt: "2026-07-27T10:00:00.000Z",
          staleAfter: "2026-07-27T10:05:00.000Z",
          reason:
            "Process is live; no provider activity observer is connected yet.",
        }}
      />,
    );

    expect(markup).toContain("Unknown");
    expect(markup).toContain("Process observed");
    expect(markup).toContain("Low confidence");
    expect(markup).toContain("no provider activity observer");
    expect(markup.toLocaleLowerCase()).not.toContain(">working<");
  });
});
