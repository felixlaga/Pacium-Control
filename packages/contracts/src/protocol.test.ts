import { describe, expect, it } from "vitest";

import {
  AgentClassificationSchema,
  ClientMessageSchema,
  decodeTerminalDataFrame,
  encodeTerminalDataFrame,
  MAX_TERMINAL_INPUT_CHARS,
} from "./protocol.js";

describe("terminal binary frames", () => {
  it("round-trips UTF-8 terminal output", () => {
    const sessionId = "5fe26a52-3f3c-41ef-8dba-6f93062eeec5";
    const frame = encodeTerminalDataFrame(sessionId, 1, 42, "ready λ 🚀");

    expect(decodeTerminalDataFrame(frame)).toEqual({
      sessionId,
      epoch: 1,
      sequence: 42,
      data: "ready λ 🚀",
    });
  });

  it("rejects an invalid session identifier", () => {
    expect(() =>
      encodeTerminalDataFrame("not-a-session", 1, 1, "data"),
    ).toThrow("session ID");
  });
});

describe("client protocol", () => {
  it("accepts only server-owned launch preset identifiers", () => {
    const baseMessage = {
      type: "session.create",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      payload: {
        cwd: "/tmp",
        cols: 80,
        rows: 24,
      },
    };

    expect(
      ClientMessageSchema.safeParse({
        ...baseMessage,
        payload: { ...baseMessage.payload, launchPreset: "codex" },
      }).success,
    ).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...baseMessage,
        payload: {
          ...baseMessage.payload,
          launchPreset: "/bin/zsh -lc dangerous",
          command: "/bin/zsh",
          args: ["-lc", "dangerous"],
        },
      }).success,
    ).toBe(false);

    const fixedPreset = ClientMessageSchema.safeParse({
      ...baseMessage,
      payload: {
        ...baseMessage.payload,
        launchPreset: "shell",
        command: "/bin/zsh",
        args: ["-lc", "dangerous"],
      },
    });
    expect(fixedPreset.success).toBe(false);
  });

  it("accepts a bounded terminal input command", () => {
    const result = ClientMessageSchema.safeParse({
      type: "terminal.input",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      data: "pwd\r",
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized terminal input", () => {
    const result = ClientMessageSchema.safeParse({
      type: "terminal.input",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
      data: "x".repeat(MAX_TERMINAL_INPUT_CHARS + 1),
    });

    expect(result.success).toBe(false);
  });

  it("accepts bounded rename metadata and rejects blank names", () => {
    const message = {
      type: "session.rename",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    const renamed = ClientMessageSchema.safeParse({
      ...message,
      displayName: "  Meta  ",
    });
    expect(renamed.success).toBe(true);
    if (renamed.success && renamed.data.type === "session.rename") {
      expect(renamed.data.displayName).toBe("Meta");
    }
    expect(
      ClientMessageSchema.safeParse({ ...message, displayName: "   " }).success,
    ).toBe(false);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        displayName: "x".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("never accepts a browser-supplied reveal path", () => {
    const message = {
      type: "session.revealRepository",
      requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
      sessionId: "5fe26a52-3f3c-41ef-8dba-6f93062eeec5",
    };
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
    expect(
      ClientMessageSchema.safeParse({
        ...message,
        path: "/tmp/browser-controlled",
      }).success,
    ).toBe(false);
  });

  it("never accepts browser-supplied classification on create", () => {
    expect(
      ClientMessageSchema.safeParse({
        type: "session.create",
        requestId: "66bd01dc-a1c3-4341-9c3c-153027b7f098",
        payload: {
          cwd: "/tmp",
          cols: 80,
          rows: 24,
          launchPreset: "codex",
          agentClassification: {
            type: "claude",
            label: "Fake",
            source: "human_labelled",
            confidence: "confirmed",
            observedAt: "2026-07-27T10:00:00.000Z",
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("agent classification contract", () => {
  const classification = {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
    observedAt: "2026-07-27T10:00:00.000Z",
  };

  it("accepts bounded launch evidence and rejects unknown fields", () => {
    expect(AgentClassificationSchema.safeParse(classification).success).toBe(
      true,
    );
    expect(
      AgentClassificationSchema.safeParse({
        ...classification,
        terminalOutput: "Working...",
      }).success,
    ).toBe(false);
    expect(
      AgentClassificationSchema.safeParse({
        ...classification,
        confidence: "certain",
      }).success,
    ).toBe(false);
  });
});
