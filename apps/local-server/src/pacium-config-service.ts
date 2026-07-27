import type { ServerConfig } from "./config.js";
import {
  normalizePaciumWorkspace,
  validatePersistedPaciumWorkspace,
} from "./pacium-config-normalizer.js";
import { PaciumConfigStore } from "./pacium-config-store.js";
import type { SessionManager } from "./session-manager.js";

export function createPaciumConfigStore(
  config: ServerConfig,
  sessions: SessionManager,
): PaciumConfigStore {
  return new PaciumConfigStore(config.dataDirectory, {
    validateStoredWorkspace: (workspace) =>
      validatePersistedPaciumWorkspace(workspace, {
        dataDirectory: config.dataDirectory,
        launchPresetExists: (launchPreset) =>
          sessions.hasLaunchPreset(launchPreset),
        verificationCatalog: config.verificationCatalog,
      }),
    normalizeWorkspace: (workspace) =>
      normalizePaciumWorkspace(workspace, {
        dataDirectory: config.dataDirectory,
        sessionExists: (sessionId) => sessions.hasSession(sessionId),
        launchPresetExists: (launchPreset) =>
          sessions.hasLaunchPreset(launchPreset),
        verificationCatalog: config.verificationCatalog,
      }),
  });
}
