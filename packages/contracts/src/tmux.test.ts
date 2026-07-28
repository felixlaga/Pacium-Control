import { describe, expect, it } from "vitest";

import {
  MetaSessionCapabilitySchema,
  TmuxCapabilitySchema,
  TmuxSessionsObservationSchema,
  TmuxTargetSchema,
} from "./tmux.js";

describe("tmux contracts", () => {
  it("keeps Meta startup capability strict and session-ID based", () => {
    expect(
      MetaSessionCapabilitySchema.safeParse({
        state: "ready",
        sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        detail: "Meta is attached.",
      }).success,
    ).toBe(true);
    expect(
      MetaSessionCapabilitySchema.safeParse({
        state: "unavailable",
        sessionId: null,
        detail: "Meta is unavailable.",
      }).success,
    ).toBe(true);
    expect(
      MetaSessionCapabilitySchema.safeParse({
        state: "ready",
        sessionId: null,
        detail: "Forged ready state.",
      }).success,
    ).toBe(false);
    expect(
      MetaSessionCapabilitySchema.safeParse({
        state: "unavailable",
        sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
        detail: "Forged unavailable state.",
      }).success,
    ).toBe(false);
  });

  it("keeps unconfigured capability explicit", () => {
    expect(
      TmuxCapabilitySchema.safeParse({
        state: "unconfigured",
        serverId: null,
        executable: null,
        version: null,
        detail: "No optional tmux socket is configured.",
      }).success,
    ).toBe(true);
  });

  it("accepts only opaque tmux session identities and safe names", () => {
    const target = {
      serverId: "configured",
      sessionId: "$12",
      sessionName: "Meta",
      observedAt: "2026-07-28T10:00:00.000Z",
    };
    expect(TmuxTargetSchema.safeParse(target).success).toBe(true);
    expect(
      TmuxTargetSchema.safeParse({ ...target, sessionId: "Meta" }).success,
    ).toBe(false);
    expect(
      TmuxTargetSchema.safeParse({
        ...target,
        sessionName: "Meta\nforged",
      }).success,
    ).toBe(false);
  });

  it("requires unique session identities and status-consistent evidence", () => {
    const session = {
      target: {
        serverId: "configured",
        sessionId: "$0",
        sessionName: "Meta",
        observedAt: "2026-07-28T10:00:00.000Z",
      },
      windows: 1,
      attachedClients: 0,
      createdAt: "2026-07-28T09:00:00.000Z",
      currentPath: "/work/pacium",
    };
    expect(
      TmuxSessionsObservationSchema.safeParse({
        status: "ready",
        serverId: "configured",
        observedAt: "2026-07-28T10:00:00.000Z",
        sessions: [session],
        error: null,
      }).success,
    ).toBe(true);
    expect(
      TmuxSessionsObservationSchema.safeParse({
        status: "ready",
        serverId: "configured",
        observedAt: "2026-07-28T10:00:00.000Z",
        sessions: [session, session],
        error: null,
      }).success,
    ).toBe(false);
  });
});
