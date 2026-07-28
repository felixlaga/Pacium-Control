import { buildChildEnvironment, loadServerConfig } from "./config.js";
import { ClaudeObserver, detectClaudeVersion } from "./claude-observer.js";
import { CodexObserver, detectCodexRuntime } from "./codex-observer.js";
import { CodexRuntimeBridge } from "./codex-runtime-bridge.js";
import { createPaciumHttpServer } from "./http-server.js";
import { createHostActions } from "./host-actions.js";
import { createPaciumConfigStore } from "./pacium-config-service.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { QueueObserver } from "./queue-observer.js";
import { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import { SessionManager } from "./session-manager.js";
import { createTmuxAdapter } from "./tmux-adapter.js";
import { VerificationRunner } from "./verification-runner.js";

const config = loadServerConfig();
const childEnvironment = buildChildEnvironment(config.environmentKeys);
const claudeExecutable =
  config.launchPresets.find(({ id }) => id === "claude")?.executable ?? null;
const codexExecutable =
  config.launchPresets.find(({ id }) => id === "codex")?.executable ?? null;
const claudeObserver = new ClaudeObserver({
  baseUrl: `http://${config.host}:${config.port}`,
  providerVersion:
    claudeExecutable === null
      ? null
      : detectClaudeVersion(claudeExecutable, childEnvironment),
});
const codexObserver =
  codexExecutable === null
    ? undefined
    : new CodexObserver({
        baseUrl: `http://${config.host}:${config.port}`,
        executable: codexExecutable,
        environment: childEnvironment,
        capability: detectCodexRuntime(codexExecutable, childEnvironment),
      });
const codexRuntimeBridge =
  codexObserver === undefined
    ? undefined
    : new CodexRuntimeBridge(codexObserver);
const verificationRunner = new VerificationRunner({
  environment: childEnvironment,
});
const relaunchManifests = new RelaunchManifestStore(config.dataDirectory);
await relaunchManifests.initialize();
const tmuxAdapter = await createTmuxAdapter(
  config.tmuxSocket,
  childEnvironment,
);
const sessions = new SessionManager(
  new NodePtyFactory(config),
  config.launchPresets,
  createHostActions(),
  undefined,
  undefined,
  undefined,
  undefined,
  config.verificationCatalog,
  verificationRunner,
  claudeObserver,
  codexObserver,
  relaunchManifests,
  config.environmentKeys,
  tmuxAdapter,
);
const paciumConfig = createPaciumConfigStore(config, sessions);
const queueObserver = new QueueObserver();
await queueObserver.syncConfig(await paciumConfig.inspect());
const application = createPaciumHttpServer(
  config,
  sessions,
  paciumConfig,
  queueObserver,
  claudeObserver,
  codexRuntimeBridge,
);

application.server.listen(config.port, config.host, () => {
  process.stdout.write(
    `Pacium Control is running at http://${config.host}:${config.port}\n`,
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stdout.write(`Received ${signal}; closing terminal sessions.\n`);
  sessions.shutdown();
  await sessions.flushRelaunchManifests();
  await application.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal).then(
      () => {
        process.exitCode = 0;
      },
      (error: unknown) => {
        process.stderr.write(
          `Pacium Control shutdown failed: ${
            error instanceof Error ? error.message : "unknown error"
          }\n`,
        );
        process.exitCode = 1;
      },
    );
  });
}
