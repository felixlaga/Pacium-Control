import type { IncomingMessage } from "node:http";

import type { ServerConfig } from "./config.js";
import { isAllowedOrigin, isLoopbackHostHeader } from "./security.js";

export type RequestAccess =
  { kind: "local" } | { kind: "tailscale"; login: string };

export type RequestPurpose =
  "navigation" | "bootstrap" | "protected" | "websocket";

type AccessConfig = Pick<ServerConfig, "allowedOrigins" | "tailscaleServe">;

export function classifyRequestAccess(
  request: IncomingMessage,
  config: AccessConfig,
  purpose: RequestPurpose,
): RequestAccess | null {
  if (isLoopbackHostHeader(request.headers.host)) {
    return hasLocalBrowserAuthority(request, config.allowedOrigins, purpose)
      ? { kind: "local" }
      : null;
  }

  const tailscale = config.tailscaleServe;
  if (
    tailscale === null ||
    request.headers.host !== tailscale.hostname ||
    request.headers["tailscale-funnel-request"] !== undefined ||
    !hasRemoteBrowserAuthority(request, tailscale.origin, purpose)
  ) {
    return null;
  }

  const login = readTailscaleLogin(request);
  if (login === null || !tailscale.operatorLogins.has(login)) {
    return null;
  }
  return { kind: "tailscale", login };
}

export function readTailscaleLogin(request: IncomingMessage): string | null {
  const value = request.headers["tailscale-user-login"];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value) > 254 ||
    value.includes(",") ||
    !/^[\x21-\x2b\x2d-\x7e]+$/.test(value)
  ) {
    return null;
  }
  return value;
}

function hasLocalBrowserAuthority(
  request: IncomingMessage,
  allowedOrigins: ReadonlySet<string>,
  purpose: RequestPurpose,
): boolean {
  const origin = readSingleHeader(request.headers.origin);
  if (purpose === "websocket") {
    return isAllowedOrigin(origin, allowedOrigins);
  }
  if (origin !== undefined) {
    return isAllowedOrigin(origin, allowedOrigins);
  }

  const fetchSite = readSingleHeader(request.headers["sec-fetch-site"]);
  if (purpose === "navigation") {
    return (
      fetchSite === undefined ||
      fetchSite === "none" ||
      fetchSite === "same-origin"
    );
  }
  return fetchSite === undefined || fetchSite === "same-origin";
}

function hasRemoteBrowserAuthority(
  request: IncomingMessage,
  origin: string,
  purpose: RequestPurpose,
): boolean {
  const requestOrigin = readSingleHeader(request.headers.origin);
  const fetchSite = readSingleHeader(request.headers["sec-fetch-site"]);
  if (purpose === "navigation") {
    if (requestOrigin !== undefined && requestOrigin !== origin) {
      return false;
    }
    return (
      fetchSite === undefined ||
      fetchSite === "none" ||
      fetchSite === "same-origin"
    );
  }
  return (
    requestOrigin === origin &&
    (fetchSite === undefined || fetchSite === "same-origin")
  );
}

function readSingleHeader(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
