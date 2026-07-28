import { describe, expect, it } from "vitest";

import {
  PROVIDER_FRESHNESS_INTERVAL_MS,
  startProviderFreshnessClock,
  type ProviderFreshnessClockHost,
} from "./provider-freshness-clock.js";

describe("provider freshness clock", () => {
  it("ticks at one bounded interval and immediately on visible restoration", () => {
    let intervalHandler = () => {};
    let visibilityHandler = () => {};
    let intervalMs = 0;
    let cleared: number | null = null;
    let removed = false;
    const host: ProviderFreshnessClockHost = {
      visibilityState: "hidden",
      setInterval(handler, timeout) {
        intervalHandler = handler;
        intervalMs = timeout;
        return 17;
      },
      clearInterval(handle) {
        cleared = handle;
      },
      addEventListener(_type, listener) {
        visibilityHandler = listener;
      },
      removeEventListener(_type, listener) {
        removed = listener === visibilityHandler;
      },
    };
    const ticks: string[] = [];
    let current = "2026-07-28T10:00:30.000Z";
    const stop = startProviderFreshnessClock(
      host,
      (value) => ticks.push(value),
      () => current,
    );

    expect(intervalMs).toBe(PROVIDER_FRESHNESS_INTERVAL_MS);
    expect(ticks).toEqual([]);
    intervalHandler();
    expect(ticks).toEqual(["2026-07-28T10:00:30.000Z"]);

    current = "2026-07-28T10:01:00.000Z";
    visibilityHandler();
    expect(ticks).toHaveLength(1);
    host.visibilityState = "visible";
    visibilityHandler();
    expect(ticks).toEqual([
      "2026-07-28T10:00:30.000Z",
      "2026-07-28T10:01:00.000Z",
    ]);

    stop();
    expect(cleared).toBe(17);
    expect(removed).toBe(true);
  });
});
