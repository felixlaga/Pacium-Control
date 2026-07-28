import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TmuxAdapter,
  createTmuxAdapter,
  parseTmuxLaunch,
  parseTmuxSessions,
  resolveSafeTmuxSocketLocation,
} from "./tmux-adapter.js";

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

  it("rejects repository and non-canonical socket locations at startup", async () => {
    const repository = await mkdtemp(join(tmpdir(), "pacium-tmux-repo-"));
    await mkdir(join(repository, ".git"));
    await expect(
      resolveSafeTmuxSocketLocation(join(repository, "tmux.sock")),
    ).rejects.toThrow("outside Git repositories");

    const canonicalRoot = await mkdtemp(join(tmpdir(), "pacium-tmux-path-"));
    const aliasRoot = join(tmpdir(), `pacium-tmux-alias-${Date.now()}`);
    await writeFile(join(canonicalRoot, "tmux.sock"), "");
    await symlink(canonicalRoot, aliasRoot);
    await expect(
      resolveSafeTmuxSocketLocation(join(aliasRoot, "tmux.sock")),
    ).resolves.toBe(join(await realpath(canonicalRoot), "tmux.sock"));
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

  it("launches only direct server-owned tmux command arguments", async () => {
    const calls: Array<{ executable: string; args: readonly string[] }> = [];
    const adapter = new TmuxAdapter(
      "/private/tmp/pacium-test.sock",
      "/opt/test/bin/tmux",
      "tmux 3.7b",
      {},
      (executable, args) => {
        calls.push({ executable, args });
        return Promise.resolve({
          stdout:
            "$7__PACIUM_TMUX_FIELD__pacium-00000000-0000-4000-8000-000000000071\n",
          stderr: "",
        });
      },
    );
    const literalArgument = "literal; touch /private/tmp/not-executed";
    const spec = await adapter.launchSpec({
      sessionName: "pacium-00000000-0000-4000-8000-000000000071",
      cwd: "/work/pacium",
      cols: 100,
      rows: 30,
      executable: "/opt/test/bin/codex",
      args: ["--literal", literalArgument],
    });

    expect(calls).toEqual([
      {
        executable: "/opt/test/bin/tmux",
        args: [
          "-S",
          "/private/tmp/pacium-test.sock",
          "new-session",
          "-d",
          "-P",
          "-F",
          "#{session_id}__PACIUM_TMUX_FIELD__#{session_name}",
          "-s",
          "pacium-00000000-0000-4000-8000-000000000071",
          "-c",
          "/work/pacium",
          "-x",
          "100",
          "-y",
          "30",
          "/opt/test/bin/codex",
          "--literal",
          literalArgument,
        ],
      },
    ]);
    expect(spec).toMatchObject({
      mode: "keep_alive",
      target: {
        serverId: "configured",
        sessionId: "$7",
      },
      launchCommand: {
        executable: "/opt/test/bin/codex",
        args: ["--literal", literalArgument],
      },
    });
    expect(() =>
      parseTmuxLaunch(
        "$7__PACIUM_TMUX_FIELD__forged-name\n",
        "2026-07-28T10:00:00.000Z",
      ),
    ).not.toThrow();
    await expect(
      adapter.launchSpec({
        sessionName: "browser-chosen-name",
        cwd: "/work/pacium",
        cols: 100,
        rows: 30,
        executable: "/opt/test/bin/codex",
        args: [],
      }),
    ).rejects.toThrow("invalid");
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

      const capability = adapter.capability();
      expect(capability).toMatchObject({
        state: "ready",
        serverId: "configured",
      });
      expect(capability.version).toMatch(/^tmux /);
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
      const canonicalSocket = await realpath(socket);
      const spec = await adapter.attachSpec(target.serverId, target.sessionId);
      expect(spec).toMatchObject({
        args: ["-S", canonicalSocket, "attach-session", "-t", target.sessionId],
        target: {
          serverId: target.serverId,
          sessionId: target.sessionId,
          sessionName: target.sessionName,
        },
      });
      expect(spec.executable).toMatch(/\/tmux$/);

      const marker = join(root, "direct-argv.txt");
      const sideEffect = join(root, "must-not-exist");
      const literal = `literal; touch ${sideEffect}`;
      const launched = await adapter.launchSpec({
        sessionName: "pacium-00000000-0000-4000-8000-000000000071",
        cwd: process.cwd(),
        cols: 100,
        rows: 30,
        executable: process.execPath,
        args: [
          "-e",
          "require('node:fs').writeFileSync(process.argv[1], process.argv[2]); setInterval(() => {}, 1000)",
          marker,
          literal,
        ],
      });
      expect(launched).toMatchObject({
        mode: "keep_alive",
        target: {
          sessionName: "pacium-00000000-0000-4000-8000-000000000071",
        },
      });
      await vi.waitFor(
        async () => {
          await expect(readFile(marker, "utf8")).resolves.toBe(literal);
        },
        { timeout: 2_000 },
      );
      await expect(readFile(sideEffect, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );
});
