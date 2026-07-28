import { createReadStream, existsSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { PROTOCOL_VERSION } from "@pacium/contracts";

import type { ClaudeObserver } from "./claude-observer.js";
import type { CodexRuntimeBridge } from "./codex-runtime-bridge.js";
import type { ServerConfig } from "./config.js";
import {
  browseHostDirectories,
  DirectoryBrowserError,
} from "./directory-browser.js";
import { buildDiagnosticsSnapshot } from "./diagnostics.js";
import { presetCapabilities } from "./launch-presets.js";
import { buildSecurityHeaders, isValidAccessToken } from "./security.js";
import { classifyRequestAccess, type RequestAccess } from "./remote-access.js";
import type { PaciumConfigStore } from "./pacium-config-store.js";
import { QueueObserver } from "./queue-observer.js";
import type { SessionManager } from "./session-manager.js";
import { WebSocketHub } from "./ws-hub.js";

export interface PaciumHttpServer {
  server: Server;
  close(): Promise<void>;
}

export function createPaciumHttpServer(
  config: ServerConfig,
  sessions: SessionManager,
  paciumConfig: PaciumConfigStore,
  queueObserver: QueueObserver = new QueueObserver(),
  claudeObserver?: ClaudeObserver,
  codexRuntimeBridge?: CodexRuntimeBridge,
): PaciumHttpServer {
  const webRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  const hub = new WebSocketHub(config, sessions, paciumConfig, queueObserver);
  const server = createServer((request, response) => {
    void routeRequest(
      request,
      response,
      config,
      webRoot,
      sessions,
      queueObserver,
      claudeObserver,
    );
  });

  server.on("upgrade", (request, socket, head) => {
    if (
      codexRuntimeBridge?.handleUpgrade(request, socket, head, config.port) ===
      true
    ) {
      return;
    }
    const pathname = parsePathname(request);
    const token = readWebSocketToken(request);
    const access = classifyRequestAccess(request, config, "websocket");
    const allowed =
      pathname === "/ws" &&
      access !== null &&
      isValidAccessToken(token, config.accessToken) &&
      hasProtocol(request, "pacium.v1");

    if (!allowed) {
      socket.write(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
      );
      socket.destroy();
      return;
    }

    hub.server.handleUpgrade(request, socket, head, (webSocket) => {
      hub.server.emit("connection", webSocket, request);
    });
  });

  return {
    server,
    async close() {
      hub.dispose();
      queueObserver.dispose();
      codexRuntimeBridge?.dispose();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    },
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: ServerConfig,
  webRoot: string,
  sessions: SessionManager,
  queueObserver: QueueObserver,
  claudeObserver: ClaudeObserver | undefined,
): Promise<void> {
  applySecurityHeaders(response, config);

  const requestUrl = parseRequestUrl(request);
  if (requestUrl === undefined) {
    sendJson(response, 400, { error: "Invalid request URL" });
    return;
  }
  const { pathname } = requestUrl;

  if (pathname === "/api/health") {
    if (!isReadMethod(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (classifyRequestAccess(request, config, "navigation") === null) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }
    response.setHeader("x-pacium-protocol", String(PROTOCOL_VERSION));
    sendJson(response, 200, { status: "ok" }, request.method === "HEAD");
    return;
  }

  if (pathname === "/api/bootstrap") {
    const access = classifyRequestAccess(request, config, "bootstrap");
    if (access === null) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }
    if (!isAllowedBootstrapMethod(request.method, access)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (request.method === "POST" && !hasEmptyRequestBody(request)) {
      sendJson(response, 400, { error: "Bootstrap body is not allowed" });
      return;
    }
    sendJson(
      response,
      200,
      {
        protocolVersion: PROTOCOL_VERSION,
        accessToken: config.accessToken,
        webSocketPath: "/ws",
      },
      request.method === "HEAD",
    );
    return;
  }

  if (pathname === "/api/directories") {
    const access = authorizeProtectedApi(request, config);
    if (access === null) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }
    if (!isAllowedProtectedReadMethod(request.method, access)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (request.method === "POST" && !hasEmptyRequestBody(request)) {
      sendJson(response, 400, { error: "Request body is not allowed" });
      return;
    }
    try {
      const requestedPath = requestUrl.searchParams.get("path");
      const listing = await browseHostDirectories({
        defaultPath: config.defaultCwd,
        homePath: config.homeDirectory,
        ...(requestedPath === null ? {} : { requestedPath }),
      });
      sendJson(response, 200, listing, request.method === "HEAD");
    } catch (error) {
      if (error instanceof DirectoryBrowserError) {
        sendJson(response, 400, {
          code: error.code,
          error: error.message,
        });
      } else {
        sendJson(response, 500, {
          error: "Pacium could not inspect that host directory.",
        });
      }
    }
    return;
  }

  if (pathname === "/api/diagnostics") {
    response.setHeader("cache-control", "no-store");
    const access = authorizeProtectedApi(request, config);
    if (access === null) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }
    if (!isAllowedProtectedReadMethod(request.method, access)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (request.method === "POST" && !hasEmptyRequestBody(request)) {
      sendJson(response, 400, { error: "Request body is not allowed" });
      return;
    }
    try {
      const snapshot = buildDiagnosticsSnapshot({
        sessions: sessions.list(),
        queue: queueObserver.snapshot(),
        tmux: sessions.tmuxCapability(),
        launchPresets: presetCapabilities(config.launchPresets),
      });
      sendJson(response, 200, snapshot, request.method === "HEAD");
    } catch {
      sendJson(response, 500, {
        error: "Pacium could not construct bounded diagnostics.",
      });
    }
    return;
  }

  const claudeIngress = parseClaudeIngressPath(pathname);
  if (claudeIngress !== null) {
    await receiveClaudeObservation(
      request,
      response,
      config,
      claudeObserver,
      claudeIngress,
    );
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (!isReadMethod(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    sendJson(response, 404, { error: "API route not found" });
    return;
  }

  if (!isReadMethod(request.method)) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }
  if (classifyRequestAccess(request, config, "navigation") === null) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  await serveWebAsset(request, response, pathname, webRoot);
}

const MAX_CLAUDE_INGRESS_BYTES = 64 * 1024;
const CLAUDE_INGRESS_PATH =
  /^\/api\/provider\/claude\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(hook|status)$/;

interface ClaudeIngressTarget {
  sessionId: string;
  kind: "hook" | "status";
}

function parseClaudeIngressPath(pathname: string): ClaudeIngressTarget | null {
  const match = CLAUDE_INGRESS_PATH.exec(pathname);
  if (match === null) {
    return null;
  }
  const sessionId = match[1];
  const kind = match[2];
  return sessionId !== undefined && (kind === "hook" || kind === "status")
    ? { sessionId, kind }
    : null;
}

async function receiveClaudeObservation(
  request: IncomingMessage,
  response: ServerResponse,
  config: ServerConfig,
  observer: ClaudeObserver | undefined,
  target: ClaudeIngressTarget,
): Promise<void> {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") {
    request.resume();
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }
  if (
    request.headers.host !== `127.0.0.1:${config.port}` ||
    request.headers.origin !== undefined
  ) {
    request.resume();
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  if (request.headers["content-type"] !== "application/json") {
    request.resume();
    sendJson(response, 415, { error: "JSON content type required" });
    return;
  }
  const token = readProviderBearerToken(request);
  if (token === null || observer === undefined) {
    request.resume();
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  const body = await readBoundedJson(request, MAX_CLAUDE_INGRESS_BYTES);
  if (body.status !== "ready") {
    sendJson(response, body.status === "too_large" ? 413 : 400, {
      error:
        body.status === "too_large"
          ? "Provider payload too large"
          : "Invalid provider payload",
    });
    return;
  }
  const result =
    target.kind === "hook"
      ? observer.ingestHook(target.sessionId, token, body.value)
      : observer.ingestStatus(target.sessionId, token, body.value);
  if (result.status === "accepted" || result.status === "duplicate") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (result.code === "unknown_session" || result.code === "invalid_token") {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  sendJson(response, 400, { error: "Invalid provider observation" });
}

function readProviderBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (
    authorization === undefined ||
    Array.isArray(authorization) ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }
  const token = authorization.slice("Bearer ".length);
  return token.length >= 32 &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token)
    ? token
    : null;
}

async function readBoundedJson(
  request: IncomingMessage,
  maxBytes: number,
): Promise<
  { status: "ready"; value: unknown } | { status: "too_large" | "invalid" }
> {
  const declaredLength = request.headers["content-length"];
  if (
    declaredLength !== undefined &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)
  ) {
    request.resume();
    return { status: "too_large" };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      request.resume();
      return { status: "too_large" };
    }
    chunks.push(bytes);
  }
  try {
    return {
      status: "ready",
      value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
    };
  } catch {
    return { status: "invalid" };
  }
}

async function serveWebAsset(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  webRoot: string,
): Promise<void> {
  if (!existsSync(webRoot)) {
    sendJson(response, 404, {
      error: "Web application is not built. Run the development server.",
    });
    return;
  }

  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const normalized = normalize(requested);
  if (
    normalized.startsWith("..") ||
    normalized.includes("\0") ||
    normalized.startsWith("/")
  ) {
    sendJson(response, 400, { error: "Invalid asset path" });
    return;
  }

  let assetPath = join(webRoot, normalized);
  try {
    const info = await stat(assetPath);
    if (!info.isFile()) {
      assetPath = join(webRoot, "index.html");
    }
  } catch {
    assetPath = join(webRoot, "index.html");
  }

  try {
    await access(assetPath);
    const type =
      CONTENT_TYPES[extname(assetPath)] ?? "application/octet-stream";
    response.statusCode = 200;
    response.setHeader("content-type", type);
    if (assetPath.endsWith("index.html")) {
      response.setHeader("cache-control", "no-store");
    } else {
      response.setHeader(
        "cache-control",
        "public, max-age=31536000, immutable",
      );
    }
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(assetPath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Asset not found" });
  }
}

function parsePathname(request: IncomingMessage): string | undefined {
  return parseRequestUrl(request)?.pathname;
}

function parseRequestUrl(request: IncomingMessage): URL | undefined {
  try {
    return new URL(request.url ?? "/", "http://localhost");
  } catch {
    return undefined;
  }
}

function authorizeProtectedApi(
  request: IncomingMessage,
  config: ServerConfig,
): RequestAccess | null {
  const access = classifyRequestAccess(request, config, "protected");
  if (
    access === null ||
    !isValidAccessToken(
      readBearerToken(request.headers.authorization),
      config.accessToken,
    )
  ) {
    return null;
  }
  return access;
}

function readBearerToken(value: string | undefined): string | undefined {
  const prefix = "Bearer ";
  return value?.startsWith(prefix) ? value.slice(prefix.length) : undefined;
}

function hasProtocol(request: IncomingMessage, protocol: string): boolean {
  return readProtocols(request).includes(protocol);
}

function readWebSocketToken(request: IncomingMessage): string | undefined {
  const prefix = "pacium.token.";
  const protocol = readProtocols(request).find((value) =>
    value.startsWith(prefix),
  );
  return protocol?.slice(prefix.length);
}

function readProtocols(request: IncomingMessage): string[] {
  const value = request.headers["sec-websocket-protocol"];
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((protocol) => protocol.trim())
    .filter(Boolean);
}

function isReadMethod(method: string | undefined): boolean {
  return method === "GET" || method === "HEAD";
}

function isAllowedBootstrapMethod(
  method: string | undefined,
  access: RequestAccess,
): boolean {
  return access.kind === "local" ? isReadMethod(method) : method === "POST";
}

function isAllowedProtectedReadMethod(
  method: string | undefined,
  access: RequestAccess,
): boolean {
  return access.kind === "local" ? isReadMethod(method) : method === "POST";
}

function hasEmptyRequestBody(request: IncomingMessage): boolean {
  const contentLength = request.headers["content-length"];
  return (
    (contentLength === undefined || contentLength === "0") &&
    request.headers["transfer-encoding"] === undefined
  );
}

function applySecurityHeaders(
  response: ServerResponse,
  config: ServerConfig,
): void {
  for (const [name, value] of Object.entries(
    buildSecurityHeaders(config.tailscaleServe),
  )) {
    response.setHeader(name, value);
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headersOnly = false,
): void {
  const serialized = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(serialized));
  response.end(headersOnly ? undefined : serialized);
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
