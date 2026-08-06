import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_HARNESS_TARGET,
  buildHarnessLoginCommand,
  isValidHarnessTarget,
  loadHarnessTarget,
  saveHarnessTarget,
} from "./harness-model.js";

describe("isValidHarnessTarget", () => {
  it("accepts user@host forms case-insensitively", () => {
    expect(isValidHarnessTarget("root@harness")).toBe(true);
    expect(isValidHarnessTarget("Op.User@Host-1.local")).toBe(true);
    expect(isValidHarnessTarget("a_b-c.d@10.0.0.2")).toBe(true);
  });

  it("rejects malformed targets", () => {
    expect(isValidHarnessTarget("")).toBe(false);
    expect(isValidHarnessTarget("root")).toBe(false);
    expect(isValidHarnessTarget("@host")).toBe(false);
    expect(isValidHarnessTarget("root@")).toBe(false);
    expect(isValidHarnessTarget("root @host")).toBe(false);
    expect(isValidHarnessTarget("a@b@c")).toBe(false);
    expect(isValidHarnessTarget("root@host;rm -rf /")).toBe(false);
    expect(isValidHarnessTarget("root@host'`$(id)`'")).toBe(false);
  });

  it("bounds the target length at 128 characters", () => {
    const longUser = "a".repeat(122);
    expect(isValidHarnessTarget(`${longUser}@host`)).toBe(true);
    expect(isValidHarnessTarget(`${longUser}xx@host`)).toBe(false);
  });
});

describe("harness target storage", () => {
  it("round-trips a valid target through the pacium.harnessTarget key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    saveHarnessTarget(storage, "root@harness");
    expect(store.get("pacium.harnessTarget")).toBe("root@harness");
    expect(loadHarnessTarget(storage)).toBe("root@harness");
  });

  it("falls back to the deploy-script default for absent or invalid values", () => {
    expect(loadHarnessTarget({ getItem: () => null })).toBe(
      DEFAULT_HARNESS_TARGET,
    );
    expect(loadHarnessTarget({ getItem: () => "not a target" })).toBe(
      DEFAULT_HARNESS_TARGET,
    );
    expect(
      loadHarnessTarget({
        getItem: () => {
          throw new Error("storage blocked");
        },
      }),
    ).toBe(DEFAULT_HARNESS_TARGET);
    expect(isValidHarnessTarget(DEFAULT_HARNESS_TARGET)).toBe(true);
  });

  it("never persists an invalid target", () => {
    const setItem = vi.fn();
    saveHarnessTarget({ setItem }, "root@host;rm -rf /");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("swallows storage write failures", () => {
    expect(() =>
      saveHarnessTarget(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        "root@harness",
      ),
    ).not.toThrow();
  });
});

describe("buildHarnessLoginCommand", () => {
  it("produces the exact single-quoted login command", () => {
    expect(buildHarnessLoginCommand("root@harness")).toBe(
      "ssh -t root@harness 'tailscale status >/dev/null 2>&1 || sudo tailscale login; exec $SHELL -l'",
    );
  });

  it("throws on invalid targets instead of building a command", () => {
    expect(() => buildHarnessLoginCommand("root@host;evil")).toThrow(
      /user@host/,
    );
    expect(() => buildHarnessLoginCommand("")).toThrow(/user@host/);
  });
});
