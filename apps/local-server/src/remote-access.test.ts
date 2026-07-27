import type { IncomingMessage } from "node:http";

import { describe, expect, it } from "vitest";

import type { ServerConfig } from "./config.js";
import {
  classifyRequestAccess,
  readTailscaleLogin,
  type RequestPurpose,
} from "./remote-access.js";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const REMOTE_ORIGIN = "https://pacium-host.example-tailnet.ts.net";
const REMOTE_HOST = "pacium-host.example-tailnet.ts.net";
const ALLOWED_LOGIN = "owner@example.com";
const config: Pick<ServerConfig, "allowedOrigins" | "tailscaleServe"> = {
  allowedOrigins: new Set([LOCAL_ORIGIN]),
  tailscaleServe: {
    origin: REMOTE_ORIGIN,
    hostname: REMOTE_HOST,
    operatorLogins: new Set([ALLOWED_LOGIN]),
  },
};

describe("request access classification", () => {
  it("preserves local navigation and protected request rules", () => {
    expect(
      classify(
        {
          host: "127.0.0.1:4174",
          "sec-fetch-site": "none",
        },
        "navigation",
      ),
    ).toEqual({ kind: "local" });
    expect(
      classify(
        {
          host: "localhost:4174",
          origin: LOCAL_ORIGIN,
        },
        "protected",
      ),
    ).toEqual({ kind: "local" });
    expect(
      classify(
        {
          host: "127.0.0.1:4174",
          origin: "https://hostile.example",
        },
        "bootstrap",
      ),
    ).toBeNull();
    expect(
      classify(
        {
          host: "127.0.0.1:4174",
        },
        "websocket",
      ),
    ).toBeNull();
  });

  it("never promotes a loopback request from Tailscale-looking headers", () => {
    expect(
      classify(
        {
          host: "127.0.0.1:4174",
          origin: LOCAL_ORIGIN,
          "tailscale-user-login": ALLOWED_LOGIN,
          "tailscale-user-name": "Forged Operator",
        },
        "websocket",
      ),
    ).toEqual({ kind: "local" });
    expect(
      classify(
        {
          host: "127.0.0.1:4174",
          origin: REMOTE_ORIGIN,
          "tailscale-user-login": ALLOWED_LOGIN,
        },
        "websocket",
      ),
    ).toBeNull();
  });

  it("accepts exact allowlisted Serve navigation and socket authority", () => {
    expect(
      classify(
        {
          host: REMOTE_HOST,
          "sec-fetch-site": "none",
          "tailscale-user-login": ALLOWED_LOGIN,
        },
        "navigation",
      ),
    ).toEqual({ kind: "tailscale", login: ALLOWED_LOGIN });
    expect(
      classify(
        {
          host: REMOTE_HOST,
          origin: REMOTE_ORIGIN,
          "sec-fetch-site": "same-origin",
          "tailscale-user-login": ALLOWED_LOGIN,
        },
        "websocket",
      ),
    ).toEqual({ kind: "tailscale", login: ALLOWED_LOGIN });
  });

  it("requires the exact remote Host and Origin for protected authority", () => {
    const base = {
      host: REMOTE_HOST,
      origin: REMOTE_ORIGIN,
      "tailscale-user-login": ALLOWED_LOGIN,
    };
    expect(classify(base, "bootstrap")).toEqual({
      kind: "tailscale",
      login: ALLOWED_LOGIN,
    });
    expect(
      classify({ ...base, host: `${REMOTE_HOST}:443` }, "bootstrap"),
    ).toBeNull();
    expect(
      classify({ ...base, host: `other.${REMOTE_HOST}` }, "bootstrap"),
    ).toBeNull();
    expect(
      classify({ ...base, origin: "https://hostile.example" }, "bootstrap"),
    ).toBeNull();
    expect(
      classify({ ...base, "sec-fetch-site": "cross-site" }, "protected"),
    ).toBeNull();
  });

  it("denies missing, tagged-device-only, duplicate, and unlisted identity", () => {
    const base = {
      host: REMOTE_HOST,
      origin: REMOTE_ORIGIN,
    };
    expect(classify(base, "protected")).toBeNull();
    expect(
      classify(
        {
          ...base,
          "tailscale-app-capabilities": '{"example/cap":[]}',
        },
        "protected",
      ),
    ).toBeNull();
    expect(
      classify(
        { ...base, "tailscale-user-login": "other@example.com" },
        "protected",
      ),
    ).toBeNull();
    expect(
      classify(
        {
          ...base,
          "tailscale-user-login": "owner@example.com, other@example.com",
        },
        "protected",
      ),
    ).toBeNull();
    expect(
      classify(
        {
          ...base,
          "tailscale-user-login": ["owner@example.com", "other@example.com"],
        },
        "protected",
      ),
    ).toBeNull();
    expect(
      classify(
        {
          ...base,
          "tailscale-user-login": ALLOWED_LOGIN,
          "tailscale-funnel-request": "?1",
        },
        "protected",
      ),
    ).toBeNull();
  });

  it("does not trust remote-shaped traffic when remote mode is disabled", () => {
    expect(
      classifyRequestAccess(
        request({
          host: REMOTE_HOST,
          origin: REMOTE_ORIGIN,
          "tailscale-user-login": ALLOWED_LOGIN,
        }),
        {
          allowedOrigins: config.allowedOrigins,
          tailscaleServe: null,
        },
        "websocket",
      ),
    ).toBeNull();
  });
});

describe("Serve login extraction", () => {
  it("accepts only one bounded visible ASCII header value", () => {
    expect(
      readTailscaleLogin(request({ "tailscale-user-login": ALLOWED_LOGIN })),
    ).toBe(ALLOWED_LOGIN);

    for (const value of [
      "",
      "owner@example.com, other@example.com",
      "owner example@example.com",
      "owñer@example.com",
      "a".repeat(255),
    ]) {
      expect(
        readTailscaleLogin(request({ "tailscale-user-login": value })),
      ).toBeNull();
    }
  });
});

function classify(
  headers: IncomingMessage["headers"],
  purpose: RequestPurpose,
) {
  return classifyRequestAccess(request(headers), config, purpose);
}

function request(headers: IncomingMessage["headers"]): IncomingMessage {
  return { headers } as IncomingMessage;
}
