import { describe, expect, it, vi } from "vitest";
import { FakePtyFactory } from "@pacium/test-utils";

import type { LaunchPresetDefinition } from "./launch-presets.js";
import { SessionError, SessionManager } from "./session-manager.js";

const testPresets: readonly LaunchPresetDefinition[] = [
  {
    id: "shell",
    label: "Shell",
    available: true,
    unavailableReason: null,
    executable: "/bin/zsh",
    args: ["-l"],
    classification: {
      type: "shell",
      label: "Shell",
      source: "launch_preset",
      confidence: "confirmed",
    },
  },
  {
    id: "codex",
    label: "Codex",
    available: true,
    unavailableReason: null,
    executable: "/opt/test/bin/codex",
    args: [],
    classification: {
      type: "codex",
      label: "Codex CLI",
      source: "launch_preset",
      confidence: "confirmed",
    },
  },
  {
    id: "claude",
    label: "Claude Code",
    available: false,
    unavailableReason: "Claude Code is not installed or not on PATH.",
    executable: null,
    args: [],
    classification: {
      type: "claude",
      label: "Claude Code CLI",
      source: "launch_preset",
      confidence: "confirmed",
    },
  },
];

describe("SessionManager", () => {
  it("creates a terminal, routes input and resize, and restores output", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 90,
      rows: 28,
    });
    const fakePty = factory.processes[0];
    expect(fakePty).toBeDefined();

    fakePty?.emitData("hello from the PTY\r\n");
    manager.input(session.id, "pwd\r");
    manager.resize(session.id, 110, 34);
    manager.interrupt(session.id);

    const snapshot = await manager.snapshot(session.id);
    expect(snapshot.data).toContain("hello from the PTY");
    expect(snapshot.sequence).toBe(1);
    expect(snapshot.cols).toBe(110);
    expect(snapshot.rows).toBe(34);
    expect(fakePty?.writes).toEqual(["pwd\r"]);
    expect(fakePty?.resizes).toEqual([{ cols: 110, rows: 34 }]);
    expect(fakePty?.signals).toEqual(["SIGINT"]);
    expect(factory.createCalls[0]).toMatchObject({
      executable: "/bin/zsh",
      args: ["-l"],
    });
    expect(session).toMatchObject({
      launchPreset: "shell",
      commandLabel: "Shell",
    });

    manager.shutdown();
  });

  it("does not destroy a PTY when no browser listener is attached", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    factory.processes[0]?.emitData("before refresh\r\n");
    expect(manager.list()).toHaveLength(1);
    expect((await manager.snapshot(session.id)).data).toContain(
      "before refresh",
    );

    manager.shutdown();
  });

  it("requires explicit force to close a live shell", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    expect(() => manager.close(session.id, false, crypto.randomUUID())).toThrow(
      SessionError,
    );
    manager.close(session.id, true, crypto.randomUUID());
    expect(factory.processes[0]?.signals).toEqual(["SIGTERM"]);
    factory.processes[0]?.emitExit(143, 15);
    expect(manager.list()).toHaveLength(0);
  });

  it("renames session metadata and emits an updated summary", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const events: string[] = [];
    manager.onSessionEvent((event) => {
      if (event.type === "updated") {
        events.push(event.session.displayName);
      }
    });

    manager.rename(session.id, "  Meta  ");
    expect(manager.list()[0]?.displayName).toBe("Meta");
    expect(events).toEqual(["Meta"]);
    expect(() => manager.rename(session.id, "   ")).toThrow(
      "between 1 and 120",
    );
    manager.shutdown();
  });

  it("reveals only the session's canonical repository root", async () => {
    const factory = new FakePtyFactory();
    const revealPath = vi.fn().mockResolvedValue(undefined);
    const manager = new SessionManager(factory, testPresets, { revealPath });
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    await manager.revealRepository(session.id);
    expect(revealPath).toHaveBeenCalledWith(session.repositoryRoot);
    manager.shutdown();
  });

  it("rejects a missing working directory without creating a PTY", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);

    await expect(
      manager.create({
        cwd: "/definitely/not/a/pacium/directory",
        launchPreset: "shell",
        cols: 80,
        rows: 24,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CWD" });
    expect(factory.processes).toHaveLength(0);
  });

  it("uses a fixed agent preset and rejects an unavailable one", async () => {
    const factory = new FakePtyFactory();
    const manager = new SessionManager(factory, testPresets);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "codex",
      cols: 80,
      rows: 24,
    });

    expect(session).toMatchObject({
      launchPreset: "codex",
      commandLabel: "Codex",
      shell: "/opt/test/bin/codex",
    });
    expect(factory.createCalls[0]).toMatchObject({
      executable: "/opt/test/bin/codex",
      args: [],
    });
    await expect(
      manager.create({
        cwd: process.cwd(),
        launchPreset: "claude",
        cols: 80,
        rows: 24,
      }),
    ).rejects.toMatchObject({ code: "PRESET_UNAVAILABLE" });
    expect(factory.processes).toHaveLength(1);
    manager.shutdown();
  });
});
