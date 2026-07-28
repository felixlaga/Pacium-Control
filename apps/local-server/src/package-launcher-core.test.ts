import { PROTOCOL_VERSION } from "@pacium/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  assertSupportedPackageRuntime,
  packageServerUrl,
  parsePackageLaunchArguments,
  probePaciumServer,
  resolvePackagePort,
} from "./package-launcher-core.js";

describe("package launcher contract", () => {
  it("accepts the bounded launcher options and ignores Finder metadata", () => {
    expect(parsePackageLaunchArguments(["-psn_0_12345", "--no-open"])).toEqual({
      command: "run",
      openBrowser: false,
    });
    expect(parsePackageLaunchArguments(["--help"])).toEqual({
      command: "help",
      openBrowser: true,
    });
    expect(parsePackageLaunchArguments(["--version"])).toEqual({
      command: "version",
      openBrowser: true,
    });
  });

  it.each([
    { arguments_: ["--unknown"] },
    { arguments_: ["-psn_bad"] },
    { arguments_: ["--help", "--version"] },
  ])(
    "rejects unsupported or contradictory options: $arguments_",
    ({ arguments_ }) => {
      expect(() => parsePackageLaunchArguments(arguments_)).toThrow();
    },
  );

  it("requires the first supported package platform and runtime", () => {
    expect(() =>
      assertSupportedPackageRuntime("darwin", "arm64", "24.18.0"),
    ).not.toThrow();
    expect(() =>
      assertSupportedPackageRuntime("linux", "arm64", "24.18.0"),
    ).toThrow("darwin-arm64");
    expect(() =>
      assertSupportedPackageRuntime("darwin", "x64", "24.18.0"),
    ).toThrow("darwin-arm64");
    expect(() =>
      assertSupportedPackageRuntime("darwin", "arm64", "24.19.0"),
    ).toThrow("24.18.x");
  });

  it("accepts only one bounded decimal port", () => {
    expect(resolvePackagePort(undefined)).toBe(4_174);
    expect(resolvePackagePort("1024")).toBe(1_024);
    expect(resolvePackagePort("65535")).toBe(65_535);
    expect(packageServerUrl(4_174)).toBe("http://127.0.0.1:4174");

    for (const value of ["1023", "65536", "04174", "4174.0", " 4174"]) {
      expect(() => resolvePackagePort(value)).toThrow("PACIUM_PORT");
    }
  });

  it("recognizes only the exact Pacium health contract", async () => {
    const validResponse = new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-pacium-protocol": String(PROTOCOL_VERSION),
      },
    });
    const fetchImplementation = vi.fn<typeof fetch>(() =>
      Promise.resolve(validResponse),
    );

    await expect(
      probePaciumServer("http://127.0.0.1:4174", fetchImplementation),
    ).resolves.toBe(true);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://127.0.0.1:4174/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each([
    new Response(JSON.stringify({ status: "ok" }), {
      headers: { "content-type": "application/json" },
    }),
    new Response(JSON.stringify({ status: "wrong" }), {
      headers: {
        "content-type": "application/json",
        "x-pacium-protocol": String(PROTOCOL_VERSION),
      },
    }),
    new Response(JSON.stringify({ status: "ok", extra: true }), {
      headers: {
        "content-type": "application/json",
        "x-pacium-protocol": String(PROTOCOL_VERSION),
      },
    }),
  ])("rejects a foreign or malformed health response", async (response) => {
    await expect(
      probePaciumServer("http://127.0.0.1:4174", () =>
        Promise.resolve(response),
      ),
    ).resolves.toBe(false);
  });
});
