import { describe, expect, it, vi } from "vitest";
import { FakePtyFactory } from "@pacium/test-utils";

import type { HostActions } from "./host-actions.js";
import type { LaunchPresetDefinition } from "./launch-presets.js";
import type { GitChangesInspector } from "./git-changes.js";
import type { GitDiffInspector } from "./git-diff.js";
import type { GitHistoryInspector } from "./git-history.js";
import type { RepositoryInspector } from "./repository-context.js";
import { SessionError, SessionManager } from "./session-manager.js";
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
): SessionManager {
  return new SessionManager(
    factory,
    testPresets,
    hostActions,
    inspectRepository,
    gitChangesInspector,
    gitDiffInspector,
    gitHistoryInspector,
    verificationCatalog,
    verificationRunner,
  );
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
    });

    manager.shutdown();
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

    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
    manager.shutdown();
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
