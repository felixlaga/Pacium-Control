import { describe, expect, it } from "vitest";

import {
  INITIAL_TAILSCALE_URL_SCAN,
  scanForTailscaleLoginUrl,
} from "./tailscale-login-model.js";

describe("scanForTailscaleLoginUrl", () => {
  it("finds a URL delivered in a single chunk", () => {
    const { scan, url } = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "To authenticate, visit:\n\n\thttps://login.tailscale.com/a/abc123def\n\n",
    );

    expect(url).toBe("https://login.tailscale.com/a/abc123def");
    expect(scan.carry).not.toContain("login.tailscale.com");
  });

  it("finds a URL split across two chunks", () => {
    const first = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "visit https://login.tailsc",
    );
    expect(first.url).toBeNull();

    const second = scanForTailscaleLoginUrl(
      first.scan,
      "ale.com/a/abc123 to continue\n",
    );
    expect(second.url).toBe("https://login.tailscale.com/a/abc123");
    expect(second.scan.carry).toContain("to continue");
  });

  it("extracts a URL wrapped in ANSI color sequences", () => {
    const { url } = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "\u001b[1m\u001b[32mhttps://login.tailscale.com/a/abc123\u001b[0m\r\n",
    );

    expect(url).toBe("https://login.tailscale.com/a/abc123");
  });

  it("survives an ANSI sequence split across chunks", () => {
    const first = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "\u001b[3",
    );
    const second = scanForTailscaleLoginUrl(
      first.scan,
      "2mhttps://login.tailscale.com/a/split99\u001b[0m ",
    );

    expect(second.url).toBe("https://login.tailscale.com/a/split99");
  });

  it("rejects lookalike hosts", () => {
    const { url } = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "https://login.tailscale.com.evil.com/a/abc123\n",
    );

    expect(url).toBeNull();
  });

  it("rejects oversized URLs instead of returning them", () => {
    const { url } = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      `https://login.tailscale.com/a/${"b".repeat(2_100)}\n`,
    );

    expect(url).toBeNull();
  });

  it("keeps the carry bounded to 512 characters while unmatched", () => {
    let scan = INITIAL_TAILSCALE_URL_SCAN;
    for (let round = 0; round < 5; round += 1) {
      const result = scanForTailscaleLoginUrl(scan, "x".repeat(400));
      expect(result.url).toBeNull();
      scan = result.scan;
    }

    expect(scan.carry.length).toBe(512);
  });

  it("returns only the first URL per call and keeps the rest in carry", () => {
    const first = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "https://login.tailscale.com/a/one https://login.tailscale.com/a/two\n",
    );
    expect(first.url).toBe("https://login.tailscale.com/a/one");

    const second = scanForTailscaleLoginUrl(first.scan, "");
    expect(second.url).toBe("https://login.tailscale.com/a/two");
  });

  it("keeps control characters as URL boundaries", () => {
    const { url } = scanForTailscaleLoginUrl(
      INITIAL_TAILSCALE_URL_SCAN,
      "https://login.tailscale.com/a/clean\nnot-part-of-the-url",
    );

    expect(url).toBe("https://login.tailscale.com/a/clean");
  });
});
