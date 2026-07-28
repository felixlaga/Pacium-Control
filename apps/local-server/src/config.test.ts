import { realpathSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildChildEnvironment,
  defaultPaciumDataDirectory,
  defaultShellForPlatform,
  loadLocalAllowedOrigins,
  loadServerConfig,
  loadTailscaleServeConfig,
  resolvePaciumDataDirectory,
  resolveTmuxSocket,
} from "./config.js";

describe("local server configuration", () => {
  it("fails closed when a non-loopback host is configured", () => {
    expect(() =>
      loadServerConfig({
        PACIUM_HOST: "0.0.0.0",
        SHELL: "/bin/sh",
      }),
    ).toThrow();
  });

  it("keeps verification unavailable without explicit configuration", () => {
    expect(
      loadServerConfig({
        SHELL: "/bin/sh",
      }).verificationCatalog,
    ).toEqual({
      configured: false,
      repositories: [],
    });
  });

  it("keeps tmux optional and accepts one bounded absolute socket path", () => {
    expect(resolveTmuxSocket(undefined)).toBeNull();
    expect(resolveTmuxSocket("/private/tmp/pacium/../tmux.sock")).toBe(
      "/private/tmp/tmux.sock",
    );
    expect(
      loadServerConfig({
        HOME: process.env.HOME,
        SHELL: "/bin/sh",
        PACIUM_TMUX_SOCKET: "/private/tmp/pacium.sock",
      }).tmuxSocket,
    ).toBe("/private/tmp/pacium.sock");
  });

  it("rejects broad, relative, control-bearing, and unbounded tmux paths", () => {
    for (const path of [
      "/",
      "relative/tmux.sock",
      "/private/tmp/tmux\nhidden.sock",
      `/${"a".repeat(4097)}`,
    ]) {
      expect(() => resolveTmuxSocket(path)).toThrow("PACIUM_TMUX_SOCKET");
    }
  });

  it("keeps Tailscale Serve disabled when both remote values are absent", () => {
    expect(loadTailscaleServeConfig({})).toBeNull();
  });

  it("accepts only canonical loopback browser origins", () => {
    expect(
      loadLocalAllowedOrigins(
        "http://127.0.0.1:4173,http://localhost:4173",
        [],
      ),
    ).toEqual(new Set(["http://127.0.0.1:4173", "http://localhost:4173"]));

    for (const origins of [
      "",
      "http://127.0.0.1:4173,http://127.0.0.1:4173",
      "https://127.0.0.1:4173",
      "http://192.168.1.20:4173",
      "http://100.64.0.10:4173",
      "https://pacium-host.example-tailnet.ts.net",
      "http://localhost:4173/path",
      "http://user@localhost:4173",
    ]) {
      expect(() => loadLocalAllowedOrigins(origins, [])).toThrow(
        "canonical loopback HTTP origins",
      );
    }
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

  it("keeps the Serve origin separate from local browser origins", () => {
    const config = loadServerConfig({
      HOME: process.env.HOME,
      SHELL: "/bin/sh",
      PACIUM_TAILSCALE_ORIGIN: "https://pacium-host.example-tailnet.ts.net",
      PACIUM_TAILSCALE_OPERATOR_LOGINS: "owner@example.com",
    });

    expect(config.host).toBe("127.0.0.1");
    expect(config.allowedOrigins).not.toContain(
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
    expect(resolvePaciumDataDirectory(undefined, home, "darwin")).toBe(
      `${home}/Library/Application Support/Pacium Control`,
    );
    expect(
      resolvePaciumDataDirectory("/private/tmp/pacium-state/../config", home),
    ).toBe("/private/tmp/config");
  });

  it("uses the supported Linux shell and dedicated XDG state directory", () => {
    const home = realpathSync(process.env.HOME!);
    expect(defaultShellForPlatform("linux")).toBe("/bin/bash");
    expect(defaultShellForPlatform("darwin")).toBe("/bin/zsh");
    expect(defaultPaciumDataDirectory(home, "linux")).toBe(
      `${home}/.local/state/pacium-control`,
    );
    expect(
      defaultPaciumDataDirectory(
        home,
        "linux",
        "/private/tmp/xdg-state/../operator-state",
      ),
    ).toBe("/private/tmp/operator-state/pacium-control");
    expect(
      loadServerConfig(
        {
          HOME: home,
          PACIUM_DEFAULT_CWD: process.cwd(),
          XDG_STATE_HOME: "/private/tmp/pacium-xdg-state",
        },
        "linux",
      ),
    ).toMatchObject({
      shell: "/bin/bash",
      dataDirectory: "/private/tmp/pacium-xdg-state/pacium-control",
    });
  });

  it("rejects a relative or control-bearing Linux XDG state root", () => {
    const home = realpathSync(process.env.HOME!);
    for (const xdgStateHome of ["relative/state", "/tmp/state\nhidden"]) {
      expect(() =>
        defaultPaciumDataDirectory(home, "linux", xdgStateHome),
      ).toThrow("XDG_STATE_HOME");
    }
  });

  it("includes bounded XDG locations in the default terminal environment", () => {
    const home = realpathSync(process.env.HOME!);
    const config = loadServerConfig(
      {
        HOME: home,
        PACIUM_DEFAULT_CWD: process.cwd(),
        XDG_CONFIG_HOME: "/tmp/xdg-config",
        XDG_DATA_HOME: "/tmp/xdg-data",
        XDG_STATE_HOME: "/tmp/xdg-state",
        XDG_CACHE_HOME: "/tmp/xdg-cache",
      },
      "linux",
    );

    expect(
      buildChildEnvironment(config.environmentKeys, {
        XDG_CONFIG_HOME: "/tmp/xdg-config",
        XDG_DATA_HOME: "/tmp/xdg-data",
        XDG_STATE_HOME: "/tmp/xdg-state",
        XDG_CACHE_HOME: "/tmp/xdg-cache",
      }),
    ).toMatchObject({
      XDG_CONFIG_HOME: "/tmp/xdg-config",
      XDG_DATA_HOME: "/tmp/xdg-data",
      XDG_STATE_HOME: "/tmp/xdg-state",
      XDG_CACHE_HOME: "/tmp/xdg-cache",
    });
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
