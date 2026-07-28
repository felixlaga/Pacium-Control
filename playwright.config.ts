import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { defineConfig } from "@playwright/test";

const verificationDirectory =
  process.env.PACIUM_E2E_CONFIG_DIRECTORY ??
  mkdtempSync(join(tmpdir(), "pacium-playwright-verification-"));
const verificationConfigPath = join(verificationDirectory, "verification.json");
const paciumStateDirectory =
  process.env.PACIUM_E2E_STATE_DIRECTORY ??
  mkdtempSync(join(tmpdir(), "pacium-playwright-state-"));
const providerFixtureDirectory = mkdtempSync(
  join(tmpdir(), "pacium-playwright-provider-"),
);
const queueFixturePath = join(paciumStateDirectory, "NEEDS-FELIX");
const objectiveFixturePath = join(paciumStateDirectory, "OBJECTIVE");
const planFixturePath = join(paciumStateDirectory, "PLAN");
const tmuxExecutable = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux"].find(
  existsSync,
);
writeFileSync(
  verificationConfigPath,
  JSON.stringify({
    version: 1,
    repositories: [
      {
        root: realpathSync(process.cwd()),
        presets: [
          {
            id: "verify",
            label: "Project verify",
            description: "Return deterministic browser evidence",
            executable: realpathSync(process.execPath),
            args: ["-e", "process.stdout.write('PC-037 verified\\n')"],
            timeoutMs: 10_000,
          },
          {
            id: "wait",
            label: "Cancellation fixture",
            description: "Wait until the operator cancels",
            executable: realpathSync(process.execPath),
            args: ["-e", "setInterval(() => {}, 1000)"],
            timeoutMs: 10_000,
          },
        ],
      },
    ],
  }),
);
process.env.PACIUM_E2E_CONFIG_DIRECTORY = verificationDirectory;
process.env.PACIUM_E2E_STATE_DIRECTORY = paciumStateDirectory;
process.env.PACIUM_E2E_QUEUE_PATH = queueFixturePath;
process.env.PACIUM_E2E_OBJECTIVE_PATH = objectiveFixturePath;
process.env.PACIUM_E2E_PLAN_PATH = planFixturePath;
process.env.PACIUM_E2E_PROVIDER_DIRECTORY = providerFixtureDirectory;
process.env.PACIUM_VERIFICATION_CONFIG = verificationConfigPath;
process.env.PACIUM_DATA_DIR = paciumStateDirectory;
writeFileSync(
  join(providerFixtureDirectory, "claude"),
  [
    "#!/bin/sh",
    'if [ "$1" = "--version" ]; then',
    "  printf '1.0.0-fixture\\n'",
    "  exit 0",
    "fi",
    'exec "${SHELL:-/bin/sh}" -l',
    "",
  ].join("\n"),
  { mode: 0o700 },
);
process.env.PATH = `${providerFixtureDirectory}${delimiter}${process.env.PATH ?? ""}`;
if (tmuxExecutable !== undefined) {
  const tmuxDirectory = mkdtempSync(join(tmpdir(), "pacium-playwright-tmux-"));
  const tmuxSocket = join(tmuxDirectory, "server.sock");
  execFileSync(tmuxExecutable, [
    "-S",
    tmuxSocket,
    "new-session",
    "-d",
    "-s",
    "pacium-e2e",
    "-c",
    process.cwd(),
  ]);
  process.env.PACIUM_TMUX_SOCKET = tmuxSocket;
  process.env.PACIUM_E2E_TMUX_DIRECTORY = tmuxDirectory;
  process.env.PACIUM_E2E_TMUX_EXECUTABLE = tmuxExecutable;
}
writeFileSync(queueFixturePath, "Initial private queue\n", { mode: 0o600 });
writeFileSync(objectiveFixturePath, "Make local agents easy to supervise.\n", {
  mode: 0o600,
});
writeFileSync(
  planFixturePath,
  "Keep terminal truth primary and context explicit.\n",
  { mode: 0o600 },
);

export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
