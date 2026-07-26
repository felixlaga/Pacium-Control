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

import type { ServerConfig } from "./config.js";
import {
  SECURITY_HEADERS,
  canReadBootstrap,
  isAllowedOrigin,
  isLoopbackHostHeader,
  isValidAccessToken,
} from "./security.js";
import type { SessionManager } from "./session-manager.js";
import { WebSocketHub } from "./ws-hub.js";

export interface PaciumHttpServer {
  server: Server;
  close(): Promise<void>;
}

export function createPaciumHttpServer(
  config: ServerConfig,
  sessions: SessionManager,
): PaciumHttpServer {
  const webRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  const hub = new WebSocketHub(config, sessions);
  const server = createServer((request, response) => {
    void routeRequest(request, response, config, webRoot);
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = parsePathname(request);
    const token = readWebSocketToken(request);
    const allowed =
      pathname === "/ws" &&
      isLoopbackHostHeader(request.headers.host) &&
      isAllowedOrigin(request.headers.origin, config.allowedOrigins) &&
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
): Promise<void> {
  applySecurityHeaders(response);

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const pathname = parsePathname(request);
  if (pathname === undefined) {
    sendJson(response, 400, { error: "Invalid request URL" });
    return;
  }

  if (pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" }, request.method === "HEAD");
    return;
  }

  if (pathname === "/api/bootstrap") {
    if (!canReadBootstrap(request, config.allowedOrigins)) {
      sendJson(response, 403, { error: "Forbidden" });
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

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found" });
    return;
  }

  await serveWebAsset(request, response, pathname, webRoot);
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
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    return undefined;
  }
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

function applySecurityHeaders(response: ServerResponse): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
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
