import { realpathSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildChildEnvironment,
  loadServerConfig,
  loadTailscaleServeConfig,
  resolvePaciumDataDirectory,
} from "./config.js";

describe("local server configuration", () => {
  it("fails closed when a non-loopback host is configured", () => {
    expect(() =>
      loadServerConfig({
        PACIUM_HOST: "0.0.0.0",
        SHELL: "/bin/zsh",
      }),
    ).toThrow();
  });

  it("keeps verification unavailable without explicit configuration", () => {
    expect(
      loadServerConfig({
        SHELL: "/bin/zsh",
      }).verificationCatalog,
    ).toEqual({
      configured: false,
      repositories: [],
    });
  });

  it("keeps Tailscale Serve disabled when both remote values are absent", () => {
    expect(loadTailscaleServeConfig({})).toBeNull();
  });

  it("accepts one canonical Serve origin and exact login allowlist", () => {
    expect(
      loadTailscaleServeConfig({
        PACIUM_TAILSCALE_ORIGIN: "https://pacium-host.example-tailnet.ts.net",
        PACIUM_TAILSCALE_OPERATOR_LOGINS: "owner@example.com,operator@github",
      }),
    ).toEqual({
      origin: "https://pacium-host.example-tailnet.ts.net",
      hostname: "pacium-host.example-tailnet.ts.net",
      operatorLogins: new Set(["owner@example.com", "operator@github"]),
    });
  });

  it("adds only a valid Serve origin to the browser origin set", () => {
    const config = loadServerConfig({
      HOME: process.env.HOME,
      SHELL: "/bin/zsh",
      PACIUM_TAILSCALE_ORIGIN: "https://pacium-host.example-tailnet.ts.net",
      PACIUM_TAILSCALE_OPERATOR_LOGINS: "owner@example.com",
    });

    expect(config.host).toBe("127.0.0.1");
    expect(config.allowedOrigins).toContain(
      "https://pacium-host.example-tailnet.ts.net",
    );
    expect(config.tailscaleServe?.operatorLogins).toEqual(
      new Set(["owner@example.com"]),
    );
  });

  it("rejects partial, non-HTTPS, non-tailnet, and non-origin remote config", () => {
    expect(() =>
      loadTailscaleServeConfig({
        PACIUM_TAILSCALE_ORIGIN: "https://pacium-host.example-tailnet.ts.net",
      }),
    ).toThrow("configured together");
    expect(() =>
      loadTailscaleServeConfig({
        PACIUM_TAILSCALE_OPERATOR_LOGINS: "owner@example.com",
      }),
    ).toThrow("configured together");

    for (const origin of [
      "http://pacium-host.example-tailnet.ts.net",
      "https://pacium-host.example.com",
      "https://pacium-host.example-tailnet.ts.net/",
      "https://pacium-host.example-tailnet.ts.net:8443",
      "https://pacium-host.example-tailnet.ts.net/path",
      "https://pacium-host.example-tailnet.ts.net?query=1",
      "https://pacium-host.example-tailnet.ts.net#fragment",
    ]) {
      expect(() =>
        loadTailscaleServeConfig({
          PACIUM_TAILSCALE_ORIGIN: origin,
          PACIUM_TAILSCALE_OPERATOR_LOGINS: "owner@example.com",
        }),
      ).toThrow("canonical");
    }
  });

  it("rejects empty, duplicate, unsafe, and unbounded operator logins", () => {
    const origin = "https://pacium-host.example-tailnet.ts.net";
    for (const logins of [
      "",
      "owner@example.com,owner@example.com",
      "owner",
      "owner@@example.com",
      "owner example@example.com",
      "owner,alias@example.com",
      "owñer@example.com",
      `${"a".repeat(245)}@example.com`,
      Array.from(
        { length: 33 },
        (_, index) => `owner${index}@example.com`,
      ).join(","),
    ]) {
      expect(() =>
        loadTailscaleServeConfig({
          PACIUM_TAILSCALE_ORIGIN: origin,
          PACIUM_TAILSCALE_OPERATOR_LOGINS: logins,
        }),
      ).toThrow("unique bounded exact ASCII logins");
    }
  });

  it("uses a dedicated macOS-first data directory without creating it", () => {
    const home = realpathSync(process.env.HOME!);
    expect(resolvePaciumDataDirectory(undefined, home)).toBe(
      `${home}/Library/Application Support/Pacium Control`,
    );
    expect(
      resolvePaciumDataDirectory("/private/tmp/pacium-state/../config", home),
    ).toBe("/private/tmp/config");
  });

  it("rejects broad, relative, and control-bearing data directories", () => {
    const home = realpathSync(process.env.HOME!);
    expect(() => resolvePaciumDataDirectory("/", home)).toThrow(
      "dedicated child",
    );
    expect(() => resolvePaciumDataDirectory(home, home)).toThrow(
      "dedicated child",
    );
    expect(() => resolvePaciumDataDirectory("relative", home)).toThrow(
      "bounded absolute",
    );
    expect(() =>
      resolvePaciumDataDirectory("/private/tmp/pacium\nhidden", home),
    ).toThrow("bounded absolute");
  });

  it("passes only allowlisted environment values to terminals", () => {
    expect(
      buildChildEnvironment(["HOME", "CUSTOM_VALUE"], {
        HOME: "/Users/operator",
        CUSTOM_VALUE: "allowed",
        SECRET_TOKEN: "must-not-cross",
      }),
    ).toEqual({
      TERM: "xterm-256color",
      PACIUM_SESSION: "1",
      HOME: "/Users/operator",
      CUSTOM_VALUE: "allowed",
    });
  });
});
