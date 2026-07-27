import { existsSync, realpathSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, parse } from "node:path";

import { z } from "zod";

import {
  buildLaunchPresetDefinitions,
  type LaunchPresetDefinition,
} from "./launch-presets.js";
import {
  loadVerificationCatalog,
  type VerificationCatalog,
} from "./verification-config.js";

const LoopbackHostSchema = z.literal("127.0.0.1");
const PortSchema = z.coerce.number().int().min(1024).max(65_535);

export interface ServerConfig {
  host: "127.0.0.1";
  port: number;
  allowedOrigins: ReadonlySet<string>;
  accessToken: string;
  serverId: string;
  defaultCwd: string;
  homeDirectory: string;
  dataDirectory: string;
  shell: string;
  environmentKeys: readonly string[];
  launchPresets: readonly LaunchPresetDefinition[];
  verificationCatalog: VerificationCatalog;
}

const DEFAULT_ENVIRONMENT_KEYS = [
  "HOME",
  "PATH",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "COLORTERM",
] as const;

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const host = LoopbackHostSchema.parse(environment.PACIUM_HOST ?? "127.0.0.1");
  const port = PortSchema.parse(environment.PACIUM_PORT ?? 4174);
  const defaultCwd = realpathSync(
    environment.PACIUM_DEFAULT_CWD ?? process.cwd(),
  );
  const homeDirectory = realpathSync(environment.HOME ?? homedir());
  const dataDirectory = resolvePaciumDataDirectory(
    environment.PACIUM_DATA_DIR,
    homeDirectory,
  );
  const shell = environment.SHELL ?? "/bin/zsh";

  if (!shell.startsWith("/") || !existsSync(shell)) {
    throw new Error(
      `Configured shell is not an existing absolute path: ${shell}`,
    );
  }

  const configuredOrigins = environment.PACIUM_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const allowedOrigins = new Set(
    configuredOrigins ?? [
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ],
  );

  const extraEnvironmentKeys =
    environment.PACIUM_ENV_ALLOWLIST?.split(",")
      .map((key) => key.trim())
      .filter((key) => /^[A-Z_][A-Z0-9_]*$/.test(key)) ?? [];

  return {
    host,
    port,
    allowedOrigins,
    accessToken: randomBytes(32).toString("base64url"),
    serverId: randomUUID(),
    defaultCwd,
    homeDirectory,
    dataDirectory,
    shell,
    environmentKeys: [
      ...new Set([...DEFAULT_ENVIRONMENT_KEYS, ...extraEnvironmentKeys]),
    ],
    launchPresets: buildLaunchPresetDefinitions(shell, environment),
    verificationCatalog: loadVerificationCatalog(
      environment.PACIUM_VERIFICATION_CONFIG,
    ),
  };
}

export function resolvePaciumDataDirectory(
  configuredPath: string | undefined,
  homeDirectory: string,
): string {
  const candidate =
    configuredPath ??
    join(homeDirectory, "Library", "Application Support", "Pacium Control");
  if (
    !isAbsolute(candidate) ||
    candidate.length > 4096 ||
    hasControlCharacter(candidate)
  ) {
    throw new Error(
      "PACIUM_DATA_DIR must be a bounded absolute path without controls.",
    );
  }
  const resolved = normalize(candidate);
  if (resolved === parse(resolved).root || resolved === homeDirectory) {
    throw new Error("PACIUM_DATA_DIR must name a dedicated child directory.");
  }
  return resolved;
}

export function buildChildEnvironment(
  environmentKeys: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const childEnvironment: Record<string, string> = {
    TERM: "xterm-256color",
    PACIUM_SESSION: "1",
  };

  for (const key of environmentKeys) {
    const value = environment[key];
    if (value !== undefined) {
      childEnvironment[key] = value;
    }
  }

  return childEnvironment;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}
