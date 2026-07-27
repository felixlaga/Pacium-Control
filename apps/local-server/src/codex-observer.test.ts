import { describe, expect, it } from "vitest";

import {
  CodexObserver,
  CODEX_OBSERVER_TOKEN_ENV,
  detectCodexRuntime,
  parseCodexVersion,
} from "./codex-observer.js";

const sessionId = "53cfec56-181c-4e9c-b187-8f323780c175";
const token = "t".repeat(43);
const threadId = "019c0000-0000-7000-8000-000000000001";
const turnId = "019c0000-0000-7000-8000-000000000002";
const now = "2026-07-28T10:00:00.000Z";

function observer(
  available = true,
  tokenFactory: () => string = () => token,
): CodexObserver {
  return new CodexObserver({
    baseUrl: "http://127.0.0.1:4174",
    executable: "/opt/test/bin/codex",
    environment: { PATH: "/opt/test/bin" },
    capability: available
      ? { available: true, version: "0.145.0" }
      : {
          available: false,
          version: "0.100.0",
          reason: "remote_unavailable",
        },
    now: () => now,
    tokenFactory,
  });
}

describe("Codex runtime capability detection", () => {
  it("requires exact version, remote, token, and App Server options", () => {
    const calls: string[][] = [];
    const result = detectCodexRuntime(
      "/opt/test/bin/codex",
      { PATH: "/opt/test/bin" },
      (_executable, args) => {
        calls.push([...args]);
        if (args[0] === "--version") {
          return "codex-cli 0.145.0\n";
        }
        if (args[0] === "--help") {
          return "  --remote <ADDR>\n  --remote-auth-token-env <NAME>\n";
        }
        return "  --listen <URL>\n";
      },
    );

    expect(result).toEqual({ available: true, version: "0.145.0" });
    expect(calls).toEqual([
      ["--version"],
      ["--help"],
      ["app-server", "--help"],
    ]);
  });

  it("degrades each missing capability without assuming a version range", () => {
    expect(detectCodexRuntime("/codex", {}, () => "unbounded banner")).toEqual({
      available: false,
      version: null,
      reason: "version_unavailable",
    });
    expect(
      detectCodexRuntime("/codex", {}, (_executable, args) =>
        args[0] === "--version"
          ? "codex-cli 0.145.0"
          : args[0] === "--help"
            ? "--remote <ADDR>"
            : "--listen <URL>",
      ),
    ).toEqual({
      available: false,
      version: "0.145.0",
      reason: "remote_unavailable",
    });
    expect(
      detectCodexRuntime("/codex", {}, (_executable, args) =>
        args[0] === "--version"
          ? "codex-cli 0.145.0"
          : args[0] === "--help"
            ? "--remote <ADDR> --remote-auth-token-env <NAME>"
            : "missing",
      ),
    ).toEqual({
      available: false,
      version: "0.145.0",
      reason: "app_server_unavailable",
    });
  });

  it("parses only exact stable version output", () => {
    expect(parseCodexVersion("codex-cli 0.145.0\n")).toBe("0.145.0");
    expect(parseCodexVersion("Codex 0.145.0")).toBeNull();
    expect(parseCodexVersion("codex-cli 0.145.0-beta")).toBeNull();
  });
});

describe("Codex observer preparation and authorization", () => {
  it("prepares one token-bound local remote without placing the token in argv", () => {
    const instance = observer();
    const prepared = instance.prepare(sessionId, now);

    expect(prepared).toMatchObject({
      enabled: true,
      args: [
        "--remote",
        `ws://127.0.0.1:4174/api/provider/codex/${sessionId}/runtime`,
        "--remote-auth-token-env",
        CODEX_OBSERVER_TOKEN_ENV,
      ],
      environment: { [CODEX_OBSERVER_TOKEN_ENV]: token },
      observation: {
        provider: "codex",
        providerVersion: "0.145.0",
        health: { state: "unavailable", source: "none" },
      },
    });
    expect(JSON.stringify(prepared.args)).not.toContain(token);
    expect(instance.claimBridge(sessionId, "wrong")).toBeNull();
    expect(instance.claimBridge(sessionId, token)).toEqual({
      executable: "/opt/test/bin/codex",
      environment: { PATH: "/opt/test/bin" },
    });
    expect(instance.claimBridge(sessionId, token)).toBeNull();
    instance.releaseBridge(sessionId);
    expect(instance.claimBridge(sessionId, token)).not.toBeNull();
  });

  it("leaves unsupported Codex launches unchanged and rejects unsafe setup", () => {
    const unsupported = observer(false).prepare(sessionId, now);
    expect(unsupported).toMatchObject({
      enabled: false,
      args: [],
      environment: {},
      observation: {
        health: { state: "unavailable" },
        providerVersion: "0.100.0",
      },
    });
    expect(unsupported.observation.health.detail).toContain("remote TUI");
    expect(
      () =>
        new CodexObserver({
          baseUrl: "http://0.0.0.0:4174",
          executable: "/codex",
          environment: {},
          capability: { available: true, version: "0.145.0" },
        }),
    ).toThrow("loopback");
    expect(() =>
      observer(true, () => "x".repeat(31) + "/").prepare(sessionId, now),
    ).toThrow("unsafe token");
  });
});

