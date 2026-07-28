import { buildChildEnvironment, loadServerConfig } from "./config.js";
import { openPaciumBrowser } from "./browser-launch.js";
import { ClaudeObserver, detectClaudeVersion } from "./claude-observer.js";
import { CodexObserver, detectCodexRuntime } from "./codex-observer.js";
import { CodexRuntimeBridge } from "./codex-runtime-bridge.js";
import { createPaciumHttpServer } from "./http-server.js";
import { HostSetupService } from "./host-setup-service.js";
import { HostSetupStore } from "./host-setup-store.js";
import { createHostActions } from "./host-actions.js";
import { createPaciumConfigStore } from "./pacium-config-service.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { QueueObserver } from "./queue-observer.js";
import { RelaunchManifestStore } from "./relaunch-manifest-store.js";
import { SessionManager } from "./session-manager.js";
import {
  createTmuxAdapter,
  discoverDefaultTmuxSocket,
} from "./tmux-adapter.js";
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
if (config.tmuxSocket === null) {
  config.tmuxSocket = await discoverDefaultTmuxSocket(childEnvironment);
}
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
const tmuxRestore = await sessions.restoreKeepAliveSessions();
if (tmuxRestore.attempted > 0 || tmuxRestore.deferred > 0) {
  console.info(
    `Pacium tmux keep-alive recovery: ${tmuxRestore.restored} restored, ${tmuxRestore.unavailable} unavailable, ${tmuxRestore.deferred} deferred.`,
  );
}
const metaSession = await sessions.attachConfiguredMetaTmux(
  config.metaTmuxSessionName,
);
if (metaSession.state !== "unconfigured") {
  console.info(`Pacium Meta tmux startup: ${metaSession.state}.`);
}
const paciumConfig = createPaciumConfigStore(config, sessions);
const hostSetup = new HostSetupService(
  config,
  sessions,
  new HostSetupStore(config.dataDirectory),
  childEnvironment,
);
const queueObserver = new QueueObserver();
await queueObserver.syncConfig(await paciumConfig.inspect());
const application = createPaciumHttpServer(
  config,
  sessions,
  paciumConfig,
  queueObserver,
  claudeObserver,
  codexRuntimeBridge,
  hostSetup,
);

application.server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  process.stdout.write(`Pacium Control is running at ${url}\n`);
  if (process.env.PACIUM_OPEN_BROWSER === "1") {
    void openPaciumBrowser(url).then((opened) => {
      if (!opened) {
        process.stderr.write(
          `Pacium Control is running at ${url}, but its browser window could not be opened.\n`,
        );
      }
    });
  }
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stdout.write(`Received ${signal}; closing terminal sessions.\n`);
  await sessions.shutdown();
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
