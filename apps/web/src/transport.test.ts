import { describe, expect, it, vi } from "vitest";

import {
  fetchDirectoryListing,
  repositoryChangesMessage,
  repositoryDiffMessage,
  repositoryHistoryMessage,
  repositoryRefreshMessage,
  repositoryVerificationCancelMessage,
  repositoryVerificationInspectMessage,
  repositoryVerificationRunMessage,
} from "./transport.js";

describe("repository transport", () => {
  it("sends only request and session identity for refresh", () => {
    expect(
      repositoryRefreshMessage(
        "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "session.refreshRepository",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    });
  });

  it("sends only request and session identity for changed files", () => {
    expect(
      repositoryChangesMessage(
        "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "repository.changes",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    });
  });

  it("sends one bounded changed-file selector for diff inspection", () => {
    expect(
      repositoryDiffMessage(
        "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        "src/file.ts",
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "repository.diff",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      path: "src/file.ts",
    });
  });

  it("sends only request and session identity for commit history", () => {
    expect(
      repositoryHistoryMessage(
        "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "repository.history",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    });
  });

  it("sends only server-owned verification identities", () => {
    const sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";
    expect(repositoryVerificationInspectMessage(sessionId, requestId)).toEqual({
      type: "repository.verification.inspect",
      requestId,
      sessionId,
    });
    expect(
      repositoryVerificationRunMessage(sessionId, "verify", requestId),
    ).toEqual({
      type: "repository.verification.run",
      requestId,
      sessionId,
      presetId: "verify",
    });
    expect(
      repositoryVerificationCancelMessage(
        sessionId,
        "03c2723f-e87a-4707-86af-d6fdb1e60f47",
        requestId,
      ),
    ).toEqual({
      type: "repository.verification.cancel",
      requestId,
      sessionId,
      runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
    });
  });
});

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
