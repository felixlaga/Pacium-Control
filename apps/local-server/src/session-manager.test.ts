import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { FakePtyFactory } from "@pacium/test-utils";
import type { SessionSummary } from "@pacium/contracts";

import { ClaudeObserver } from "./claude-observer.js";
import { CodexObserver } from "./codex-observer.js";
import type { HostActions } from "./host-actions.js";
import type { LaunchPresetDefinition } from "./launch-presets.js";
import type { GitChangesInspector } from "./git-changes.js";
import type { GitDiffInspector } from "./git-diff.js";
import type { GitHistoryInspector } from "./git-history.js";
import type { RepositoryInspector } from "./repository-context.js";
import { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import { SessionError, SessionManager } from "./session-manager.js";
import {
  TmuxAdapter,
  type TmuxAttachSpec,
  type TmuxLaunchInput,
} from "./tmux-adapter.js";
import type { VerificationCatalog } from "./verification-config.js";
import { VerificationRunner } from "./verification-runner.js";

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

function createManager(
  factory: FakePtyFactory,
  hostActions?: HostActions,
  inspectRepository: RepositoryInspector = (cwd, observedAt) =>
    Promise.resolve(repositoryObservation(cwd, "dev", observedAt)),
  gitChangesInspector: GitChangesInspector = (repository, observedAt) =>
    Promise.resolve(emptyChanges(repository.root, observedAt)),
  gitDiffInspector: GitDiffInspector = (repository, path, observedAt) =>
    Promise.resolve(emptyDiff(repository.root, path, observedAt)),
  gitHistoryInspector: GitHistoryInspector = (repository, observedAt) =>
    Promise.resolve(emptyHistory(repository.root, observedAt)),
  verificationCatalog: VerificationCatalog = {
    configured: false,
    repositories: [],
  },
  verificationRunner?: VerificationRunner,
  claudeObserver?: ClaudeObserver,
  launchPresets: readonly LaunchPresetDefinition[] = testPresets,
  codexObserver?: CodexObserver,
  relaunchManifests?: RelaunchManifestStore,
  environmentKeys: readonly string[] = [],
  tmuxAdapter?: TmuxAdapter,
): SessionManager {
  return new SessionManager(
    factory,
    launchPresets,
    hostActions,
    inspectRepository,
    gitChangesInspector,
    gitDiffInspector,
    gitHistoryInspector,
    verificationCatalog,
    verificationRunner,
    claudeObserver,
    codexObserver,
    relaunchManifests,
    environmentKeys,
    tmuxAdapter,
  );
}

class FixtureTmuxAdapter extends TmuxAdapter {
  public readonly launches: TmuxLaunchInput[] = [];
  public readonly detachedClients: Array<{
    sessionId: string;
    clientPid: number;
  }> = [];

  public constructor() {
    super(
      "/private/tmp/pacium-test.sock",
      "/opt/test/bin/tmux",
      "tmux 3.7b",
      {},
    );
  }

  public override attachSpec(
    serverId: string,
    sessionId: string,
  ): Promise<TmuxAttachSpec> {
    if (
      serverId !== "configured" ||
      (sessionId !== "$7" && sessionId !== "$8")
    ) {
      return Promise.reject(
        new Error("The selected tmux session is no longer available."),
      );
    }
    return Promise.resolve({
      executable: "/opt/test/bin/tmux",
      args: [
        "-S",
        "/private/tmp/pacium-test.sock",
        "attach-session",
        "-t",
        sessionId,
      ],
      cwd: process.cwd(),
      target: {
        serverId: "configured",
        sessionId,
        sessionName: sessionId === "$8" ? "pacium-managed" : "Meta",
        observedAt: "2026-07-28T10:00:00.000Z",
      },
    });
  }

  public override launchSpec(input: TmuxLaunchInput): Promise<TmuxAttachSpec> {
    this.launches.push(input);
    return Promise.resolve({
      executable: "/opt/test/bin/tmux",
      args: [
        "-S",
        "/private/tmp/pacium-test.sock",
        "attach-session",
        "-t",
        "$8",
      ],
      cwd: input.cwd,
      target: {
        serverId: "configured",
        sessionId: "$8",
        sessionName: input.sessionName,
        observedAt: "2026-07-28T10:00:00.000Z",
      },
      mode: "keep_alive",
      launchCommand: {
        executable: input.executable,
        args: input.args,
      },
    });
  }

  public override detachClient(
    target: { sessionId: string },
    clientPid: number,
  ): Promise<void> {
    this.detachedClients.push({ sessionId: target.sessionId, clientPid });
    return Promise.resolve();
  }
}

class FailingPtyFactory extends FakePtyFactory {
  public override create(
    options: Parameters<FakePtyFactory["create"]>[0],
  ): ReturnType<FakePtyFactory["create"]> {
    this.createCalls.push(options);
    throw new Error("Synthetic tmux client spawn failure.");
  }
}

class UnavailableTmuxAdapter extends FixtureTmuxAdapter {
  public override attachSpec(): Promise<TmuxAttachSpec> {
    return Promise.reject(new Error("Synthetic missing tmux target."));
  }
}

function repositoryObservation(
  cwd: string,
  branch: string,
  observedAt?: string,
) {
  return {
    status: "ready" as const,
    root: cwd,
    name: cwd.split("/").at(-1) ?? cwd,
    branch,
    headCommit: branch === "dev" ? "a".repeat(40) : "b".repeat(40),
    headState: "branch" as const,
    worktreeKind: "main" as const,
    observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
    error: null,
  };
}

function emptyChanges(root: string | null, observedAt?: string) {
  return {
    status: root === null ? ("not_repository" as const) : ("ready" as const),
    root,
    headCommit: root === null ? null : "a".repeat(40),
    observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
    files: [],
    totals: {
      fileCount: 0,
      additions: 0,
      deletions: 0,
      unavailableLineCount: 0,
      conflictCount: 0,
    },
    truncated: false,
    error: null,
  };
}

function emptyDiff(root: string | null, path: string, observedAt?: string) {
  return {
    status: root === null ? ("not_repository" as const) : ("empty" as const),
    root,
    headCommit: root === null ? null : "a".repeat(40),
    path,
    previousPath: null,
    observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
    sections: [],
    patchBytes: 0,
    patchLines: 0,
    error: null,
  };
}

function emptyHistory(root: string | null, observedAt?: string) {
  return {
    status: root === null ? ("not_repository" as const) : ("empty" as const),
    root,
    headCommit: null,
    observedAt: observedAt ?? "2026-07-27T10:00:00.000Z",
    commits: [],
    truncated: false,
    error: null,
  };
}

describe("SessionManager", () => {
  it("attaches one revalidated tmux target through the existing PTY lifecycle", async () => {
    const factory = new FakePtyFactory();
    const adapter = new FixtureTmuxAdapter();
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      undefined,
      [],
      adapter,
    );

    await expect(
      manager.attachTmux("configured", "$9", 100, 30),
    ).rejects.toMatchObject({
      code: "TMUX_TARGET_UNAVAILABLE",
      retryable: true,
    });
    expect(factory.createCalls).toHaveLength(0);

    const session = await manager.attachTmux("configured", "$7", 100, 30);
    expect(session).toMatchObject({
      displayName: "Meta",
      runtime: "tmux",
      commandLabel: "tmux · Meta",
      providerObservation: null,
      tmuxTarget: {
        serverId: "configured",
        sessionId: "$7",
        sessionName: "Meta",
      },
      relaunchManifest: {
        runtime: "tmux",
        tmuxTarget: {
          serverId: "configured",
          sessionId: "$7",
        },
      },
    });
    expect(factory.createCalls).toEqual([
      {
        executable: "/opt/test/bin/tmux",
        args: [
          "-S",
          "/private/tmp/pacium-test.sock",
          "attach-session",
          "-t",
          "$7",
        ],
        cwd: process.cwd(),
        cols: 100,
        rows: 30,
      },
    ]);

    manager.input(session.id, "pwd\r");
    manager.resize(session.id, 110, 34);
    expect(factory.processes[0]?.writes).toEqual(["pwd\r"]);
    expect(factory.processes[0]?.resizes).toEqual([{ cols: 110, rows: 34 }]);
    manager.close(session.id, true, crypto.randomUUID());
    await vi.waitFor(() =>
      expect(adapter.detachedClients).toEqual([
        { sessionId: "$7", clientPid: factory.processes[0]?.pid },
      ]),
    );
    expect(factory.processes[0]?.signals).toEqual([]);
    factory.processes[0]?.emitExit(0, 0);
    expect(manager.list()).toEqual([]);
    await manager.shutdown();
    expect(factory.processes[0]?.signals).toEqual([]);
  });

  it("launches a fixed preset as durable tmux evidence before its client", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-keep-alive-"));
    const store = new RelaunchManifestStore(join(root, "data"));
    await store.initialize();
    const factory = new FakePtyFactory();
    const adapter = new FixtureTmuxAdapter();
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      ["HOME", "PATH"],
      adapter,
    );

    const session = await manager.create({
      cwd: process.cwd(),
      displayName: "Durable Codex",
      launchPreset: "codex",
      cols: 100,
      rows: 30,
      keepAlive: true,
    });
    expect(adapter.launches).toHaveLength(1);
    expect(adapter.launches[0]).toMatchObject({
      cwd: process.cwd(),
      cols: 100,
      rows: 30,
      executable: "/opt/test/bin/codex",
      args: [],
    });
    expect(adapter.launches[0]?.sessionName).toMatch(/^pacium-/);
    expect(session).toMatchObject({
      displayName: "Durable Codex",
      launchPreset: "codex",
      commandLabel: "tmux keep-alive · Codex",
      runtime: "tmux",
      tmuxMode: "keep_alive",
      tmuxTarget: {
        serverId: "configured",
        sessionId: "$8",
      },
      agentClassification: {
        type: "codex",
        source: "launch_preset",
      },
      providerObservation: {
        provider: "codex",
        health: {
          state: "unavailable",
          source: "none",
        },
      },
      relaunchManifest: {
        provider: "codex",
        command: {
          executable: "/opt/test/bin/codex",
          args: [],
        },
        runtime: "tmux",
        tmuxMode: "keep_alive",
      },
    });
    expect(store.list()).toHaveLength(1);
    expect(factory.createCalls[0]).toMatchObject({
      executable: "/opt/test/bin/tmux",
      args: [
        "-S",
        "/private/tmp/pacium-test.sock",
        "attach-session",
        "-t",
        "$8",
      ],
    });
    await manager.shutdown();
  });

  it("retains recovery evidence when the keep-alive client cannot spawn", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-keep-alive-failure-"));
    const store = new RelaunchManifestStore(join(root, "data"));
    await store.initialize();
    const manager = createManager(
      new FailingPtyFactory(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      [],
      new FixtureTmuxAdapter(),
    );

    await expect(
      manager.create({
        cwd: process.cwd(),
        displayName: "Durable failure",
        launchPreset: "codex",
        cols: 100,
        rows: 30,
        keepAlive: true,
      }),
    ).rejects.toMatchObject({
      code: "TMUX_CLIENT_SPAWN_FAILED",
      retryable: true,
    });
    expect(manager.list()).toHaveLength(0);
    expect(store.list()).toMatchObject([
      {
        displayName: "Durable failure",
        tmuxMode: "keep_alive",
        tmuxTarget: { sessionId: "$8" },
      },
    ]);
  });

  it("restores only the newest unique keep-alive target after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-keep-alive-restore-"));
    const store = new RelaunchManifestStore(join(root, "data"));
    await store.initialize();
    const firstFactory = new FakePtyFactory();
    const first = createManager(
      firstFactory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      [],
      new FixtureTmuxAdapter(),
    );
    await first.create({
      cwd: process.cwd(),
      displayName: "Direct",
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    await first.attachTmux("configured", "$7", 80, 24);
    const durable = await first.create({
      cwd: process.cwd(),
      displayName: "Durable",
      launchPreset: "codex",
      cols: 100,
      rows: 30,
      keepAlive: true,
    });
    await first.shutdown();
    await first.flushRelaunchManifests();

    const secondFactory = new FakePtyFactory();
    const second = createManager(
      secondFactory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      [],
      new FixtureTmuxAdapter(),
    );
    await expect(second.restoreKeepAliveSessions()).resolves.toEqual({
      attempted: 1,
      restored: 1,
      unavailable: 0,
      deferred: 0,
    });
    expect(second.list()).toHaveLength(1);
    expect(second.list()[0]).toMatchObject({
      displayName: "Durable",
      launchPreset: "codex",
      tmuxMode: "keep_alive",
      relaunchManifest: {
        predecessorSessionId: durable.id,
      },
    });
    await expect(second.restoreKeepAliveSessions()).resolves.toEqual({
      attempted: 0,
      restored: 0,
      unavailable: 0,
      deferred: 0,
    });
    await second.shutdown();
    await second.flushRelaunchManifests();

    const unavailable = createManager(
      new FakePtyFactory(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      [],
      new UnavailableTmuxAdapter(),
    );
    await expect(unavailable.restoreKeepAliveSessions()).resolves.toEqual({
      attempted: 1,
      restored: 0,
      unavailable: 1,
      deferred: 0,
    });
    expect(unavailable.list()).toHaveLength(0);
    expect(
      store
        .list()
        .some(
          (manifest) =>
            manifest.tmuxMode === "keep_alive" &&
            manifest.tmuxTarget?.sessionId === "$8",
        ),
    ).toBe(true);
  });

  it("reports exact live sessions and fixed launch presets without mutation", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);

    expect(manager.hasSession("missing")).toBe(false);
    expect(manager.hasLaunchPreset("shell")).toBe(true);
    expect(manager.hasLaunchPreset("claude")).toBe(true);

    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    expect(manager.hasSession(session.id)).toBe(true);

    await manager.shutdown();
    expect(manager.hasSession(session.id)).toBe(false);
  });

  it("creates a terminal, routes input and resize, and restores output", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
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
      agentClassification: {
        type: "shell",
        label: "Shell",
        source: "launch_preset",
        confidence: "confirmed",
        observedAt: session.createdAt,
      },
      providerObservation: null,
      relaunchManifest: {
        schemaVersion: 1,
        sessionId: session.id,
        predecessorSessionId: null,
        launchPreset: "shell",
        provider: null,
        command: {
          executable: "/bin/zsh",
          args: ["-l"],
        },
        cwd: process.cwd(),
        environmentKeys: [],
        runtime: "pty",
        resumeReference: null,
        createdAt: session.createdAt,
        updatedAt: session.createdAt,
      },
    });

    await manager.shutdown();
  });

  it("persists a secret-free manifest and relaunches an exact successor", async () => {
    const root = await mkdtemp(join(tmpdir(), "pacium-session-manifest-"));
    const store = new RelaunchManifestStore(join(root, "data"));
    await store.initialize();
    const factory = new FakePtyFactory();
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      undefined,
      store,
      ["HOME", "PATH", "PACIUM_TEST_SECRET"],
    );
    const source = await manager.create({
      cwd: process.cwd(),
      displayName: "Meta",
      launchPreset: "codex",
      cols: 90,
      rows: 28,
    });
    const retained = manager.listRelaunchManifests()[0];
    expect(retained).toMatchObject({
      sessionId: source.id,
      predecessorSessionId: null,
      displayName: "Meta",
      launchPreset: "codex",
      provider: "codex",
      command: { executable: "/opt/test/bin/codex", args: [] },
      cwd: process.cwd(),
      environmentKeys: ["HOME", "PATH", "PACIUM_TEST_SECRET"],
      resumeReference: null,
    });

    const successor = await manager.relaunch(retained!.id, 100, 30);
    expect(successor.id).not.toBe(source.id);
    expect(successor.relaunchManifest?.predecessorSessionId).toBe(source.id);
    expect(factory.createCalls).toHaveLength(2);
    expect(factory.createCalls[1]).toMatchObject({
      executable: "/opt/test/bin/codex",
      cwd: process.cwd(),
      cols: 100,
      rows: 30,
    });
    expect(JSON.stringify(manager.listRelaunchManifests())).not.toContain(
      "secret-value",
    );
    await manager.shutdown();
  });

  it("does not destroy a PTY when no browser listener is attached", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
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

    await manager.shutdown();
  });

  it("requires explicit force to close a live shell", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
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
    expect(factory.processes[0]?.dataListenerCount).toBe(0);
    expect(factory.processes[0]?.exitListenerCount).toBe(0);
  });

  it("releases PTY listeners during server shutdown", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
    await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    expect(factory.processes[0]?.dataListenerCount).toBe(1);
    expect(factory.processes[0]?.exitListenerCount).toBe(1);
    await manager.shutdown();
    expect(factory.processes[0]?.dataListenerCount).toBe(0);
    expect(factory.processes[0]?.exitListenerCount).toBe(0);
  });

  it("renames session metadata and emits an updated summary", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
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
    await manager.shutdown();
  });

  it("reveals only the session's canonical repository root", async () => {
    const factory = new FakePtyFactory();
    const revealPath = vi.fn().mockResolvedValue(undefined);
    const manager = createManager(factory, { revealPath });
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    await manager.revealRepository(session.id);
    expect(revealPath).toHaveBeenCalledWith(session.repository.root);
    await manager.shutdown();
  });

  it("refreshes repository evidence without replacing or signalling the PTY", async () => {
    const factory = new FakePtyFactory();
    const inspectRepository = vi
      .fn<RepositoryInspector>()
      .mockImplementationOnce((cwd, observedAt) =>
        Promise.resolve(repositoryObservation(cwd, "dev", observedAt)),
      )
      .mockImplementationOnce((cwd, observedAt) =>
        Promise.resolve(repositoryObservation(cwd, "feature", observedAt)),
      );
    const manager = createManager(factory, undefined, inspectRepository);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const updates: string[] = [];
    manager.onSessionEvent((event) => {
      if (event.type === "updated") {
        updates.push(event.session.repository.branch ?? "none");
      }
    });

    await expect(manager.refreshRepository(session.id)).resolves.toMatchObject({
      branch: "feature",
      headCommit: "b".repeat(40),
    });
    expect(manager.list()[0]?.id).toBe(session.id);
    expect(factory.processes[0]?.signals).toEqual([]);
    expect(updates).toEqual(["feature"]);
    await manager.shutdown();
  });

  it("reads changed files from server-owned repository evidence without signalling the PTY", async () => {
    const factory = new FakePtyFactory();
    const inspectChanges = vi
      .fn<GitChangesInspector>()
      .mockImplementation((repository, observedAt) =>
        Promise.resolve({
          ...emptyChanges(repository.root, observedAt),
          files: [
            {
              path: "src/app.ts",
              previousPath: null,
              kind: "modified",
              staged: false,
              unstaged: true,
              untracked: false,
              conflicted: false,
              additions: 4,
              deletions: 1,
              binary: false,
              large: false,
              sizeBytes: 100,
            },
          ],
          totals: {
            fileCount: 1,
            additions: 4,
            deletions: 1,
            unavailableLineCount: 0,
            conflictCount: 0,
          },
        }),
      );
    const manager = createManager(
      factory,
      undefined,
      undefined,
      inspectChanges,
    );
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    await expect(manager.repositoryChanges(session.id)).resolves.toMatchObject({
      status: "ready",
      files: [{ path: "src/app.ts" }],
    });
    expect(inspectChanges).toHaveBeenCalledWith(
      session.repository,
      expect.any(String),
    );
    expect(factory.processes[0]?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("reads one diff from server-owned session evidence without changing the PTY", async () => {
    const factory = new FakePtyFactory();
    const inspectDiff = vi
      .fn<GitDiffInspector>()
      .mockImplementation((repository, path, observedAt) =>
        Promise.resolve({
          ...emptyDiff(repository.root, path, observedAt),
          status: "ready",
          previousPath: "src/old.ts",
          sections: [
            {
              source: "combined",
              patch: "@@ -1 +1 @@\n-old\n+new\n",
              byteCount: 22,
              lineCount: 3,
            },
          ],
          patchBytes: 22,
          patchLines: 3,
        }),
      );
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      inspectDiff,
    );
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const ptyProcess = factory.processes[0];

    await expect(
      manager.repositoryDiff(session.id, "src/new.ts"),
    ).resolves.toMatchObject({
      status: "ready",
      path: "src/new.ts",
      previousPath: "src/old.ts",
    });
    expect(inspectDiff).toHaveBeenCalledWith(
      session.repository,
      "src/new.ts",
      expect.any(String),
    );
    expect(factory.processes[0]).toBe(ptyProcess);
    expect(ptyProcess?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("reads history from server-owned session evidence without changing the PTY", async () => {
    const factory = new FakePtyFactory();
    const inspectHistory = vi
      .fn<GitHistoryInspector>()
      .mockImplementation((repository, observedAt) =>
        Promise.resolve({
          status: "ready",
          root: repository.root,
          headCommit: "c".repeat(40),
          observedAt: observedAt ?? "2026-07-27T11:00:00.000Z",
          commits: [
            {
              id: "c".repeat(40),
              parents: ["b".repeat(40)],
              authorName: "Pacium Agent",
              authoredAt: "2026-07-27T11:00:00+02:00",
              subject: "Bounded history",
            },
          ],
          truncated: false,
          error: null,
        }),
      );
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      inspectHistory,
    );
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const ptyProcess = factory.processes[0];

    await expect(manager.repositoryHistory(session.id)).resolves.toMatchObject({
      status: "ready",
      commits: [{ subject: "Bounded history" }],
    });
    expect(inspectHistory).toHaveBeenCalledWith(
      session.repository,
      expect.any(String),
    );
    expect(factory.processes[0]).toBe(ptyProcess);
    expect(ptyProcess?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("reports verification as unavailable without explicit configuration", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });

    expect(manager.repositoryVerification(session.id)).toMatchObject({
      status: "unconfigured",
      configured: false,
      presets: [],
      run: null,
    });
    await expect(
      manager.runRepositoryVerification(session.id, "verify"),
    ).rejects.toMatchObject({ code: "VERIFICATION_UNCONFIGURED" });
    expect(factory.processes[0]?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("runs only the configured preset for the session repository", async () => {
    const factory = new FakePtyFactory();
    const runner = new VerificationRunner({
      environment: {},
      observeHead: () => Promise.resolve("a".repeat(40)),
    });
    const catalog = verificationCatalog(
      "process.stdout.write('manager verification passed\\n')",
    );
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      catalog,
      runner,
    );
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const completed = verificationEvent(manager, session.id, "passed");

    await expect(
      manager.runRepositoryVerification(session.id, "verify"),
    ).resolves.toMatchObject({
      status: "ready",
      presets: [{ id: "verify", executable: process.execPath }],
      run: { status: "running" },
    });
    await expect(completed).resolves.toMatchObject({
      status: "ready",
      run: {
        status: "passed",
        stdout: "manager verification passed\n",
      },
    });
    await expect(
      manager.runRepositoryVerification(session.id, "browser-command"),
    ).rejects.toMatchObject({
      code: "VERIFICATION_PRESET_UNAVAILABLE",
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("cancels an exact verification run without signalling the PTY", async () => {
    const factory = new FakePtyFactory();
    const runner = new VerificationRunner({
      environment: {},
      observeHead: () => Promise.resolve("a".repeat(40)),
      terminationGraceMs: 50,
    });
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      verificationCatalog("setInterval(() => {}, 1000)"),
      runner,
    );
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const started = await manager.runRepositoryVerification(
      session.id,
      "verify",
    );
    const runId = started.run?.runId;
    expect(runId).toBeDefined();
    const completed = verificationEvent(manager, session.id, "cancelled");

    expect(
      manager.cancelRepositoryVerification(session.id, runId!),
    ).toMatchObject({ run: { status: "cancelling" } });
    await expect(completed).resolves.toMatchObject({
      run: { status: "cancelled" },
    });
    expect(factory.processes[0]?.signals).toEqual([]);
    await manager.shutdown();
  });

  it("rejects a missing working directory without creating a PTY", async () => {
    const factory = new FakePtyFactory();
    const manager = createManager(factory);

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
    const manager = createManager(factory);
    const session = await manager.create({
      cwd: process.cwd(),
      launchPreset: "codex",
      cols: 80,
      rows: 24,
    });

    expect(session).toMatchObject({
      launchPreset: "codex",
      commandLabel: "Codex",
      agentClassification: {
        type: "codex",
        label: "Codex CLI",
        source: "launch_preset",
        confidence: "confirmed",
        observedAt: session.createdAt,
      },
      providerObservation: {
        provider: "codex",
        health: {
          state: "unavailable",
          source: "none",
          confidence: "low",
        },
        attention: null,
        activities: [],
        diagnostics: [],
      },
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
    await manager.shutdown();
  });

  it("prepares only Claude launches and applies authenticated observer updates", async () => {
    const factory = new FakePtyFactory();
    const token = "t".repeat(43);
    const observer = new ClaudeObserver({
      baseUrl: "http://127.0.0.1:4174",
      providerVersion: "2.1.206",
      tokenFactory: () => token,
    });
    const presets = testPresets.map((preset) =>
      preset.id === "claude"
        ? {
            ...preset,
            available: true,
            unavailableReason: null,
            executable: "/opt/test/bin/claude",
          }
        : preset,
    );
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      observer,
      presets,
    );
    const updates: SessionSummary[] = [];
    manager.onSessionEvent((event) => {
      if (event.type === "updated") {
        updates.push(event.session);
      }
    });

    const claude = await manager.create({
      cwd: process.cwd(),
      launchPreset: "claude",
      cols: 80,
      rows: 24,
    });
    const createCall = factory.createCalls[0];
    expect(createCall).toMatchObject({
      executable: "/opt/test/bin/claude",
      environment: { PACIUM_CLAUDE_HOOK_TOKEN: token },
    });
    expect(createCall?.args[0]).toBe("--settings");
    expect(createCall?.args[1]).not.toContain(token);
    expect(claude.providerObservation).toMatchObject({
      provider: "claude",
      providerVersion: "2.1.206",
      health: { state: "unavailable" },
    });
    expect(observer.hasSession(claude.id)).toBe(true);

    expect(
      observer.ingestHook(claude.id, token, {
        session_id: "claude-session",
        prompt_id: "prompt-1",
        hook_event_name: "PermissionRequest",
        tool_name: "Bash",
        tool_use_id: "tool-1",
        tool_input: { command: "private command" },
      }).status,
    ).toBe("accepted");
    expect(updates.at(-1)?.providerObservation).toMatchObject({
      health: { state: "ready", source: "hook" },
      attention: { state: "needs_input", source: "hook" },
      activities: [{ kind: "approval_requested" }],
    });
    expect(JSON.stringify(updates.at(-1))).not.toContain("private command");

    factory.processes[0]?.emitExit(0, 0);
    expect(observer.hasSession(claude.id)).toBe(false);
    await manager.shutdown();
  });

  it("prepares only Codex launches and applies native observer updates", async () => {
    const factory = new FakePtyFactory();
    const token = "c".repeat(43);
    const observer = new CodexObserver({
      baseUrl: "http://127.0.0.1:4174",
      executable: "/opt/test/bin/codex",
      environment: { PATH: "/opt/test/bin" },
      capability: { available: true, version: "0.145.0" },
      tokenFactory: () => token,
    });
    const manager = createManager(
      factory,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      testPresets,
      observer,
    );
    const updates: SessionSummary[] = [];
    manager.onSessionEvent((event) => {
      if (event.type === "updated") {
        updates.push(event.session);
      }
    });

    const codex = await manager.create({
      cwd: process.cwd(),
      launchPreset: "codex",
      cols: 80,
      rows: 24,
    });
    expect(factory.createCalls[0]).toMatchObject({
      executable: "/opt/test/bin/codex",
      args: [
        "--remote",
        `ws://127.0.0.1:4174/api/provider/codex/${codex.id}/runtime`,
        "--remote-auth-token-env",
        "PACIUM_CODEX_RUNTIME_TOKEN",
      ],
      environment: { PACIUM_CODEX_RUNTIME_TOKEN: token },
    });
    expect(JSON.stringify(factory.createCalls[0]?.args)).not.toContain(token);
    expect(codex.providerObservation).toMatchObject({
      provider: "codex",
      providerVersion: "0.145.0",
      health: { state: "unavailable" },
    });
    expect(observer.hasSession(codex.id)).toBe(true);

    expect(
      observer.ingestServerMessage(codex.id, {
        id: 9,
        method: "item/tool/requestUserInput",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          questions: [{ question: "private question" }],
        },
      }).status,
    ).toBe("accepted");
    expect(updates.at(-1)?.providerObservation).toMatchObject({
      health: { state: "ready", source: "native" },
      attention: { state: "needs_input", source: "native" },
      activities: [{ kind: "question_requested" }],
    });
    expect(JSON.stringify(updates.at(-1))).not.toContain("private question");
    await Promise.resolve();
    expect(manager.list()[0]?.relaunchManifest?.resumeReference).toMatchObject({
      provider: "codex",
      id: "thread-1",
    });

    factory.processes[0]?.emitExit(0, 0);
    expect(observer.hasSession(codex.id)).toBe(false);
    await manager.shutdown();
  });
});

function verificationCatalog(source: string): VerificationCatalog {
  return {
    configured: true,
    repositories: [
      {
        root: process.cwd(),
        presets: [
          {
            id: "verify",
            label: "Verify",
            description: "Run the configured verification fixture",
            executable: process.execPath,
            args: ["-e", source],
            timeoutMs: 2_000,
          },
        ],
      },
    ],
  };
}

function verificationEvent(
  manager: SessionManager,
  sessionId: string,
  status: "passed" | "cancelled",
) {
  return new Promise<ReturnType<SessionManager["repositoryVerification"]>>(
    (resolve) => {
      const unsubscribe = manager.onSessionEvent((event) => {
        if (
          event.type === "verification" &&
          event.sessionId === sessionId &&
          event.observation.run?.status === status
        ) {
          unsubscribe();
          resolve(event.observation);
        }
      });
    },
  );
}
