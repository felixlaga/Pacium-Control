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
const MAX_TAILSCALE_ORIGIN_BYTES = 2_048;
const MAX_TAILSCALE_OPERATOR_LOGINS = 32;
const MAX_TAILSCALE_LOGIN_BYTES = 254;

export interface TailscaleServeConfig {
  origin: string;
  hostname: string;
  operatorLogins: ReadonlySet<string>;
}

export interface ServerConfig {
  host: "127.0.0.1";
  port: number;
  allowedOrigins: ReadonlySet<string>;
  tailscaleServe: TailscaleServeConfig | null;
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

  const tailscaleServe = loadTailscaleServeConfig(environment);
  const allowedOrigins = new Set([
    ...(configuredOrigins ?? [
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ]),
    ...(tailscaleServe === null ? [] : [tailscaleServe.origin]),
  ]);

  const extraEnvironmentKeys =
    environment.PACIUM_ENV_ALLOWLIST?.split(",")
      .map((key) => key.trim())
      .filter((key) => /^[A-Z_][A-Z0-9_]*$/.test(key)) ?? [];

  return {
    host,
    port,
    allowedOrigins,
    tailscaleServe,
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

export function loadTailscaleServeConfig(
  environment: NodeJS.ProcessEnv,
): TailscaleServeConfig | null {
  const originValue = environment.PACIUM_TAILSCALE_ORIGIN;
  const loginsValue = environment.PACIUM_TAILSCALE_OPERATOR_LOGINS;

  if (originValue === undefined && loginsValue === undefined) {
    return null;
  }
  if (originValue === undefined || loginsValue === undefined) {
    throw new Error(
      "PACIUM_TAILSCALE_ORIGIN and PACIUM_TAILSCALE_OPERATOR_LOGINS must be configured together.",
    );
  }

  if (
    Buffer.byteLength(originValue) > MAX_TAILSCALE_ORIGIN_BYTES ||
    hasControlCharacter(originValue)
  ) {
    throw new Error(
      "PACIUM_TAILSCALE_ORIGIN must be a bounded canonical HTTPS origin.",
    );
  }

  let origin: URL;
  try {
    origin = new URL(originValue);
  } catch {
    throw new Error(
      "PACIUM_TAILSCALE_ORIGIN must be a bounded canonical HTTPS origin.",
    );
  }
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.port !== "" ||
    origin.hostname !== origin.hostname.toLowerCase() ||
    !origin.hostname.endsWith(".ts.net") ||
    originValue !== origin.origin
  ) {
    throw new Error(
      "PACIUM_TAILSCALE_ORIGIN must be a canonical https://<node>.<tailnet>.ts.net origin without a port or path.",
    );
  }

  const operatorLogins = loginsValue.split(",").map((login) => login.trim());
  if (
    operatorLogins.length === 0 ||
    operatorLogins.length > MAX_TAILSCALE_OPERATOR_LOGINS ||
    operatorLogins.some((login) => !isValidTailscaleLogin(login)) ||
    new Set(operatorLogins).size !== operatorLogins.length
  ) {
    throw new Error(
      "PACIUM_TAILSCALE_OPERATOR_LOGINS must contain 1 to 32 unique bounded exact ASCII logins.",
    );
  }

  return {
    origin: origin.origin,
    hostname: origin.hostname,
    operatorLogins: new Set(operatorLogins),
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

function isValidTailscaleLogin(value: string): boolean {
  const separator = value.indexOf("@");
  return (
    value.length > 0 &&
    Buffer.byteLength(value) <= MAX_TAILSCALE_LOGIN_BYTES &&
    /^[\x21-\x2b\x2d-\x7e]+$/.test(value) &&
    separator > 0 &&
    separator === value.lastIndexOf("@") &&
    separator < value.length - 1
  );
}
