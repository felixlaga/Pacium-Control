import { buildChildEnvironment, loadServerConfig } from "./config.js";
import { createPaciumHttpServer } from "./http-server.js";
import { createHostActions } from "./host-actions.js";
import { createPaciumConfigStore } from "./pacium-config-service.js";
import { NodePtyFactory } from "./pty-adapter.js";
import { SessionManager } from "./session-manager.js";
import { VerificationRunner } from "./verification-runner.js";

const config = loadServerConfig();
const verificationRunner = new VerificationRunner({
  environment: buildChildEnvironment(config.environmentKeys),
});
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
);
const paciumConfig = createPaciumConfigStore(config, sessions);
const application = createPaciumHttpServer(config, sessions, paciumConfig);

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
