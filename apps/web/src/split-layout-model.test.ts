import { describe, expect, it } from "vitest";

import {
  assignSessionToPane,
  clearSessionFromLayout,
  closePane,
  createSplitLayout,
  focusPaneByOffset,
  getFocusedPane,
  listPanes,
  parseStoredSplitLayout,
  reconcileSplitLayout,
  serializeSplitLayout,
  setSplitRatio,
  showSessionInFocusedPane,
  splitFocusedPane,
  toggleMaximizedPane,
} from "./split-layout-model.js";

function twoPaneLayout() {
  const first = showSessionInFocusedPane(
    createSplitLayout("pane-one"),
    "session-one",
  );
  const split = splitFocusedPane(first, "horizontal", "split-one", "pane-two");
  return assignSessionToPane(split, "pane-two", "session-two");
}

describe("split layout", () => {
  it("creates a bounded empty adjacent pane and focuses it", () => {
    const initial = showSessionInFocusedPane(
      createSplitLayout("pane-one"),
      "session-one",
    );
    const split = splitFocusedPane(
      initial,
      "horizontal",
      "split-one",
      "pane-two",
    );

    expect(split.focusedPaneId).toBe("pane-two");
    expect(listPanes(split.root)).toEqual([
      { kind: "pane", id: "pane-one", sessionId: "session-one" },
      { kind: "pane", id: "pane-two", sessionId: null },
    ]);

    const four = splitFocusedPane(
      splitFocusedPane(
        splitFocusedPane(split, "vertical", "split-two", "pane-three"),
        "horizontal",
        "split-three",
        "pane-four",
      ),
      "vertical",
      "split-four",
      "pane-five",
    );
    expect(listPanes(four.root)).toHaveLength(4);
  });

  it("focuses an already visible session instead of duplicating it", () => {
    const state = twoPaneLayout();
    const focused = showSessionInFocusedPane(state, "session-one");

    expect(focused.focusedPaneId).toBe("pane-one");
    expect(listPanes(focused.root).map(({ sessionId }) => sessionId)).toEqual([
      "session-one",
      "session-two",
    ]);
  });

  it("moves into an empty pane and swaps occupied pane assignments", () => {
    const state = twoPaneLayout();
    const cleared = clearSessionFromLayout(state, "session-two");
    const moved = assignSessionToPane(cleared, "pane-two", "session-one");
    expect(listPanes(moved.root).map(({ sessionId }) => sessionId)).toEqual([
      null,
      "session-one",
    ]);

    const swapped = assignSessionToPane(state, "pane-one", "session-two");
    expect(listPanes(swapped.root).map(({ sessionId }) => sessionId)).toEqual([
      "session-two",
      "session-one",
    ]);
  });

  it("cycles focus, clamps ratios, and preserves maximize state", () => {
    const state = twoPaneLayout();
    expect(focusPaneByOffset(state, -1).focusedPaneId).toBe("pane-one");
    expect(setSplitRatio(state, "split-one", 0.01).root).toMatchObject({
      ratio: 0.2,
    });
    const maximized = toggleMaximizedPane(state, "pane-two");
    expect(maximized.maximizedPaneId).toBe("pane-two");
    expect(
      toggleMaximizedPane(maximized, "pane-two").maximizedPaneId,
    ).toBeNull();
  });

  it("closes only the view and deterministically recovers focus", () => {
    const state = twoPaneLayout();
    const closed = closePane(state, "pane-two");

    expect(listPanes(closed.root)).toEqual([
      { kind: "pane", id: "pane-one", sessionId: "session-one" },
    ]);
    expect(closed.focusedPaneId).toBe("pane-one");
    expect(closePane(closed, "pane-one")).toMatchObject({
      root: { kind: "pane", id: "pane-one", sessionId: null },
      focusedPaneId: "pane-one",
    });
  });

  it("removes stale and duplicate sessions without changing pane structure", () => {
    const duplicate = assignSessionToPane(
      twoPaneLayout(),
      "pane-two",
      "session-one",
    );
    const reconciled = reconcileSplitLayout(
      duplicate,
      new Set(["session-one"]),
    );

    expect(
      listPanes(reconciled.root).map(({ sessionId }) => sessionId),
    ).toEqual([null, "session-one"]);
    expect(getFocusedPane(reconciled)?.id).toBe("pane-two");
  });

  it("round trips bounded state and rejects malformed or oversized layouts", () => {
    const state = toggleMaximizedPane(twoPaneLayout(), "pane-two");
    expect(parseStoredSplitLayout(serializeSplitLayout(state))).toEqual(state);
    expect(parseStoredSplitLayout("{")).toBeNull();
    expect(
      parseStoredSplitLayout(JSON.stringify({ version: 2, root: state.root })),
    ).toBeNull();

    const duplicateStorage = JSON.stringify({
      version: 1,
      focusedPaneId: "pane-one",
      maximizedPaneId: null,
      root: {
        kind: "split",
        id: "split-one",
        direction: "horizontal",
        ratio: 2,
        first: { kind: "pane", id: "pane-one", sessionId: "session-one" },
        second: { kind: "pane", id: "pane-two", sessionId: "session-one" },
      },
    });
    const parsed = parseStoredSplitLayout(duplicateStorage);
    expect(parsed?.root).toMatchObject({ ratio: 0.8 });
    expect(
      parsed === null
        ? []
        : listPanes(parsed.root).map(({ sessionId }) => sessionId),
    ).toEqual(["session-one", null]);
  });
});
