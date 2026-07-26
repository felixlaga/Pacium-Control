import { describe, expect, it } from "vitest";

import { buildChildEnvironment, loadServerConfig } from "./config.js";

describe("local server configuration", () => {
  it("fails closed when a non-loopback host is configured", () => {
    expect(() =>
      loadServerConfig({
        PACIUM_HOST: "0.0.0.0",
        SHELL: "/bin/zsh",
      }),
    ).toThrow();
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
