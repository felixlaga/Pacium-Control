import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadServerConfig } from "./config.js";
import { HostSetupStore, loadHostSetupDocument } from "./host-setup-store.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("host setup storage", () => {
  it("atomically persists private versioned setup and loads it at startup", async () => {
    const dataDirectory = await mkdtemp(
      join(tmpdir(), "pacium-host-setup-store-"),
    );
    directories.push(dataDirectory);
    const store = new HostSetupStore(dataDirectory);
    const document = {
      schemaVersion: 1 as const,
      loopbackPort: 4174 as const,
      tmuxSocket: "/private/tmp/tmux-0/default",
      metaTmuxSessionName: "meta",
      tailscaleOrigin: "https://felix-harness.example-tailnet.ts.net",
      tailscaleOperatorLogin: "felix@example.com",
    };

    await expect(store.replace(document)).resolves.toEqual(document);
    expect(loadHostSetupDocument(dataDirectory)).toEqual(document);

    const config = loadServerConfig({
      HOME: process.env.HOME,
      PACIUM_DATA_DIR: dataDirectory,
      SHELL: "/bin/sh",
    });
    expect(config.tmuxSocket).toBe("/private/tmp/tmux-0/default");
    expect(config.metaTmuxSessionName).toBe("meta");
    expect(config.tailscaleServe).toEqual({
      origin: "https://felix-harness.example-tailnet.ts.net",
      hostname: "felix-harness.example-tailnet.ts.net",
      operatorLogins: new Set(["felix@example.com"]),
    });

    const movedPort = loadServerConfig({
      HOME: process.env.HOME,
      PACIUM_DATA_DIR: dataDirectory,
      PACIUM_PORT: "5000",
      SHELL: "/bin/sh",
    });
    expect(movedPort.tmuxSocket).toBe("/private/tmp/tmux-0/default");
    expect(movedPort.tailscaleServe).toBeNull();
  });

  it("keeps explicit environment setup higher priority", async () => {
    const dataDirectory = await mkdtemp(
      join(tmpdir(), "pacium-host-setup-override-"),
    );
    directories.push(dataDirectory);
    await new HostSetupStore(dataDirectory).replace({
      schemaVersion: 1,
      loopbackPort: 4174,
      tmuxSocket: "/private/tmp/stored.sock",
      metaTmuxSessionName: "stored-meta",
      tailscaleOrigin: "https://stored.example-tailnet.ts.net",
      tailscaleOperatorLogin: "stored@example.com",
    });

    const config = loadServerConfig({
      HOME: process.env.HOME,
      PACIUM_DATA_DIR: dataDirectory,
      SHELL: "/bin/sh",
      PACIUM_TMUX_SOCKET: "/private/tmp/explicit.sock",
      PACIUM_META_TMUX_SESSION: "explicit-meta",
      PACIUM_TAILSCALE_ORIGIN: "https://explicit.example-tailnet.ts.net",
      PACIUM_TAILSCALE_OPERATOR_LOGINS: "explicit@example.com",
    });
    expect(config.tmuxSocket).toBe("/private/tmp/explicit.sock");
    expect(config.metaTmuxSessionName).toBe("explicit-meta");
    expect(config.tailscaleServe?.origin).toBe(
      "https://explicit.example-tailnet.ts.net",
    );
  });
});
