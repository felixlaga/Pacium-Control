import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { TailscaleServeConfig } from "./config.js";

export const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'self'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

export function buildSecurityHeaders(
  tailscaleServe: TailscaleServeConfig | null,
): Readonly<Record<string, string>> {
  if (tailscaleServe === null) {
    return SECURITY_HEADERS;
  }
  return {
    ...SECURITY_HEADERS,
    "content-security-policy": `default-src 'self'; connect-src 'self' ws://127.0.0.1:* ws://localhost:* wss://${tailscaleServe.hostname}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
  };
}

export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  return origin !== undefined && allowedOrigins.has(origin);
}

export function isValidAccessToken(
  candidate: string | null | undefined,
  expected: string,
): boolean {
  if (candidate === null || candidate === undefined) {
    return false;
  }

  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export function isLoopbackHostHeader(host: string | undefined): boolean {
  if (host === undefined) {
    return false;
  }
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function canReadBootstrap(
  request: IncomingMessage,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!isLoopbackHostHeader(request.headers.host)) {
    return false;
  }

  const origin = request.headers.origin;
  if (origin !== undefined) {
    return isAllowedOrigin(origin, allowedOrigins);
  }

  const fetchSite = request.headers["sec-fetch-site"];
  return fetchSite === undefined || fetchSite === "same-origin";
}
