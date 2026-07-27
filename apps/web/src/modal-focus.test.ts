import { describe, expect, it } from "vitest";

import { resolveModalKeyAction } from "./modal-focus.js";

describe("modal keyboard focus", () => {
  it("closes on Escape regardless of focusable controls", () => {
    expect(
      resolveModalKeyAction({
        activeIndex: -1,
        focusableCount: 0,
        key: "Escape",
        shiftKey: false,
      }),
    ).toBe("close");
  });

  it("wraps Tab at both modal boundaries", () => {
    expect(
      resolveModalKeyAction({
        activeIndex: 2,
        focusableCount: 3,
        key: "Tab",
        shiftKey: false,
      }),
    ).toBe("focus-first");
    expect(
      resolveModalKeyAction({
        activeIndex: 0,
        focusableCount: 3,
        key: "Tab",
        shiftKey: true,
      }),
    ).toBe("focus-last");
  });

  it("recovers focus that is outside the open modal", () => {
    expect(
      resolveModalKeyAction({
        activeIndex: -1,
        focusableCount: 3,
        key: "Tab",
        shiftKey: false,
      }),
    ).toBe("focus-first");
    expect(
      resolveModalKeyAction({
        activeIndex: -1,
        focusableCount: 3,
        key: "Tab",
        shiftKey: true,
      }),
    ).toBe("focus-last");
  });

  it("leaves internal and unrelated key movement alone", () => {
    expect(
      resolveModalKeyAction({
        activeIndex: 1,
        focusableCount: 3,
        key: "Tab",
        shiftKey: false,
      }),
    ).toBeNull();
    expect(
      resolveModalKeyAction({
        activeIndex: 2,
        focusableCount: 3,
        key: "ArrowDown",
        shiftKey: false,
      }),
    ).toBeNull();
  });
});
