import { Buffer } from "node:buffer";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  MAX_VERIFICATION_OUTPUT_BYTES,
  type VerificationRun,
} from "@pacium/contracts";
import { afterEach, describe, expect, it } from "vitest";

import type { VerificationPresetDefinition } from "./verification-config.js";
import {
  VerificationRunner,
  VerificationRunnerError,
} from "./verification-runner.js";

describe("verification process runner", () => {
  const runners: VerificationRunner[] = [];

  afterEach(() => {
    for (const runner of runners.splice(0)) {
      runner.shutdown();
    }
  });

  it("runs exact arguments without an implicit shell or full environment", async () => {
    const runner = createRunner({
      environment: {
        PACIUM_VISIBLE: "allowed",
      },
      observeHead: () => Promise.resolve("a".repeat(40)),
    });
    const completed = terminalRun(runner, "session-1");
    await runner.start(
      "session-1",
      process.cwd(),
      nodePreset(
        [
          "process.stdout.write([process.cwd(),",
          "process.env.PACIUM_VISIBLE,",
          "process.env.PACIUM_SECRET ?? 'missing'].join('|'))",
        ].join(""),
      ),
    );

    await expect(completed).resolves.toMatchObject({
      status: "passed",
      exitCode: 0,
      headComparison: "same",
      stdout: `${process.cwd()}|allowed|missing`,
      stderr: "",
    });
  });

  it("keeps nonzero exit and stderr evidence distinct", async () => {
    const runner = createRunner();
    const completed = terminalRun(runner, "session-1");
    await runner.start(
      "session-1",
      process.cwd(),
      nodePreset("process.stderr.write('failed\\n'); process.exit(7)"),
    );

    await expect(completed).resolves.toMatchObject({
      status: "failed",
      exitCode: 7,
      stdout: "",
      stderr: "failed\n",
    });
  });

  it("cancels only the exact active run", async () => {
    const runner = createRunner();
    const completed = terminalRun(runner, "session-1");
    const active = await runner.start(
      "session-1",
      process.cwd(),
      nodePreset("setInterval(() => {}, 1000)"),
    );

    expect(runner.cancel("session-1", active.runId)).toMatchObject({
      runId: active.runId,
      status: "cancelling",
    });
    expect(() =>
      runner.cancel("session-1", "8bb68506-36a9-45ee-877a-c8d9629863f0"),
    ).toThrow(VerificationRunnerError);
    await expect(completed).resolves.toMatchObject({
      status: "cancelled",
      signal: "SIGTERM",
      terminationForced: false,
    });
  });

  it("forces a process group that ignores graceful cancellation", async () => {
    const runner = createRunner({ terminationGraceMs: 40 });
    const readyPath = join(
      tmpdir(),
      `pacium-verification-ready-${crypto.randomUUID()}`,
    );
    const completed = terminalRun(runner, "session-1");
    const active = await runner.start(
      "session-1",
      process.cwd(),
      nodePreset(
        `process.on('SIGTERM', () => {});` +
          `require('node:fs').writeFileSync(${JSON.stringify(
            readyPath,
          )}, 'ready');` +
          "setInterval(() => {}, 1000)",
      ),
    );
    await waitForFile(readyPath);
    runner.cancel("session-1", active.runId);

    await expect(completed).resolves.toMatchObject({
      status: "cancelled",
      signal: "SIGKILL",
      terminationForced: true,
    });
    await rm(readyPath, { force: true });
  });

  it("times out and terminates a long-running process", async () => {
    const runner = createRunner({ terminationGraceMs: 40 });
    const completed = terminalRun(runner, "session-1");
    await runner.start(
      "session-1",
      process.cwd(),
      nodePreset("setInterval(() => {}, 1000)", 40),
    );

    await expect(completed).resolves.toMatchObject({
      status: "timed_out",
      signal: "SIGTERM",
      terminationForced: false,
    });
  });

  it("bounds both output streams and records truncation", async () => {
    const runner = createRunner();
    const completed = terminalRun(runner, "session-1");
    await runner.start(
      "session-1",
      process.cwd(),
      nodePreset(
        `process.stdout.write('o'.repeat(${MAX_VERIFICATION_OUTPUT_BYTES * 2}));` +
          `process.stderr.write('e'.repeat(${MAX_VERIFICATION_OUTPUT_BYTES * 2}))`,
      ),
    );

    const result = await completed;
    expect(result).toMatchObject({
      status: "passed",
      stdoutTruncated: true,
      stderrTruncated: true,
    });
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(
      MAX_VERIFICATION_OUTPUT_BYTES,
    );
    expect(Buffer.byteLength(result.stderr, "utf8")).toBeLessThanOrEqual(
      MAX_VERIFICATION_OUTPUT_BYTES,
    );
  });

  it("reserves per-session and global concurrency before starting", async () => {
    const runner = createRunner({ maxConcurrentRuns: 2 });
    const first = await runner.start(
      "session-1",
      process.cwd(),
      nodePreset("setInterval(() => {}, 1000)"),
    );
    const second = await runner.start(
      "session-2",
      process.cwd(),
      nodePreset("setInterval(() => {}, 1000)"),
    );

    await expect(
      runner.start("session-1", process.cwd(), nodePreset("process.exit(0)")),
    ).rejects.toMatchObject({ code: "VERIFICATION_BUSY" });
    await expect(
      runner.start("session-3", process.cwd(), nodePreset("process.exit(0)")),
    ).rejects.toMatchObject({ code: "VERIFICATION_BUSY" });

    const firstCompleted = terminalRun(runner, "session-1");
    const secondCompleted = terminalRun(runner, "session-2");
    runner.cancel("session-1", first.runId);
    runner.cancel("session-2", second.runId);
    await Promise.all([firstCompleted, secondCompleted]);
  });

  it("reports spawn failure and fresh changed-HEAD evidence", async () => {
    const heads = [
      Promise.resolve("a".repeat(40)),
      Promise.resolve("b".repeat(40)),
    ];
    const runner = createRunner({
      observeHead: () => heads.shift() ?? Promise.resolve(null),
    });
    const completed = terminalRun(runner, "session-1");
    await runner.start("session-1", process.cwd(), {
      ...nodePreset("process.exit(0)"),
      executable: "/path/that/does/not/exist/pacium-verifier",
    });

    await expect(completed).resolves.toMatchObject({
      status: "error",
      headCommitAtStart: "a".repeat(40),
      headCommitAtEnd: "b".repeat(40),
      headComparison: "changed",
      error: { code: "spawn_failed" },
    });
  });

  function createRunner(
    options: Partial<ConstructorParameters<typeof VerificationRunner>[0]> = {},
  ): VerificationRunner {
    const runner = new VerificationRunner({
      environment: {},
      observeHead: () => Promise.resolve(null),
      ...options,
    });
    runners.push(runner);
    return runner;
  }
});

function nodePreset(
  source: string,
  timeoutMs = 2_000,
): VerificationPresetDefinition {
  return {
    id: "verify",
    label: "Verify",
    description: "Run a deterministic verification fixture",
    executable: process.execPath,
    args: ["-e", source],
    timeoutMs,
  };
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error("Verification fixture did not become ready.");
}

function terminalRun(
  runner: VerificationRunner,
  ownerId: string,
): Promise<VerificationRun> {
  return new Promise((resolve) => {
    const unsubscribe = runner.onUpdate((event) => {
      if (
        event.ownerId === ownerId &&
        !["running", "cancelling"].includes(event.run.status)
      ) {
        unsubscribe();
        resolve(event.run);
      }
    });
  });
}
