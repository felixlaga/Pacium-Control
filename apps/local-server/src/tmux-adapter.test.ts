import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { createTmuxAdapter, parseTmuxSessions } from "./tmux-adapter.js";

const execFileAsync = promisify(execFile);
const sockets: string[] = [];
const tmuxExecutable = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux"].find(
  existsSync,
);

afterEach(async () => {
  await Promise.all(
    sockets
      .splice(0)
      .map((socket) =>
        execFileAsync(tmuxExecutable ?? "tmux", [
          "-S",
          socket,
          "kill-server",
        ]).catch(() => undefined),
      ),
  );
});

describe("tmux adapter", () => {
  it("reports the optional capability honestly when it is not configured", async () => {
    const adapter = await createTmuxAdapter(null, {});
    expect(adapter.capability()).toMatchObject({
      state: "unconfigured",
      serverId: null,
    });
    await expect(adapter.discover()).resolves.toMatchObject({
      status: "unconfigured",
      sessions: [],
      error: { code: "not_configured" },
    });
  });

  it("parses bounded machine-format evidence", () => {
    expect(
      parseTmuxSessions(
        "$0__PACIUM_TMUX_FIELD__Meta__PACIUM_TMUX_FIELD__2__PACIUM_TMUX_FIELD__1__PACIUM_TMUX_FIELD__1785229200__PACIUM_TMUX_FIELD__/work/pacium\n",
        "2026-07-28T10:00:00.000Z",
      ),
    ).toEqual([
      {
        target: {
          serverId: "configured",
          sessionId: "$0",
          sessionName: "Meta",
          observedAt: "2026-07-28T10:00:00.000Z",
        },
        windows: 2,
        attachedClients: 1,
        createdAt: "2026-07-28T09:00:00.000Z",
        currentPath: "/work/pacium",
      },
    ]);
  });

  it("rejects malformed, duplicate, and control-bearing output", () => {
    expect(() =>
      parseTmuxSessions(
        "$0__PACIUM_TMUX_FIELD__Meta\nforged__PACIUM_TMUX_FIELD__1__PACIUM_TMUX_FIELD__0__PACIUM_TMUX_FIELD__1785229200__PACIUM_TMUX_FIELD__/work\n",
        "2026-07-28T10:00:00.000Z",
      ),
    ).toThrow();
    expect(() =>
      parseTmuxSessions(
        "$0__PACIUM_TMUX_FIELD__Meta__PACIUM_TMUX_FIELD__1__PACIUM_TMUX_FIELD__0__PACIUM_TMUX_FIELD__1785229200__PACIUM_TMUX_FIELD__/work\n$0__PACIUM_TMUX_FIELD__Other__PACIUM_TMUX_FIELD__1__PACIUM_TMUX_FIELD__0__PACIUM_TMUX_FIELD__1785229200__PACIUM_TMUX_FIELD__/work\n",
        "2026-07-28T10:00:00.000Z",
      ),
    ).toThrow("duplicate");
  });

  it.runIf(tmuxExecutable !== undefined)(
    "discovers and resolves one isolated real tmux target",
    async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-tmux-"));
    const socket = join(root, "server.sock");
    sockets.push(socket);
    await execFileAsync(tmuxExecutable!, [
      "-S",
      socket,
      "new-session",
      "-d",
      "-s",
      "pacium-fixture",
      "-c",
      process.cwd(),
    ]);
    const adapter = await createTmuxAdapter(socket, {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TERM: "xterm-256color",
    });

    expect(adapter.capability()).toMatchObject({
      state: "ready",
      serverId: "configured",
      version: expect.stringMatching(/^tmux /),
    });
    const observation = await adapter.discover();
    expect(observation).toMatchObject({
      status: "ready",
      sessions: [
        {
          target: {
            serverId: "configured",
            sessionName: "pacium-fixture",
          },
          currentPath: process.cwd(),
        },
      ],
    });
    const target = observation.sessions[0]!.target;
    await expect(
      adapter.attachSpec(target.serverId, target.sessionId),
    ).resolves.toMatchObject({
      executable: expect.stringMatching(/\/tmux$/),
      args: ["-S", socket, "attach-session", "-t", target.sessionId],
      target: {
        serverId: target.serverId,
        sessionId: target.sessionId,
        sessionName: target.sessionName,
      },
    });
    },
  );
});
