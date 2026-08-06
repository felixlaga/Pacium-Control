import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RepoDoc } from "./repo-docs-model.js";
import {
  autoSelectDocPath,
  docStatusNotice,
  docTabLabel,
  loadRepoDocsPanelState,
  repoDocsEmptyMessage,
  RepoDocsPanel,
  RepoDocsPanelView,
  type RepoDocsPanelState,
} from "./repo-docs-panel.js";

const NOW = "2026-08-05T10:00:00.000Z";

const backlog: RepoDoc = {
  kind: "backlog",
  fileName: "BACKLOG.md",
  path: "/work/alpha/BACKLOG.md",
  status: "stable",
  byteLength: 2_048,
  modifiedAt: "2026-08-05T09:57:00.000Z",
  content: "# Backlog\n\n- ship the terminal panel\n",
};

const needs: RepoDoc = {
  kind: "needs",
  fileName: "NEEDS-FELIX.md",
  path: "/work/alpha/NEEDS-FELIX.md",
  status: "stable",
  byteLength: 512,
  modifiedAt: "2026-08-05T09:59:00.000Z",
  content: "# For the operator\n\nPlease approve the proxy port.\n",
};

const queue: RepoDoc = {
  kind: "queue",
  fileName: "FELIX-QUEUE.md",
  path: "/work/alpha/FELIX-QUEUE.md",
  status: "stable",
  byteLength: 128,
  modifiedAt: "2026-08-05T08:00:00.000Z",
  content: "# Queue\n",
};

function view(overrides: {
  selectedPath?: string | null;
  state: RepoDocsPanelState;
}): string {
  return renderToStaticMarkup(
    <RepoDocsPanelView
      nowIso={NOW}
      onRefresh={() => undefined}
      onSelect={() => undefined}
      repositoryName="alpha"
      root="/work/alpha"
      selectedPath={overrides.selectedPath ?? null}
      state={overrides.state}
    />,
  );
}

describe("loadRepoDocsPanelState", () => {
  it("returns the docs from the injected fetcher", async () => {
    const fetchDocs = vi.fn().mockResolvedValue({
      root: "/work/alpha",
      docs: [backlog, needs],
    });

    const state = await loadRepoDocsPanelState(fetchDocs, {
      accessToken: "secret",
      root: "/work/alpha",
    });

    expect(fetchDocs).toHaveBeenCalledOnce();
    expect(fetchDocs).toHaveBeenCalledWith({
      accessToken: "secret",
      root: "/work/alpha",
    });
    expect(state).toEqual({ kind: "ready", docs: [backlog, needs] });
  });

  it("captures a fetch failure as an error state", async () => {
    const fetchDocs = vi
      .fn()
      .mockRejectedValue(new Error("Repository files failed with HTTP 503"));

    await expect(
      loadRepoDocsPanelState(fetchDocs, { accessToken: null, root: "/x" }),
    ).resolves.toEqual({
      kind: "error",
      message: "Repository files failed with HTTP 503",
    });
  });
});

describe("RepoDocsPanel initial render", () => {
  it("shows the repository name, refresh control, and reading state", () => {
    const fetchDocs = vi.fn().mockResolvedValue({ root: "/x", docs: [] });
    const markup = renderToStaticMarkup(
      <RepoDocsPanel
        accessToken={null}
        fetchDocs={fetchDocs}
        repositoryName="alpha"
        root="/work/alpha"
      />,
    );

    expect(markup).toContain('aria-label="Repository files"');
    expect(markup).toContain(">alpha</span>");
    expect(markup).toContain('aria-label="Refresh files"');
    expect(markup).toContain("Reading files…");
  });
});

