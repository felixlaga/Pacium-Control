import { describe, expect, it, vi } from "vitest";

import {
  fetchDirectoryListing,
  paciumConfigGetMessage,
  paciumConfigReplaceMessage,
  queueApprovalDecisionMessage,
  queueDecisionDeliveryMessage,
  queueDecisionResolutionMessage,
  queueItemInspectMessage,
  queueObserveMessage,
  queueQuestionAnswerMessage,
  repositoryChangesMessage,
  repositoryDiffMessage,
  repositoryHistoryMessage,
  repositoryRefreshMessage,
  repositoryVerificationCancelMessage,
  repositoryVerificationInspectMessage,
  repositoryVerificationRunMessage,
  sessionCreateMessage,
  terminalInputMessage,
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

describe("Pacium config transport", () => {
  it("sends a read without terminal or filesystem authority", () => {
    expect(
      paciumConfigGetMessage("66bd01dc-a1c3-4341-9c3c-153027b7f098"),
    ).toEqual({
      type: "pacium.config.get",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
    });
  });

  it("sends one complete revisioned workspace replacement", () => {
    const workspace = {
      id: "primary",
      label: "Pacium",
      repositories: [],
      roles: { meta: null, orchestrator: null },
      workers: [],
      queueSources: [],
      deliveryMethods: [],
      context: { objective: null, plan: null },
    };
    expect(
      paciumConfigReplaceMessage(
        4,
        workspace,
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "pacium.config.replace",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      expectedRevision: 4,
      workspace,
    });
  });
});

describe("queue observation transport", () => {
  it("requests current configured sources without path or content authority", () => {
    expect(queueObserveMessage("66bd01dc-a1c3-4341-9c3c-153027b7f098")).toEqual(
      {
        type: "pacium.queue.observe",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      },
    );
  });

  it("requests one exact item without a path or content field", () => {
    const requestId = "66bd01dc-a1c3-4341-9c3c-153027b7f098";
    const identity = {
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 7,
      contentHash: "a".repeat(64),
      itemId: "b".repeat(64),
    };
    expect(queueItemInspectMessage(identity, requestId)).toEqual({
      type: "pacium.queue.item.inspect",
      requestId,
      ...identity,
    });
    expect(queueItemInspectMessage(identity, requestId)).not.toHaveProperty(
      "path",
    );
    expect(queueItemInspectMessage(identity, requestId)).not.toHaveProperty(
      "originalText",
    );
  });

  it("builds structurally separate question and approval decisions", () => {
    const identity = {
      workspaceRevision: 4,
      sourceId: "needs-felix",
      observationRevision: 7,
      contentHash: "a".repeat(64),
      itemId: "b".repeat(64),
    };
    expect(
      queueQuestionAnswerMessage(
        identity,
        {
          answer: "Use the smaller verified slice.",
          note: null,
        },
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "pacium.queue.question.answer",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ...identity,
      payload: {
        answer: "Use the smaller verified slice.",
        note: null,
      },
    });
    expect(
      queueApprovalDecisionMessage(
        identity,
        {
          outcome: "denied",
          note: "Risk is not bounded.",
        },
        "5cf69c03-dfb0-4c9c-8373-c501e30af3d0",
      ),
    ).toEqual({
      type: "pacium.queue.approval.decide",
      requestId: "5cf69c03-dfb0-4c9c-8373-c501e30af3d0",
      ...identity,
      payload: {
        outcome: "denied",
        note: "Risk is not bounded.",
      },
    });
  });

  it("delivers only one immutable decision identity", () => {
    const message = queueDecisionDeliveryMessage(
      "28c9142a-8986-43c7-9451-445fd8c13c3e",
      "c".repeat(64),
      "66bd01dc-a1c3-4341-9c3c-153027b7f098",
    );
    expect(message).toEqual({
      type: "pacium.queue.decision.deliver",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
      decisionHash: "c".repeat(64),
    });
    expect(message).not.toHaveProperty("path");
    expect(message).not.toHaveProperty("role");
    expect(message).not.toHaveProperty("payload");
    expect(message).not.toHaveProperty("retry");
  });

  it("sends one exact human-labelled lifecycle request", () => {
    const request = {
      decisionId: "28c9142a-8986-43c7-9451-445fd8c13c3e",
      decisionHash: "c".repeat(64),
      action: "confirmed_not_delivered" as const,
      delivery: {
        deliveryId: "4699b11f-94d3-430a-960e-1c574a03db41",
        deliveryHash: "e".repeat(64),
      },
      relatedDecision: null,
      note: "Verified outside Pacium.",
    };
    expect(
      queueDecisionResolutionMessage(
        request,
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "pacium.queue.decision.resolve",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ...request,
    });
  });
});

describe("session create correlation", () => {
  it("builds the existing fixed-preset request with an exact caller request ID", () => {
    expect(
      sessionCreateMessage(
        {
          cwd: "/work/pacium",
          displayName: "Meta",
          launchPreset: "codex",
          cols: 100,
          rows: 30,
        },
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "session.create",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      payload: {
        cwd: "/work/pacium",
        displayName: "Meta",
        launchPreset: "codex",
        cols: 100,
        rows: 30,
      },
    });
  });

  it("does not manufacture an optional display name", () => {
    expect(
      sessionCreateMessage(
        {
          cwd: "/work",
          launchPreset: "shell",
          cols: 80,
          rows: 24,
        },
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ).payload,
    ).toEqual({
      cwd: "/work",
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
  });
});

describe("terminal input correlation", () => {
  it("preserves the exact caller request, session, and terminal bytes", () => {
    expect(
      terminalInputMessage(
        "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        "Review the failing tests\r",
        "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      ),
    ).toEqual({
      type: "terminal.input",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      data: "Review the failing tests\r",
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
