import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumPromptComposer } from "./pacium-prompt-composer.js";
import type { PaciumPromptState } from "./pacium-prompt-model.js";
import type { PaciumPromptTargetProjection } from "./pacium-prompt-target-model.js";

describe("Pacium prompt composer semantics", () => {
  it("requires an explicit available target and explains the terminal boundary", () => {
    const markup = renderComposer();

    expect(markup).toContain('aria-labelledby="pacium-prompt-heading"');
    expect(markup).toContain("<option");
    expect(markup).toContain('value="" selected="">Select target</option>');
    expect(markup).toContain("Meta — Connected");
    expect(markup).toContain("Orchestrator — Ended");
    expect(markup).toContain(
      'disabled="" value="role:orchestrator">Orchestrator',
    );
    expect(markup).toContain("not an approval");
    expect(markup).toContain("does not confirm agent handling");
    expect(markup).toContain("<button");
    expect(markup).toContain("disabled");
  });

  it("renders exact selected evidence and enables one valid send", () => {
    const markup = renderComposer({
      draft: "Review the failing tests",
      targetId: "role:meta",
      pending: null,
    });

    expect(markup).toContain("Meta · Connected · Codex · /work/pacium");
    expect(markup).toContain("Ready. Press Command or Control + Enter");
    expect(markup).toContain('<button class="primary-button" type="button">');
  });

  it("locks the fields and duplicate send while pending", () => {
    const markup = renderComposer({
      draft: "Inspect status",
      targetId: "role:meta",
      pending: {
        requestId: "request-1",
        targetId: "role:meta",
        sessionId: "session-meta",
      },
    });

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Duplicate send is locked");
    expect(markup).toContain("Sending…");
    expect(markup.match(/disabled/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("escapes hostile configured labels and terminal evidence", () => {
    const projection = targets();
    projection.targets[0] = {
      ...projection.targets[0]!,
      label: "<script>target()</script>",
      detail: '<img src="x" onerror="terminal()">',
    };
    const markup = renderComposer(
      {
        draft: "Inspect",
        targetId: "role:meta",
        pending: null,
      },
      projection,
    );

    expect(markup).toContain("&lt;script&gt;target()&lt;/script&gt;");
    expect(markup).toContain("&lt;img src=&quot;x&quot;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
  });
});

function renderComposer(
  state: PaciumPromptState = {
    draft: "",
    targetId: null,
    pending: null,
  },
  projection: PaciumPromptTargetProjection = targets(),
) {
  return renderToStaticMarkup(
    <PaciumPromptComposer
      onDraftChange={() => undefined}
      onSend={() => undefined}
      onTargetChange={() => undefined}
      projection={projection}
      state={state}
    />,
  );
}

function targets(): PaciumPromptTargetProjection {
  return {
    status: "ready",
    message: "Choose one exact live terminal target.",
    targets: [
      {
        id: "role:meta",
        kind: "role",
        label: "Meta",
        status: "connected",
        statusLabel: "Connected",
        detail: "Codex · /work/pacium",
        sessionId: "session-meta",
        available: true,
      },
      {
        id: "role:orchestrator",
        kind: "role",
        label: "Orchestrator",
        status: "ended",
        statusLabel: "Ended",
        detail: "Codex · /work/pacium",
        sessionId: "session-orchestrator",
        available: false,
      },
    ],
  };
}
