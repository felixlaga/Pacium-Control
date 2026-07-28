import { describe, expect, it } from "vitest";

import {
  EMPTY_ATTENTION_INBOX,
  acknowledgeAttention,
  attentionEventKey,
  buildAttentionNotificationContent,
  cursorEntry,
  isAttentionUnread,
  loadAttentionInbox,
  markAttentionNotified,
  parseAttentionInbox,
  saveAttentionInbox,
  setSessionMuted,
  shouldDeliverAttentionNotification,
} from "./attention-inbox-model.js";
import type { AttentionResult } from "./attention-model.js";

const failed: AttentionResult = {
  state: "failed",
  source: "process",
  confidence: "high",
  observedAt: "2026-07-27T10:00:00.000Z",
  staleAfter: "2026-07-28T10:00:00.000Z",
  reason: "Process exited with code 2.",
};

describe("attention inbox state", () => {
  it("creates keys only for important evidence and acknowledges selection", () => {
    expect(attentionEventKey(failed)).toContain("failed:process:high");
    expect(attentionEventKey({ ...failed, state: "working" })).toBeNull();
    expect(isAttentionUnread(EMPTY_ATTENTION_INBOX, "session-1", failed)).toBe(
      true,
    );
    const seen = acknowledgeAttention(
      EMPTY_ATTENTION_INBOX,
      "session-1",
      failed,
    );
    expect(isAttentionUnread(seen, "session-1", failed)).toBe(false);
  });

  it("tracks mute separately from seen and notified cursors", () => {
    const muted = setSessionMuted(EMPTY_ATTENTION_INBOX, "session-1", true);
    const notified = markAttentionNotified(muted, "session-1", failed);
    expect(cursorEntry(notified, "session-1")).toMatchObject({
      muted: true,
      seenKey: null,
      notifiedKey: attentionEventKey(failed),
    });
  });

  it("delivers only one hidden-page important notification", () => {
    const entry = cursorEntry(EMPTY_ATTENTION_INBOX, "session-1");
    const base = {
      attention: failed,
      entry,
      permission: "granted" as const,
      preference: "attention" as const,
      visibility: "hidden" as const,
    };
    expect(shouldDeliverAttentionNotification(base)).toBe(true);
    expect(
      shouldDeliverAttentionNotification({ ...base, visibility: "visible" }),
    ).toBe(false);
    expect(
      shouldDeliverAttentionNotification({ ...base, preference: "off" }),
    ).toBe(false);
    expect(
      shouldDeliverAttentionNotification({
        ...base,
        entry: { ...entry, muted: true },
      }),
    ).toBe(false);
    expect(
      shouldDeliverAttentionNotification({
        ...base,
        entry: { ...entry, notifiedKey: attentionEventKey(failed) },
      }),
    ).toBe(false);
  });

  it("retains the latest updated cursor when the inbox is full", () => {
    let state = EMPTY_ATTENTION_INBOX;
    for (let index = 0; index <= 200; index += 1) {
      state = markAttentionNotified(
        state,
        `session-${String(index).padStart(3, "0")}`,
        {
          ...failed,
          observedAt: new Date(
            Date.UTC(2026, 6, 27, 10, 0, 0, index),
          ).toISOString(),
        },
      );
    }
    expect(state.entries).toHaveLength(200);
    expect(
      cursorEntry(state, "session-200").notifiedKey,
    ).toContain("failed:process:high");
  });

  it("builds minimal notification copy without terminal details", () => {
    const content = buildAttentionNotificationContent("session-1", failed);
    expect(content).toMatchObject({
      title: "Pacium Control",
      body: "A terminal session failed.",
    });
    expect(JSON.stringify(content)).not.toContain(failed.reason);
    expect(
      buildAttentionNotificationContent("session-1", {
        ...failed,
        state: "working",
      }),
    ).toBeNull();
  });

  it("rejects malformed, extra, duplicate, and oversized records", () => {
    expect(parseAttentionInbox("not-json")).toBe(EMPTY_ATTENTION_INBOX);
    expect(
      parseAttentionInbox(
        JSON.stringify({ version: 2, entries: [], extra: true }),
      ),
    ).toBe(EMPTY_ATTENTION_INBOX);
    const duplicate = {
      version: 1,
      entries: [
        {
          sessionId: "session-1",
          seenKey: null,
          notifiedKey: null,
          muted: false,
        },
        {
          sessionId: "session-1",
          seenKey: null,
          notifiedKey: null,
          muted: false,
        },
      ],
    };
    expect(parseAttentionInbox(JSON.stringify(duplicate))).toBe(
      EMPTY_ATTENTION_INBOX,
    );
    expect(parseAttentionInbox("x".repeat(70_000))).toBe(EMPTY_ATTENTION_INBOX);
  });

  it("fails storage reads and writes safely", () => {
    expect(
      loadAttentionInbox({
        getItem() {
          throw new Error("blocked");
        },
      }),
    ).toBe(EMPTY_ATTENTION_INBOX);
    expect(
      saveAttentionInbox(
        {
          setItem() {
            throw new Error("blocked");
          },
        },
        EMPTY_ATTENTION_INBOX,
      ),
    ).toBe(false);
  });
});
