import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildChildEnvironment, loadServerConfig } from "./config.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import { SessionManager } from "./session-manager.js";
import { createTmuxAdapter } from "./tmux-adapter.js";

const execFileAsync = promisify(execFile);
const supportedShell = process.platform === "linux" ? "/bin/bash" : "/bin/zsh";
const tmuxExecutable = [
  "/opt/homebrew/bin/tmux",
  "/usr/local/bin/tmux",
  "/usr/bin/tmux",
].find(existsSync);
const fixtures: Array<{ root: string; socket: string }> = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map(async ({ root, socket }) => {
      await execFileAsync(tmuxExecutable ?? "tmux", [
        "-S",
        socket,
        "kill-server",
      ]).catch(() => undefined);
      await rm(root, { force: true, recursive: true });
    }),
  );
});

describe("real tmux keep-alive lifecycle", () => {
  it.runIf(tmuxExecutable !== undefined)(
    "keeps one managed target through client and manager restart",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "pacium-keepalive-real-"));
      const socket = join(root, "server.sock");
      fixtures.push({ root, socket });
      await execFileAsync(tmuxExecutable!, [
        "-S",
        socket,
        "new-session",
        "-d",
        "-s",
        "external-fixture",
        "-c",
        process.cwd(),
      ]);
      const config = loadServerConfig({
        ...process.env,
        PACIUM_DATA_DIR: join(root, "state"),
        PACIUM_DEFAULT_CWD: process.cwd(),
        PACIUM_TMUX_SOCKET: socket,
        SHELL: supportedShell,
      });
      const store = new RelaunchManifestStore(config.dataDirectory);
      await store.initialize();
      const adapter = await createTmuxAdapter(
        config.tmuxSocket,
        buildChildEnvironment(config.environmentKeys),
      );
      const first = createManager(config, store, adapter);
      let terminalOutput = "";
      first.onTerminalData((event) => {
        terminalOutput += event.data;
      });

      const launched = await first.create({
        cwd: process.cwd(),
        launchPreset: "shell",
        displayName: "Real keep-alive",
        keepAlive: true,
        cols: 100,
        rows: 30,
      });
      first.input(launched.id, "printf 'PC-071 real tmux\\n'\r");
      await vi.waitFor(
        () => expect(terminalOutput).toContain("PC-071 real tmux"),
        { timeout: 5_000 },
      );
      expect(first.list()[0]).toMatchObject({
        id: launched.id,
        processState: "live",
        tmuxMode: "keep_alive",
      });

      await first.shutdown();
      await first.flushRelaunchManifests();
      const afterShutdown = await adapter.discover();
      expect(afterShutdown.status).toBe("ready");
      expect(
        afterShutdown.sessions.some(
          ({ target }) =>
            target.sessionName === launched.tmuxTarget?.sessionName,
        ),
      ).toBe(true);

      const second = createManager(config, store, adapter);
      const restored = await second.restoreKeepAliveSessions();
      expect(restored).toEqual({
        attempted: 1,
        restored: 1,
        unavailable: 0,
        deferred: 0,
      });
      await vi.waitFor(() =>
        expect(second.list()[0]).toMatchObject({
          processState: "live",
          tmuxMode: "keep_alive",
          relaunchManifest: {
            predecessorSessionId: launched.id,
          },
        }),
      );
      expect(second.list()[0]?.id).not.toBe(launched.id);
      second.close(second.list()[0]!.id, true, crypto.randomUUID());
      await vi.waitFor(() => expect(second.list()).toEqual([]));
      const afterClose = await adapter.discover();
      expect(afterClose.status).toBe("ready");
      expect(
        afterClose.sessions.some(
          ({ target }) =>
            target.sessionName === launched.tmuxTarget?.sessionName,
        ),
      ).toBe(true);
      await second.shutdown();
      await expect(adapter.discover()).resolves.toMatchObject({
        status: "ready",
      });
    },
    15_000,
  );
});

function createManager(
  config: ReturnType<typeof loadServerConfig>,
  store: RelaunchManifestStore,
  adapter: Awaited<ReturnType<typeof createTmuxAdapter>>,
): SessionManager {
  return new SessionManager(
    new NodePtyFactory(config),
    config.launchPresets,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    config.verificationCatalog,
    undefined,
    undefined,
    undefined,
    store,
    config.environmentKeys,
    adapter,
  );
}
