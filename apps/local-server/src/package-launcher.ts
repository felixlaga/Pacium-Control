import { openPaciumBrowser } from "./browser-launch.js";
import {
  assertSupportedPackageRuntime,
  packageServerUrl,
  parsePackageLaunchArguments,
  probePaciumServer,
  resolvePackagePort,
} from "./package-launcher-core.js";

const PACKAGE_VERSION = "0.0.0";

async function main(): Promise<void> {
  const options = parsePackageLaunchArguments(process.argv.slice(2));
  if (options.command === "help") {
    process.stdout.write(
      [
        "Pacium Control",
        "",
        "Usage: pacium-control [--no-open]",
        "       pacium-control --help",
        "       pacium-control --version",
        "",
        "Options:",
        "  --no-open  Start or reuse Pacium without opening a browser.",
        "  --help     Show this help.",
        "  --version  Show the package version.",
        "",
      ].join("\n"),
    );
    return;
  }
  if (options.command === "version") {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return;
  }

  assertSupportedPackageRuntime(
    process.platform,
    process.arch,
    process.versions.node,
  );
  const port = resolvePackagePort(process.env.PACIUM_PORT);
  const url = packageServerUrl(port);

  if (await probePaciumServer(url)) {
    process.stdout.write(`Pacium Control is already running at ${url}\n`);
    if (options.openBrowser && !(await openPaciumBrowser(url))) {
      throw new Error(
        "Pacium Control is running, but its browser window could not be opened.",
      );
    }
    return;
  }

  process.env.PACIUM_OPEN_BROWSER = options.openBrowser ? "1" : "0";
  await import("./index.js");
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Pacium Control could not start: ${
      error instanceof Error ? error.message : "unknown error"
    }\n`,
  );
  process.exitCode = 1;
});
