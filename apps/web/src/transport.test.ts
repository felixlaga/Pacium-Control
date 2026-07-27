import { describe, expect, it, vi } from "vitest";

import { fetchDirectoryListing } from "./transport.js";

describe("directory transport", () => {
  it("sends the ephemeral token and validates the response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          currentPath: "/work",
          parentPath: "/",
          homePath: "/Users/operator",
          defaultPath: "/work",
          entries: [],
          truncated: false,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      fetchDirectoryListing({
        accessToken: "secret",
        path: "/work",
        fetcher,
      }),
    ).resolves.toMatchObject({ currentPath: "/work" });
    expect(fetcher).toHaveBeenCalledOnce();
    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe("/api/directories?path=%2Fwork");
    expect(call?.[1]?.credentials).toBe("same-origin");
    expect(new Headers(call?.[1]?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
  });

  it("surfaces a bounded server error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "Directory unavailable" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      fetchDirectoryListing({
        accessToken: "secret",
        fetcher,
      }),
    ).rejects.toThrow("Directory unavailable");
  });
});
