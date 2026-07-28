import { describe, expect, it } from "vitest";

import {
  EMPTY_ATTENTION_INBOX,
  cursorEntry,
  markAttentionNotified,
  shouldDeliverAttentionNotification,
} from "./attention-inbox-model.js";
import type { AttentionResult } from "./attention-model.js";
import {
  MAX_SPLIT_PANES,
  assignSessionToPane,
  closePane,
  createSplitLayout,
  focusPaneByOffset,
  listPanes,
  setSplitRatio,
  splitFocusedPane,
} from "./split-layout-model.js";

describe("browser-owned lifecycle soak invariants", () => {
  it("keeps two thousand split operations within identity and pane bounds", () => {
    let state = createSplitLayout("pane-0");

    for (let index = 1; index <= 2_000; index += 1) {
      const panes = listPanes(state.root);
      if (index % 5 < 3 && panes.length < MAX_SPLIT_PANES) {
        state = splitFocusedPane(
          state,
          index % 2 === 0 ? "horizontal" : "vertical",
          `split-${index}`,
          `pane-${index}`,
        );
      } else if (panes.length > 1) {
        state = closePane(state, panes.at(-1)!.id);
      }

      state = assignSessionToPane(
        state,
        state.focusedPaneId,
        `session-${index % 7}`,
      );
      state = focusPaneByOffset(state, index % 2 === 0 ? 1 : -1);
      state = setSplitRatio(state, `split-${index - 1}`, (index % 10) / 10);

      const current = listPanes(state.root);
      const paneIds = current.map(({ id }) => id);
      const sessionIds = current.flatMap(({ sessionId }) =>
        sessionId === null ? [] : [sessionId],
      );
      expect(current.length).toBeLessThanOrEqual(MAX_SPLIT_PANES);
      expect(new Set(paneIds).size).toBe(paneIds.length);
      expect(new Set(sessionIds).size).toBe(sessionIds.length);
      expect(paneIds).toContain(state.focusedPaneId);
    }
  });

  it("bounds five thousand notification cursors and never redelivers an event", () => {
    let inbox = EMPTY_ATTENTION_INBOX;
    let rejectedInitialDelivery = false;
    let redeliveredEvent = false;
    let maximumEntries = 0;

    for (let index = 0; index < 5_000; index += 1) {
      const sessionId = `session-${index}`;
      const observedAt = new Date(
        Date.UTC(2026, 6, 28, 0, 0, 0, index),
      ).toISOString();
      const attention: AttentionResult = {
        state: index % 2 === 0 ? "needs_input" : "failed",
        source: "process",
        confidence: "high",
        observedAt,
        staleAfter: "2026-07-29T00:00:00.000Z",
        reason: "Bounded synthetic attention evidence.",
      };
      const before = cursorEntry(inbox, sessionId);
      const delivery = {
        attention,
        entry: before,
        permission: "granted" as const,
        preference: "attention" as const,
        visibility: "hidden" as const,
      };
      rejectedInitialDelivery ||= !shouldDeliverAttentionNotification(delivery);
      inbox = markAttentionNotified(inbox, sessionId, attention);
      redeliveredEvent ||= shouldDeliverAttentionNotification({
        ...delivery,
        entry: cursorEntry(inbox, sessionId),
      });
      maximumEntries = Math.max(maximumEntries, inbox.entries.length);
    }

    expect(rejectedInitialDelivery).toBe(false);
    expect(redeliveredEvent).toBe(false);
    expect(maximumEntries).toBeLessThanOrEqual(200);
    expect(inbox.entries).toHaveLength(200);
    expect(JSON.stringify(inbox).length).toBeLessThan(64 * 1024);
  });
});
