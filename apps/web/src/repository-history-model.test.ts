import type { GitHistoryObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_REPOSITORY_HISTORY,
  acceptRepositoryHistoryResponse,
  beginRepositoryHistoryRequest,
  interruptRepositoryHistoryRequest,
  visibleRepositoryHistory,
} from "./repository-history-model.js";

const sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";
const observation: GitHistoryObservation = {
  status: "ready",
  root: "/work/pacium",
  headCommit: "a".repeat(40),
  observedAt: "2026-07-27T11:00:00.000Z",
  commits: [
    {
      id: "a".repeat(40),
      parents: ["b".repeat(40)],
      authorName: "Pacium Agent",
      authoredAt: "2026-07-27T10:30:00+02:00",
      subject: "Bounded history",
    },
  ],
  truncated: false,
  error: null,
};

describe("repository history request state", () => {
  it("retains prior evidence while refreshing the same session", () => {
    const loading = beginRepositoryHistoryRequest(
      IDLE_REPOSITORY_HISTORY,
      sessionId,
      "request-1",
    );
    expect(visibleRepositoryHistory(loading)).toBeNull();
    const loaded = acceptRepositoryHistoryResponse(
      loading,
      "request-1",
      sessionId,
      observation,
    );
    const refreshing = beginRepositoryHistoryRequest(
      loaded,
      sessionId,
      "request-2",
    );
    expect(visibleRepositoryHistory(refreshing)).toBe(observation);
    expect(
      acceptRepositoryHistoryResponse(
        refreshing,
        "request-2",
        sessionId,
        observation,
      ),
    ).toMatchObject({ status: "loaded", requestId: "request-2" });
  });

  it("does not carry evidence across sessions", () => {
    const firstLoading = beginRepositoryHistoryRequest(
      IDLE_REPOSITORY_HISTORY,
      sessionId,
      "request-1",
    );
    const loaded = acceptRepositoryHistoryResponse(
      firstLoading,
      "request-1",
      sessionId,
      observation,
    );
    const other = beginRepositoryHistoryRequest(
      loaded,
      "7ebdf988-3521-4717-a308-2a6d4ff23d4e",
      "request-2",
    );
    expect(visibleRepositoryHistory(other)).toBeNull();
  });

  it("ignores stale, cross-session, and unsolicited responses", () => {
    const loading = beginRepositoryHistoryRequest(
      IDLE_REPOSITORY_HISTORY,
      sessionId,
      "new-request",
    );
    expect(
      acceptRepositoryHistoryResponse(
        loading,
        "old-request",
        sessionId,
        observation,
      ),
    ).toBe(loading);
    expect(
      acceptRepositoryHistoryResponse(
        loading,
        "new-request",
        "7ebdf988-3521-4717-a308-2a6d4ff23d4e",
        observation,
      ),
    ).toBe(loading);
    expect(
      acceptRepositoryHistoryResponse(
        IDLE_REPOSITORY_HISTORY,
        "unsolicited",
        sessionId,
        observation,
      ),
    ).toBe(IDLE_REPOSITORY_HISTORY);
  });

  it("recovers from disconnect without discarding prior evidence", () => {
    const firstLoading = beginRepositoryHistoryRequest(
      IDLE_REPOSITORY_HISTORY,
      sessionId,
      "request-1",
    );
    expect(interruptRepositoryHistoryRequest(firstLoading)).toBe(
      IDLE_REPOSITORY_HISTORY,
    );
    const loaded = acceptRepositoryHistoryResponse(
      firstLoading,
      "request-1",
      sessionId,
      observation,
    );
    const refreshing = beginRepositoryHistoryRequest(
      loaded,
      sessionId,
      "request-2",
    );
    expect(interruptRepositoryHistoryRequest(refreshing)).toEqual({
      status: "loaded",
      requestId: "request-2",
      sessionId,
      observation,
    });
    expect(interruptRepositoryHistoryRequest(loaded)).toBe(loaded);
  });
});
