import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PaciumWorkersProjection } from "./pacium-worker-model.js";
import { PaciumWorkers } from "./pacium-workers.js";

describe("Pacium configured worker rendering", () => {
  it("renders compact source-labelled evidence and exact Open control", () => {
    const markup = renderToStaticMarkup(
      <PaciumWorkers onOpen={vi.fn()} projection={readyProjection()} />,
    );
    expect(markup).toContain('aria-labelledby="pacium-workers-heading"');
    expect(markup).toContain("Implementation");
    expect(markup).toContain("Live process");
    expect(markup).toContain("Codex · Codex CLI");
    expect(markup).toContain("Unknown");
    expect(markup).toContain("1 changed");
    expect(markup).toContain(">Open</button>");
    expect(markup).toContain("Process observed · Low confidence");
    expect(markup).toContain("authorship unverified");
    expect(markup).toContain(
      '<span class="visually-hidden">Process observed · Low confidence',
    );
  });

  it("escapes hostile labels and evidence", () => {
    const projection = readyProjection();
    projection.workers[0]!.label = "</strong><script>worker()</script>";
    projection.workers[0]!.repositoryEvidence =
      '"><img src=x onerror=worker()>';
    const markup = renderToStaticMarkup(
      <PaciumWorkers onOpen={vi.fn()} projection={projection} />,
    );
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;worker()&lt;/script&gt;");
    expect(markup).toContain("&lt;img src=x onerror=worker()&gt;");
  });

  it("does not show Open for missing or preset-only workers", () => {
    const projection = readyProjection();
    projection.workers[0] = {
      ...projection.workers[0]!,
      status: "missing",
      statusLabel: "Missing",
      sessionId: "10000000-0000-4000-8000-000000000001",
      canOpen: false,
    };
    const markup = renderToStaticMarkup(
      <PaciumWorkers onOpen={vi.fn()} projection={projection} />,
    );
    expect(markup).not.toContain(">Open</button>");
    expect(markup).toContain("Missing");
  });

  it("teaches loading, error, and empty configured states", () => {
    for (const projection of [
      {
        status: "loading" as const,
        detail: "Reading configured worker identities.",
        workers: [],
      },
      {
        status: "error" as const,
        detail: "Configured worker identities are unavailable.",
        workers: [],
      },
      {
        status: "ready" as const,
        detail:
          "No workers are configured. Ordinary terminals remain available.",
        workers: [],
      },
    ]) {
      const markup = renderToStaticMarkup(
        <PaciumWorkers onOpen={vi.fn()} projection={projection} />,
      );
      expect(markup).toContain(projection.detail);
      expect(markup).not.toContain(">Open</button>");
    }
  });
});

function readyProjection(): PaciumWorkersProjection {
  return {
    status: "ready",
    detail:
      "Configured identities only. Process evidence does not prove task progress.",
    workers: [
      {
        id: "implementation",
        label: "Implementation",
        status: "live",
        statusLabel: "Live process",
        commandLabel: "Codex · Codex CLI",
        commandEvidence: "launch preset · confirmed confidence",
        repositoryLabel: "Pacium Control",
        repositoryEvidence: "codex/worker · linked worktree",
        attentionLabel: "Unknown",
        attentionEvidence:
          "Process observed · Low confidence · Live process does not prove work.",
        attentionObservedAt: "2026-07-27T12:00:00.000Z",
        changesLabel: "1 changed",
        changesEvidence:
          "Git observed · +3 −1 known lines · authorship unverified",
        sessionId: "10000000-0000-4000-8000-000000000001",
        canOpen: true,
      },
    ],
  };
}
