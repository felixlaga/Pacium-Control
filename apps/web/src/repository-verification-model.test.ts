import type { VerificationObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  acceptVerificationResponse,
  acceptVerificationUpdate,
  beginVerificationAction,
  beginVerificationInspect,
  IDLE_REPOSITORY_VERIFICATION,
  interruptVerificationRequest,
  visibleVerificationObservation,
} from "./repository-verification-model.js";

const sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";
const observation: VerificationObservation = {
  status: "ready",
  configured: true,
  root: "/work/pacium",
  observedAt: "2026-07-27T10:00:00.000Z",
  presets: [
    {
      id: "verify",
      label: "Verify",
      description: "Run checks",
      executable: "/opt/bin/pnpm",
      args: ["verify"],
      timeoutMs: 600_000,
    },
  ],
  run: null,
  error: null,
};

describe("repository verification view state", () => {
  it("loads lazily and rejects stale or cross-session responses", () => {
    const loading = beginVerificationInspect(
      IDLE_REPOSITORY_VERIFICATION,
      sessionId,
      "request-1",
    );
    expect(
      acceptVerificationResponse(loading, "stale", sessionId, observation),
    ).toBe(loading);
    expect(
      acceptVerificationResponse(
        loading,
        "request-1",
        "other-session",
        observation,
      ),
    ).toBe(loading);
    expect(
      acceptVerificationResponse(loading, "request-1", sessionId, observation),
    ).toMatchObject({ status: "loaded", observation });
  });

  it("keeps evidence visible while inspect is refreshed", () => {
    const loaded = acceptVerificationResponse(
      beginVerificationInspect(
        IDLE_REPOSITORY_VERIFICATION,
        sessionId,
        "request-1",
      ),
      "request-1",
      sessionId,
      observation,
    );
    const refreshing = beginVerificationInspect(loaded, sessionId, "request-2");

    expect(visibleVerificationObservation(refreshing)).toBe(observation);
    expect(interruptVerificationRequest(refreshing)).toMatchObject({
      status: "loaded",
      observation,
    });
  });

  it("tracks explicit run and cancel requests without hiding evidence", () => {
    const loaded = acceptVerificationResponse(
      beginVerificationInspect(
        IDLE_REPOSITORY_VERIFICATION,
        sessionId,
        "inspect",
      ),
      "inspect",
      sessionId,
      observation,
    );
    const runningRequest = beginVerificationAction(
      loaded,
      sessionId,
      "run",
      "run",
    );
    expect(runningRequest).toMatchObject({
      status: "loaded",
      pendingRequestId: "run",
      pendingAction: "run",
      observation,
    });
    expect(interruptVerificationRequest(runningRequest)).toMatchObject({
      pendingRequestId: null,
      pendingAction: null,
      observation,
    });
  });

  it("accepts server-owned updates and makes late responses stale", () => {
    const loaded = acceptVerificationResponse(
      beginVerificationInspect(
        IDLE_REPOSITORY_VERIFICATION,
        sessionId,
        "inspect",
      ),
      "inspect",
      sessionId,
      observation,
    );
    const pending = beginVerificationAction(
      loaded,
      sessionId,
      "run-request",
      "run",
    );
    const runningObservation: VerificationObservation = {
      ...observation,
      run: {
        runId: "03c2723f-e87a-4707-86af-d6fdb1e60f47",
        presetId: "verify",
        status: "running",
        startedAt: "2026-07-27T10:00:01.000Z",
        completedAt: null,
        durationMs: null,
        headCommitAtStart: "a".repeat(40),
        headCommitAtEnd: null,
        headComparison: null,
        exitCode: null,
        signal: null,
        terminationForced: false,
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        error: null,
      },
    };
    const updated = acceptVerificationUpdate(
      pending,
      sessionId,
      runningObservation,
    );
    expect(updated).toMatchObject({
      status: "loaded",
      pendingRequestId: null,
      observation: runningObservation,
    });
    expect(
      acceptVerificationResponse(
        updated,
        "run-request",
        sessionId,
        observation,
      ),
    ).toBe(updated);
  });
});
