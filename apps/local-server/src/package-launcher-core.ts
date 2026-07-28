import { PROTOCOL_VERSION } from "@pacium/contracts";

const SUPPORTED_NODE_VERSION = /^24\.18\.\d+$/;
const FINDER_PROCESS_SERIAL = /^-psn_\d+_\d+$/;
const PROBE_TIMEOUT_MS = 750;

export interface PackageLaunchOptions {
  command: "run" | "help" | "version";
  openBrowser: boolean;
}

export function parsePackageLaunchArguments(
  arguments_: readonly string[],
): PackageLaunchOptions {
  let command: PackageLaunchOptions["command"] = "run";
  let openBrowser = true;

  for (const argument of arguments_) {
    if (FINDER_PROCESS_SERIAL.test(argument)) {
      continue;
    }
    if (argument === "--no-open") {
      openBrowser = false;
      continue;
    }
    if (argument === "--help") {
      command = selectCommand(command, "help");
      continue;
    }
    if (argument === "--version") {
      command = selectCommand(command, "version");
      continue;
    }
    throw new Error(`Unsupported Pacium Control option: ${argument}`);
  }

  return { command, openBrowser };
}

export function assertSupportedPackageRuntime(
  platform: NodeJS.Platform,
  architecture: string,
  nodeVersion: string,
): void {
  if (platform !== "darwin" || architecture !== "arm64") {
    throw new Error(
      "Pacium Control requires Apple-silicon macOS (darwin-arm64).",
    );
  }
  if (!SUPPORTED_NODE_VERSION.test(nodeVersion)) {
    throw new Error("Pacium Control requires Node.js 24.18.x.");
  }
}

export function resolvePackagePort(value: string | undefined): number {
  const candidate = value ?? "4174";
  if (!/^[1-9]\d{3,4}$/.test(candidate)) {
    throw new Error("PACIUM_PORT must be an integer from 1024 through 65535.");
  }
  const port = Number(candidate);
  if (port < 1_024 || port > 65_535) {
    throw new Error("PACIUM_PORT must be an integer from 1024 through 65535.");
  }
  return port;
}

export function packageServerUrl(port: number): string {
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("Pacium Control received an invalid package port.");
  }
  return `http://127.0.0.1:${port}`;
}

export async function probePaciumServer(
  url: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImplementation(`${url}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (
      response.status !== 200 ||
      response.headers.get("x-pacium-protocol") !== String(PROTOCOL_VERSION)
    ) {
      return false;
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.split(";")[0]?.trim() !== "application/json") {
      return false;
    }
    const body: unknown = await response.json();
    return (
      typeof body === "object" &&
      body !== null &&
      Object.keys(body).length === 1 &&
      "status" in body &&
      body.status === "ok"
    );
  } catch {
    return false;
  }
}

function selectCommand(
  current: PackageLaunchOptions["command"],
  next: Exclude<PackageLaunchOptions["command"], "run">,
): PackageLaunchOptions["command"] {
  if (current !== "run" && current !== next) {
    throw new Error("--help and --version cannot be combined.");
  }
  return next;
}
