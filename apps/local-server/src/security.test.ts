import { describe, expect, it } from "vitest";

import {
  buildSecurityHeaders,
  canReadBootstrap,
  isAllowedOrigin,
  isLoopbackHostHeader,
  isValidAccessToken,
} from "./security.js";

describe("local transport security", () => {
  const origins = new Set(["http://127.0.0.1:4173"]);

  it("accepts only configured browser origins", () => {
    expect(isAllowedOrigin("http://127.0.0.1:4173", origins)).toBe(true);
    expect(isAllowedOrigin("https://hostile.example", origins)).toBe(false);
    expect(isAllowedOrigin(undefined, origins)).toBe(false);
  });

  it("compares the full local access token", () => {
    expect(isValidAccessToken("expected-token", "expected-token")).toBe(true);
    expect(isValidAccessToken("expected-toke_", "expected-token")).toBe(false);
    expect(isValidAccessToken(undefined, "expected-token")).toBe(false);
  });

  it("accepts only loopback host headers", () => {
    expect(isLoopbackHostHeader("127.0.0.1:4174")).toBe(true);
    expect(isLoopbackHostHeader("localhost:4174")).toBe(true);
    expect(isLoopbackHostHeader("192.168.1.8:4174")).toBe(false);
  });

  it("denies cross-site bootstrap requests", () => {
    expect(
      canReadBootstrap(
        {
          headers: {
            host: "127.0.0.1:4174",
            origin: "https://hostile.example",
            "sec-fetch-site": "cross-site",
          },
        } as never,
        origins,
      ),
    ).toBe(false);
  });

  it("allows only the configured Serve WebSocket in remote CSP", () => {
    const local = buildSecurityHeaders(null)["content-security-policy"];
    expect(local).not.toContain("wss://");

    const remote = buildSecurityHeaders({
      origin: "https://pacium-host.example-tailnet.ts.net",
      hostname: "pacium-host.example-tailnet.ts.net",
      operatorLogins: new Set(["owner@example.com"]),
    })["content-security-policy"];
    expect(remote).toContain("wss://pacium-host.example-tailnet.ts.net");
    expect(remote).not.toContain(" wss:;");
    expect(remote).not.toContain("https://hostile.example");
  });
});