describe("Codex observer state reduction", () => {
  it("deduplicates native lifecycle while preserving distinct tools and usage", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    const updates: string[] = [];
    instance.onUpdate((_id, observation) => {
      updates.push(observation.activities[0]?.kind ?? "attention");
    });

    expect(
      instance.ingestServerMessage(sessionId, {
        method: "thread/started",
        params: { thread: { id: threadId, cliVersion: "0.145.0" } },
      }).status,
    ).toBe("accepted");
    expect(
      instance.ingestServerMessage(sessionId, {
        method: "turn/started",
        params: {
          threadId,
          turn: { id: turnId, status: "inProgress" },
        },
      }).status,
    ).toBe("accepted");
    for (const itemId of ["item-1", "item-2"]) {
      expect(
        instance.ingestServerMessage(sessionId, {
          method: "item/started",
          params: {
            threadId,
            turnId,
            item: {
              id: itemId,
              type: "commandExecution",
              status: "inProgress",
              command: "private command",
            },
          },
        }).status,
      ).toBe("accepted");
    }
    const usage = (totalTokens: number) => ({
      method: "thread/tokenUsage/updated",
      params: {
        threadId,
        turnId,
        tokenUsage: {
          total: {
            inputTokens: totalTokens - 10,
            cachedInputTokens: 5,
            outputTokens: 10,
            reasoningOutputTokens: 2,
            totalTokens,
          },
        },
      },
    });
    expect(instance.ingestServerMessage(sessionId, usage(100)).status).toBe(
      "accepted",
    );
    const latest = instance.ingestServerMessage(sessionId, usage(120));
    expect(latest.status).toBe("accepted");
    expect(instance.ingestServerMessage(sessionId, usage(120)).status).toBe(
      "duplicate",
    );
    if (latest.status !== "accepted") {
      throw new Error("Expected latest usage observation.");
    }
    expect(latest.observation).toMatchObject({
      health: { state: "ready", source: "native", confidence: "confirmed" },
      attention: { state: "working", source: "native" },
    });
    expect(latest.observation.activities[0]).toMatchObject({
      kind: "usage_updated",
      extension: { totalTokens: 120 },
    });
    expect(latest.observation.activities[1]).toMatchObject({
      kind: "usage_updated",
      extension: { totalTokens: 100 },
    });
    expect(
      new Set(latest.observation.activities.map(({ id }) => id)).size,
    ).toBe(latest.observation.activities.length);
    expect(JSON.stringify(latest.observation)).not.toContain("private command");
    expect(updates).toHaveLength(6);
  });

  it("marks malformed known events and transport failure as bounded degradation", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    expect(
      instance.ingestServerMessage(sessionId, {
        method: "turn/started",
        params: { threadId, turn: { id: "", status: "inProgress" } },
      }),
    ).toEqual({ status: "rejected", code: "invalid_event" });
    const recovered = instance.ingestServerMessage(sessionId, {
      method: "turn/started",
      params: {
        threadId,
        turn: { id: turnId, status: "inProgress" },
      },
    });
    expect(recovered).toMatchObject({
      status: "accepted",
      observation: {
        health: { state: "ready" },
        diagnostics: [],
      },
    });
    instance.markTransportFailure(sessionId, "codex.child_exit");
    const duplicate = instance.ingestServerMessage(sessionId, {
      method: "turn/started",
      params: {
        threadId,
        turn: { id: turnId, status: "inProgress" },
      },
    });
    expect(duplicate).toMatchObject({
      status: "duplicate",
      observation: {
        health: { state: "degraded" },
        diagnostics: [{ code: "codex.child_exit" }],
      },
    });
  });

  it("releases session authority", () => {
    const instance = observer();
    instance.prepare(sessionId, now);
    instance.release(sessionId);
    expect(instance.hasSession(sessionId)).toBe(false);
    expect(instance.claimBridge(sessionId, token)).toBeNull();
    expect(instance.ingestServerMessage(sessionId, {})).toEqual({
      status: "rejected",
      code: "unknown_session",
    });
  });
});
