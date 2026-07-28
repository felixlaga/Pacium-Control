import { randomUUID } from "node:crypto";
import { readdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_TERMINAL_SNAPSHOT_CHARS,
  type RepositoryObservation,
} from "@pacium/contracts";
import { FakePtyFactory } from "@pacium/test-utils";

import type { ServerConfig } from "./config.js";
import type { LaunchPresetDefinition } from "./launch-presets.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { SessionManager } from "./session-manager.js";

const IDLE_SESSION_COUNT = 20;
const CREATE_CLOSE_CYCLES = 100;
const OUTPUT_BYTES = 8 * 1024 * 1024;
const SNAPSHOT_READS = 100;
const REAL_PTY_CYCLES = 5;
const PEAK_RSS_BUDGET_BYTES = 256 * 1024 * 1024;
const RETAINED_RSS_BUDGET_BYTES = 192 * 1024 * 1024;
const RETAINED_HEAP_BUDGET_BYTES = 32 * 1024 * 1024;
const FD_DELTA_BUDGET = 4;
const EVENT_TIMEOUT_MS = 5_000;
const SUPPORTED_SHELL = process.platform === "linux" ? "/bin/bash" : "/bin/zsh";

const shellPreset: LaunchPresetDefinition = {
  id: "shell",
  label: "Shell",
  available: true,
  unavailableReason: null,
  executable: SUPPORTED_SHELL,
  args: ["-l"],
  classification: {
    type: "shell",
    label: "Shell",
    source: "launch_preset",
    confidence: "confirmed",
  },
};

const agentPreset: LaunchPresetDefinition = {
  id: "codex",
  label: "Codex",
  available: true,
  unavailableReason: null,
  executable: SUPPORTED_SHELL,
  args: ["-l"],
  classification: {
    type: "codex",
    label: "Codex CLI",
    source: "launch_preset",
    confidence: "confirmed",
  },
};

const launchPresets = [shellPreset, agentPreset] as const;

class SoakFailure extends Error {
  public constructor(public readonly code: string) {
    super(code);
  }
}

interface FdObservation {
  source: "dev_fd" | "proc_fd" | "unavailable";
  count: number | null;
}

function repositoryObservation(
  cwd: string,
  observedAt?: string,
): RepositoryObservation {
  return {
    status: "ready",
    root: cwd,
    name: "soak-repository",
    branch: "soak",
    headCommit: "a".repeat(40),
    headState: "branch",
    worktreeKind: "main",
    observedAt: observedAt ?? new Date().toISOString(),
    error: null,
  };
}

function createManager(factory: FakePtyFactory): SessionManager {
  return new SessionManager(
    factory,
    launchPresets,
    undefined,
    (cwd, observedAt) =>
      Promise.resolve(repositoryObservation(cwd, observedAt)),
  );
}

function assertSoak(condition: boolean, code: string): asserts condition {
  if (!condition) {
    throw new SoakFailure(code);
  }
}

function currentRss(): number {
  return process.memoryUsage.rss();
}

function currentHeap(): number {
  return process.memoryUsage().heapUsed;
}

async function collectGarbage(): Promise<void> {
  assertSoak(globalThis.gc !== undefined, "GC_UNAVAILABLE");
  for (let index = 0; index < 3; index += 1) {
    globalThis.gc();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

async function countFileDescriptors(): Promise<FdObservation> {
  for (const candidate of [
    { path: "/dev/fd", source: "dev_fd" as const },
    { path: "/proc/self/fd", source: "proc_fd" as const },
  ]) {
    try {
      return {
        source: candidate.source,
        count: (await readdir(candidate.path)).length,
      };
    } catch {
      // Try the next supported host path.
    }
  }
  return { source: "unavailable", count: null };
}

async function waitForDescriptorCleanup(
  baseline: FdObservation,
): Promise<FdObservation> {
  const deadline = performance.now() + EVENT_TIMEOUT_MS;
  let current = await countFileDescriptors();
  while (
    baseline.source === current.source &&
    baseline.count !== null &&
    current.count !== null &&
    current.count - baseline.count > FD_DELTA_BUDGET &&
    performance.now() < deadline
  ) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
    current = await countFileDescriptors();
  }
  return current;
}

async function waitForExit(
  manager: SessionManager,
  sessionId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new SoakFailure("REAL_PTY_EXIT_TIMEOUT"));
    }, EVENT_TIMEOUT_MS);
    const unsubscribe = manager.onSessionEvent((event) => {
      if (event.type === "exited" && event.session.id === sessionId) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
    manager.input(sessionId, "exit\r");
  });
}

