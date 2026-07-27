import { realpathSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildChildEnvironment,
  loadServerConfig,
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
