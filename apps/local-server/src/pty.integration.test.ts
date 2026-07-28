import { describe, expect, it } from "vitest";

import { loadServerConfig } from "./config.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { SessionManager } from "./session-manager.js";

describe("real PTY integration", () => {
  it("runs a command through the invoking user's shell", async () => {
    const shell = process.platform === "linux" ? "/bin/bash" : "/bin/zsh";
    const config = loadServerConfig({
      ...process.env,
      SHELL: shell,
      PACIUM_DEFAULT_CWD: process.cwd(),
    });
    const manager = new SessionManager(
      new NodePtyFactory(config),
      config.launchPresets,
    );
    let output = "";
    manager.onTerminalData((event) => {
      output += event.data;
    });
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 100,
      rows: 30,
    });

    const exited = new Promise<void>((resolve) => {
      manager.onSessionEvent((event) => {
        if (event.type === "exited" && event.session.id === session.id) {
          resolve();
        }
      });
    });

    manager.input(session.id, "printf '\\nPACIUM_REAL_PTY_OK\\n'; exit\r");
    await exited;

    expect(output).toContain("PACIUM_REAL_PTY_OK");
    expect(manager.list()[0]?.processState).toBe("exited");
    await manager.shutdown();
  }, 10_000);
});