async function warmHeadlessTerminal(cwd: string): Promise<void> {
  const factory = new FakePtyFactory();
  const manager = createManager(factory);
  try {
    const session = await manager.create({
      cwd,
      launchPreset: "shell",
      cols: 80,
      rows: 24,
    });
    const ptyProcess = factory.processes[0];
    assertSoak(ptyProcess !== undefined, "WARMUP_PTY_MISSING");
    ptyProcess.emitData(
      `${"bounded terminal warmup".padEnd(78, " ")}\r\n`.repeat(400),
    );
    await manager.snapshot(session.id);
    manager.close(session.id, true, randomUUID());
    ptyProcess.emitExit(143, 15);
  } finally {
    await manager.shutdown();
  }
}

async function runRealPtyCanary(cwd: string): Promise<{
  source: FdObservation["source"];
  baseline: number | null;
  final: number | null;
  delta: number | null;
}> {
  const dataDirectory = await mkdtemp(join(tmpdir(), "pacium-lifecycle-soak-"));
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 4174,
    allowedOrigins: new Set(["http://127.0.0.1:4174"]),
    tailscaleServe: null,
    accessToken: "soak-test-token",
    serverId: "soak-test-server",
    defaultCwd: cwd,
    homeDirectory: cwd,
    dataDirectory,
    shell: SUPPORTED_SHELL,
    tmuxSocket: null,
    environmentKeys: ["HOME", "PATH", "SHELL", "USER", "LANG", "TMPDIR"],
    launchPresets: [shellPreset],
    verificationCatalog: { configured: false, repositories: [] },
  };
  const manager = new SessionManager(
    new NodePtyFactory(config),
    config.launchPresets,
    undefined,
    (candidate, observedAt) =>
      Promise.resolve(repositoryObservation(candidate, observedAt)),
  );
  const baseline = await countFileDescriptors();

  try {
    for (let index = 0; index < REAL_PTY_CYCLES; index += 1) {
      const session = await manager.create({
        cwd,
        launchPreset: "shell",
        cols: 80,
        rows: 24,
      });
      await waitForExit(manager, session.id);
      manager.close(session.id, false, randomUUID());
    }
    assertSoak(manager.list().length === 0, "REAL_PTY_SESSION_LEAK");
  } finally {
    await manager.shutdown();
    await rm(dataDirectory, { recursive: true, force: true });
  }

  await collectGarbage();
  const final = await waitForDescriptorCleanup(baseline);
  const comparable =
    baseline.source === final.source &&
    baseline.count !== null &&
    final.count !== null;
  const baselineCount = comparable ? baseline.count : null;
  const finalCount = comparable ? final.count : null;
  return {
    source: comparable ? baseline.source : "unavailable",
    baseline: baselineCount,
    final: finalCount,
    delta:
      baselineCount !== null && finalCount !== null
        ? finalCount - baselineCount
        : null,
  };
}