describe("RepoDocsPanelView", () => {
  it("renders tabs with cleaned labels and marks attention with dot and text", () => {
    const markup = view({
      selectedPath: backlog.path,
      state: { kind: "ready", docs: [backlog, needs, queue] },
    });

    expect(markup).toContain(">Backlog</span>");
    expect(markup).toContain(">Needs Felix</span>");
    expect(markup).toContain(">Queue</span>");
    expect(markup).toContain('aria-label="Needs Felix, needs attention"');
    expect(markup).toContain('class="repo-docs-attention"');
    expect(markup).toContain("ship the terminal panel");
    expect(markup).toContain("Updated 3m ago · 2.0 KB");
  });

  it("switches the rendered body with the selected tab", () => {
    const docs: RepoDoc[] = [backlog, needs, queue];
    const backlogMarkup = view({
      selectedPath: backlog.path,
      state: { kind: "ready", docs },
    });
    const needsMarkup = view({
      selectedPath: needs.path,
      state: { kind: "ready", docs },
    });

    expect(backlogMarkup).toContain("ship the terminal panel");
    expect(backlogMarkup).not.toContain("approve the proxy port");
    expect(needsMarkup).toContain("approve the proxy port");
    expect(needsMarkup).not.toContain("ship the terminal panel");
    expect(needsMarkup).toContain('aria-pressed="true"');
  });

  it("teaches the file convention when no docs exist", () => {
    const markup = view({ state: { kind: "ready", docs: [] } });

    expect(markup).toContain("No agent files here yet.");
    expect(markup).toContain(
      "Pacium looks for BACKLOG.md, NEEDS-&lt;NAME&gt;.md and &lt;NAME&gt;-QUEUE.md in alpha.",
    );
    expect(markup).not.toContain("repo-docs-tab ");
  });

  it("shows the fetch error with a retry action", () => {
    const markup = view({
      state: {
        kind: "error",
        message: "Repository files failed with HTTP 503",
      },
    });

    expect(markup).toContain("Repository files failed with HTTP 503");
    expect(markup).toContain(">Retry</button>");
  });

  it("labels non-stable files honestly in body and footer", () => {
    const oversized: RepoDoc = {
      ...backlog,
      status: "oversized",
      byteLength: 262_144,
      content: null,
    };
    const markup = view({
      selectedPath: oversized.path,
      state: { kind: "ready", docs: [oversized] },
    });

    expect(markup).toContain("Too large to display (256.0 KB)");
    expect(markup).toContain('class="repo-docs-footer-notice"');
  });
});

describe("repo docs helpers", () => {
  it("auto-selects attention first, then backlog, then the first doc", () => {
    expect(autoSelectDocPath([backlog, needs, queue])).toBe(needs.path);
    expect(autoSelectDocPath([queue, backlog])).toBe(backlog.path);
    expect(autoSelectDocPath([queue])).toBe(queue.path);
    expect(autoSelectDocPath([])).toBeNull();
  });

  it("keeps distinguishing names when several docs share a kind", () => {
    const felixQueue = queue;
    const alexQueue: RepoDoc = {
      ...queue,
      fileName: "ALEX-QUEUE.md",
      path: "/work/alpha/ALEX-QUEUE.md",
    };

    expect(docTabLabel(felixQueue, [felixQueue])).toBe("Queue");
    expect(docTabLabel(felixQueue, [felixQueue, alexQueue])).toBe(
      "Felix Queue",
    );
    expect(docTabLabel(alexQueue, [felixQueue, alexQueue])).toBe("Alex Queue");
    expect(docTabLabel(needs, [backlog, needs, queue])).toBe("Needs Felix");
    expect(docTabLabel(backlog, [backlog])).toBe("Backlog");
  });

  it("describes every non-stable status in plain language", () => {
    expect(docStatusNotice(backlog)).toBeNull();
    expect(
      docStatusNotice({ ...backlog, status: "empty", content: null }),
    ).toBe("This file is empty.");
    expect(
      docStatusNotice({ ...backlog, status: "changing", content: null }),
    ).toContain("refresh");
    expect(
      docStatusNotice({ ...backlog, status: "invalid_utf8", content: null }),
    ).toContain("UTF-8");
    expect(
      docStatusNotice({ ...backlog, status: "unsafe_type", content: null }),
    ).toContain("not render");
    expect(
      docStatusNotice({ ...backlog, status: "read_error", content: null }),
    ).toContain("Could not read");
  });

  it("falls back to the raw root when it has no basename", () => {
    expect(repoDocsEmptyMessage("/work/alpha/")).toContain("in alpha.");
    expect(repoDocsEmptyMessage("/")).toContain("in /.");
  });
});
