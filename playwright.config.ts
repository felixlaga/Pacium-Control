import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const verificationDirectory = mkdtempSync(
  join(tmpdir(), "pacium-playwright-verification-"),
);
const verificationConfigPath = join(verificationDirectory, "verification.json");
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
process.env.PACIUM_VERIFICATION_CONFIG = verificationConfigPath;

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