async function run(): Promise<void> {
  const startedAt = performance.now();
  await warmHeadlessTerminal(process.cwd());
  await collectGarbage();
  const baselineRss = currentRss();
  const baselineHeap = currentHeap();
  let peakRss = baselineRss;
  const recordPeak = () => {
    peakRss = Math.max(peakRss, currentRss());
  };

  const factory = new FakePtyFactory();
  const manager = createManager(factory);
  let snapshotCharacters = 0;
  let snapshotSequence = 0;

  try {
    for (let index = 0; index < IDLE_SESSION_COUNT; index += 1) {
      await manager.create({
        displayName: `Idle ${index + 1}`,
        cwd: process.cwd(),
        launchPreset: "shell",
        cols: 80,
        rows: 24,
      });
    }
    const agent = await manager.create({
      displayName: "Long-running agent",
      cwd: process.cwd(),
      launchPreset: "codex",
      cols: 100,
      rows: 30,
    });
    recordPeak();

    for (let index = 0; index < CREATE_CLOSE_CYCLES; index += 1) {
      const session = await manager.create({
        cwd: process.cwd(),
        launchPreset: "shell",
        cols: 80,
        rows: 24,
      });
      const ptyProcess = factory.processes.at(-1);
      assertSoak(ptyProcess !== undefined, "FAKE_PTY_MISSING");
      manager.close(session.id, true, randomUUID());
      ptyProcess.emitExit(143, 15);
      assertSoak(ptyProcess.dataListenerCount === 0, "DATA_LISTENER_LEAK");
      assertSoak(ptyProcess.exitListenerCount === 0, "EXIT_LISTENER_LEAK");
    }
    assertSoak(
      manager.list().length === IDLE_SESSION_COUNT + 1,
      "CREATE_CLOSE_SESSION_LEAK",
    );
    recordPeak();

    const agentProcess = factory.processes[IDLE_SESSION_COUNT];
    assertSoak(agentProcess !== undefined, "AGENT_PTY_MISSING");
    const outputLine = `${"bounded terminal output".padEnd(78, " ")}\r\n`;
    const outputChunk = outputLine.repeat(400);
    let emittedOutputBytes = 0;
    let chunksSinceDrain = 0;
    while (emittedOutputBytes < OUTPUT_BYTES) {
      const remaining = OUTPUT_BYTES - emittedOutputBytes;
      const chunk = outputChunk.slice(0, remaining);
      agentProcess.emitData(chunk);
      emittedOutputBytes += Buffer.byteLength(chunk);
      chunksSinceDrain += 1;
      if (chunksSinceDrain === 32) {
        await manager.snapshot(agent.id);
        chunksSinceDrain = 0;
      }
    }
    assertSoak(emittedOutputBytes === OUTPUT_BYTES, "OUTPUT_WORKLOAD_INEXACT");
    recordPeak();

    for (let index = 0; index < SNAPSHOT_READS; index += 1) {
      const snapshot = await manager.snapshot(agent.id);
      snapshotCharacters = snapshot.data.length;
      snapshotSequence = snapshot.sequence;
      assertSoak(
        snapshotCharacters <= MAX_TERMINAL_SNAPSHOT_CHARS,
        "SNAPSHOT_BOUND_EXCEEDED",
      );
    }
    assertSoak(
      manager.list().length === IDLE_SESSION_COUNT + 1,
      "SNAPSHOT_CREATED_SESSION",
    );
    assertSoak(agentProcess.writes.length === 0, "SNAPSHOT_REPLAYED_INPUT");
    recordPeak();

    for (const session of manager.list()) {
      const ptyProcess = factory.processes.find(
        (candidate) => candidate.pid === session.pid,
      );
      assertSoak(ptyProcess !== undefined, "CLEANUP_PTY_MISSING");
      manager.close(session.id, true, randomUUID());
      ptyProcess.emitExit(143, 15);
    }
    assertSoak(manager.list().length === 0, "FAKE_SESSION_LEAK");
  } finally {
    await manager.shutdown();
  }

  await collectGarbage();
  const fakeRetainedRssDelta = Math.max(0, currentRss() - baselineRss);
  const fd = await runRealPtyCanary(process.cwd());
  recordPeak();
  await collectGarbage();
  const finalRss = currentRss();
  const finalHeap = currentHeap();
  const peakRssDelta = Math.max(0, peakRss - baselineRss);
  const retainedRssDelta = Math.max(0, finalRss - baselineRss);
  const retainedHeapDelta = Math.max(0, finalHeap - baselineHeap);

  assertSoak(peakRssDelta <= PEAK_RSS_BUDGET_BYTES, "PEAK_RSS_BUDGET_EXCEEDED");
  assertSoak(
    retainedRssDelta <= RETAINED_RSS_BUDGET_BYTES,
    "RETAINED_RSS_BUDGET_EXCEEDED",
  );
  assertSoak(
    retainedHeapDelta <= RETAINED_HEAP_BUDGET_BYTES,
    "RETAINED_HEAP_BUDGET_EXCEEDED",
  );
  assertSoak(
    fd.delta === null || fd.delta <= FD_DELTA_BUDGET,
    "FD_BUDGET_EXCEEDED",
  );

  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      status: "passed",
      runtime: {
        platform: process.platform,
        nodeMajor: Number(process.versions.node.split(".")[0]),
      },
      workload: {
        idleSessions: IDLE_SESSION_COUNT,
        createCloseCycles: CREATE_CLOSE_CYCLES,
        outputBytes: OUTPUT_BYTES,
        snapshotReads: SNAPSHOT_READS,
        realPtyCycles: REAL_PTY_CYCLES,
      },
      budgets: {
        peakRssBytes: PEAK_RSS_BUDGET_BYTES,
        retainedRssBytes: RETAINED_RSS_BUDGET_BYTES,
        retainedHeapBytes: RETAINED_HEAP_BUDGET_BYTES,
        fdDelta: FD_DELTA_BUDGET,
      },
      observed: {
        durationMs: Math.round(performance.now() - startedAt),
        peakRssDeltaBytes: peakRssDelta,
        retainedRssDeltaBytes: retainedRssDelta,
        fakeRetainedRssDeltaBytes: fakeRetainedRssDelta,
        retainedHeapDeltaBytes: retainedHeapDelta,
        snapshotCharacters,
        snapshotSequence,
        finalSessions: 0,
        fdSource: fd.source,
        fdBaseline: fd.baseline,
        fdFinal: fd.final,
        fdDelta: fd.delta,
      },
    })}\n`,
  );
}

try {
  await run();
} catch (error) {
  const code = error instanceof SoakFailure ? error.code : "UNEXPECTED_FAILURE";
  process.stderr.write(`PC-072 soak failed: ${code}\n`);
  process.exitCode = 1;
}
