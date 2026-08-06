import { describe, expect, it, vi } from "vitest";

import {
  docNeedsAttention,
  fetchRepoDocs,
  summarizeDocFreshness,
  type RepoDoc,
  type RepoDocsResponse,
} from "./repo-docs-model.js";

const stableDoc: RepoDoc = {
  kind: "backlog",
  fileName: "BACKLOG.md",
  path: "/work/alpha/BACKLOG.md",
  status: "stable",
  byteLength: 2_048,
  modifiedAt: "2026-08-05T09:57:00.000Z",
  content: "# Backlog\n\n- first item\n",
};

const validResponse: RepoDocsResponse = {
  root: "/work/alpha",
  docs: [stableDoc],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchRepoDocs", () => {
  it("reads with GET, root query, and bearer token over http", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(validResponse));

    await expect(
      fetchRepoDocs({
        accessToken: "secret",
        fetcher,
        root: "/work/alpha",
        secure: false,
      }),
    ).resolves.toEqual(validResponse);

    expect(fetcher).toHaveBeenCalledOnce();
    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe("/api/pacium/repo-docs?root=%2Fwork%2Falpha");
    expect(call?.[1]?.method).toBe("GET");
    expect(call?.[1]?.credentials).toBe("same-origin");
    expect(call?.[1]?.body).toBeUndefined();
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
  });

  it("reads with a same-origin POST body over https", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(validResponse));

    await fetchRepoDocs({
      accessToken: "secret",
      fetcher,
      root: "/work/alpha",
      secure: true,
    });

    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe("/api/pacium/repo-docs");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.body).toBe(JSON.stringify({ root: "/work/alpha" }));
    expect(new Headers(call?.[1]?.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("uses the global fetch and omits authorization without a token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(validResponse));
    vi.stubGlobal("fetch", fetcher);
    try {
      await fetchRepoDocs({ accessToken: null, root: "/work/alpha" });
    } finally {
      vi.unstubAllGlobals();
    }

    const call = fetcher.mock.calls[0];
    expect(call?.[1]?.method).toBe("GET");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBeNull();
  });

  it("surfaces a bounded server error message", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "Root is outside scope" }, 400));

    await expect(
      fetchRepoDocs({ accessToken: "secret", fetcher, root: "/x" }),
    ).rejects.toThrow("Root is outside scope");
  });

  it("falls back to the HTTP status when the error body is unusable", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("boom", { status: 500 }));

    await expect(
      fetchRepoDocs({ accessToken: "secret", fetcher, root: "/x" }),
    ).rejects.toThrow("Repository files failed with HTTP 500");
  });

  it.each([
    ["not an object", "nope"],
    ["missing docs", { root: "/x" }],
    ["too many docs", { root: "/x", docs: new Array(17).fill(stableDoc) }],
    ["bad kind", { root: "/x", docs: [{ ...stableDoc, kind: "notes" }] }],
    ["bad status", { root: "/x", docs: [{ ...stableDoc, status: "gone" }] }],
    [
      "stable without content",
      { root: "/x", docs: [{ ...stableDoc, content: null }] },
    ],
    [
      "content on a non-stable doc",
      { root: "/x", docs: [{ ...stableDoc, status: "changing" }] },
    ],
    [
      "negative byteLength",
      { root: "/x", docs: [{ ...stableDoc, byteLength: -1 }] },
    ],
  ])("rejects a structurally invalid response: %s", async (_label, body) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body));

    await expect(
      fetchRepoDocs({ accessToken: "secret", fetcher, root: "/x" }),
    ).rejects.toThrow(/invalid repository file/);
  });
});

describe("docNeedsAttention", () => {
  it("flags a stable needs file with body text beyond its title", () => {
    expect(
      docNeedsAttention({
        ...stableDoc,
        kind: "needs",
        content: "# For the operator\n\nPlease pick a port for the proxy.\n",
      }),
    ).toBe(true);
  });

  it("ignores a needs file that only holds headings and blank lines", () => {
    expect(
      docNeedsAttention({
        ...stableDoc,
        kind: "needs",
        content: "# For the operator\n\n## Later\n",
      }),
    ).toBe(false);
  });

  it("flags any stable doc with an explicit marker heading", () => {
    expect(
      docNeedsAttention({
        ...stableDoc,
        content: "# Backlog\n\n## Question\nWhich port should the proxy use?\n",
      }),
    ).toBe(true);
    expect(
      docNeedsAttention({
        ...stableDoc,
        kind: "queue",
        content: "Approval request: delete the stale worktree\n",
      }),
    ).toBe(true);
  });

  it("does not treat marker-like words inside longer words as markers", () => {
    expect(
      docNeedsAttention({
        ...stableDoc,
        content: "# Backlog\n\n- questionable naming cleanup\n",
      }),
    ).toBe(false);
  });

  it("never flags docs without stable content", () => {
    expect(
      docNeedsAttention({
        ...stableDoc,
        kind: "needs",
        status: "changing",
        content: null,
      }),
    ).toBe(false);
    expect(
      docNeedsAttention({
        ...stableDoc,
        kind: "needs",
        status: "empty",
        content: null,
      }),
    ).toBe(false);
  });
});

describe("summarizeDocFreshness", () => {
  const now = "2026-08-05T10:00:00.000Z";

  it("formats seconds, minutes, hours, and days", () => {
    expect(
      summarizeDocFreshness(
        { ...stableDoc, byteLength: 4_198, modifiedAt: now },
        now,
      ),
    ).toBe("Updated 0s ago · 4.1 KB");
    expect(
      summarizeDocFreshness(
        {
          ...stableDoc,
          byteLength: 4_198,
          modifiedAt: "2026-08-05T09:57:00.000Z",
        },
        now,
      ),
    ).toBe("Updated 3m ago · 4.1 KB");
    expect(
      summarizeDocFreshness(
        {
          ...stableDoc,
          byteLength: 1_024,
          modifiedAt: "2026-08-05T04:00:00.000Z",
        },
        now,
      ),
    ).toBe("Updated 6h ago · 1.0 KB");
    expect(
      summarizeDocFreshness(
        {
          ...stableDoc,
          byteLength: 512,
          modifiedAt: "2026-08-03T10:00:00.000Z",
        },
        now,
      ),
    ).toBe("Updated 2d ago · 0.5 KB");
  });

  it("shows a date once the file is older than a month", () => {
    expect(
      summarizeDocFreshness(
        {
          ...stableDoc,
          byteLength: 2_048,
          modifiedAt: "2026-01-04T10:00:00.000Z",
        },
        now,
      ),
    ).toBe("Updated 2026-01-04 · 2.0 KB");
  });

  it("stays honest when the modified time is missing or invalid", () => {
    expect(
      summarizeDocFreshness(
        { ...stableDoc, byteLength: 2_048, modifiedAt: null },
        now,
      ),
    ).toBe("Modified time unknown · 2.0 KB");
    expect(
      summarizeDocFreshness(
        { ...stableDoc, byteLength: 2_048, modifiedAt: "not a date" },
        now,
      ),
    ).toBe("Modified time unknown · 2.0 KB");
  });

  it("never shows a negative age when clocks skew", () => {
    expect(
      summarizeDocFreshness(
        {
          ...stableDoc,
          byteLength: 2_048,
          modifiedAt: "2026-08-05T10:05:00.000Z",
        },
        now,
      ),
    ).toBe("Updated 0s ago · 2.0 KB");
  });
});
