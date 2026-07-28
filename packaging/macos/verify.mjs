import { createHash } from "node:crypto";
import { execFile, execFileSync, spawn } from "node:child_process";
import {
  access,
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  assertMacosBuildRuntime,
  assertSafeManifestPath,
  octalMode,
} from "./build-contract.mjs";

const execFileAsync = promisify(execFile);
const packagingDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packagingDirectory, "../..");
const outputRoot = join(repositoryRoot, "dist", "macos");
const packageVersion = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
).version;
const archiveName = `pacium-control-${packageVersion}-darwin-arm64.tar.gz`;
const archivePath = join(outputRoot, archiveName);
const checksumPath = `${archivePath}.sha256`;
const testRoot = await mkdtemp(join(tmpdir(), "pacium-macos-package-"));
let serverProcess = null;

assertMacosBuildRuntime({
  platform: process.platform,
  architecture: process.arch,
  nodeVersion: process.versions.node,
});

try {
  const initialArchiveHash = await hashFile(archivePath);
  await execFileAsync(
    process.execPath,
    [join(packagingDirectory, "build.mjs")],
    {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    },
  );
  const rebuiltArchiveHash = await hashFile(archivePath);
  assertEqual(
    rebuiltArchiveHash,
    initialArchiveHash,
    "The package archive is not deterministic across identical builds.",
  );
  await verifyChecksum(rebuiltArchiveHash);

  const archiveEntries = execFileSync("/usr/bin/tar", ["-tzf", archivePath], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  assert(
    archiveEntries.every(
      (entry) =>
        entry === "install.sh" ||
        entry === "uninstall.sh" ||
        entry === "INSTALL.md" ||
        entry === "Pacium Control.app" ||
        entry.startsWith("Pacium Control.app/"),
    ),
    "The archive contains an unexpected top-level path.",
  );
  assert(
    !archiveEntries.some(
      (entry) => entry.startsWith("/") || entry.split("/").includes(".."),
    ),
    "The archive contains an unsafe path.",
  );

  const extractedRoot = join(testRoot, "archive");
  await mkdir(extractedRoot);
  execFileSync("/usr/bin/tar", ["-xzf", archivePath, "-C", extractedRoot]);

  const appRoot = join(extractedRoot, "Pacium Control.app");
  const manifestPath = join(
    appRoot,
    "Contents",
    "Resources",
    "app",
    "package-manifest.json",
  );
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  verifyManifestShape(manifest);
  await verifyManifestFiles(extractedRoot, manifest);
  await verifyNoSensitiveManifestContent(manifestText);

  const plistPath = join(appRoot, "Contents", "Info.plist");
  execFileSync("/usr/bin/plutil", ["-lint", plistPath]);
  const bundleIdentifier = execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :CFBundleIdentifier", plistPath],
    { encoding: "utf8" },
  ).trim();
  assertEqual(
    bundleIdentifier,
    "com.pacium.control",
    "The bundle identity is incorrect.",
  );
  const codesign = await execFileAsync("/usr/bin/codesign", [
    "-dv",
    "--verbose=2",
    appRoot,
  ]).catch((error) => error);
  assert(
    codesign.code !== 0 &&
      String(codesign.stderr).includes("code object is not signed"),
    "The development artifact signing status is not explicitly unsigned.",
  );

  const nativeRoot = join(
    appRoot,
    "Contents",
    "Resources",
    "app",
    "apps",
    "local-server",
    "node_modules",
    "node-pty",
  );
  await verifyArm64MachO(
    join(nativeRoot, "build", "Release", "pty.node"),
    "packaged pty.node",
  );
  await verifyArm64MachO(
    join(nativeRoot, "build", "Release", "spawn-helper"),
    "packaged spawn-helper",
  );
  await verifyPackagedPty(nativeRoot);

  const applicationsDirectory = join(testRoot, "Applications");
  const binDirectory = join(testRoot, "bin");
  const lifecycleEnvironment = {
    ...process.env,
    PACIUM_APPLICATIONS_DIR: applicationsDirectory,
    PACIUM_BIN_DIR: binDirectory,
  };
  await verifyRejectedInstallerDestinations(extractedRoot, testRoot);
  await runScript(join(extractedRoot, "install.sh"), lifecycleEnvironment);

  const installedApp = join(
    await realpath(applicationsDirectory),
    "Pacium Control.app",
  );
  const commandLink = join(await realpath(binDirectory), "pacium");
  const expectedCommand = join(
    installedApp,
    "Contents",
    "MacOS",
    "pacium-control",
  );
  assertEqual(
    await readlink(commandLink),
    expectedCommand,
    "The command link does not own the installed launcher.",
  );
  assert(
    (await lstat(commandLink)).isSymbolicLink(),
    "The package command is not a symlink.",
  );
  await runScript(join(extractedRoot, "install.sh"), lifecycleEnvironment);
  assertEqual(
    await readlink(commandLink),
    expectedCommand,
    "Same-version upgrade changed command ownership.",
  );

  const dataDirectory = join(testRoot, "preserved-state");
  const repositoryCanary = join(testRoot, "preserved-repository");
  const providerCanary = join(testRoot, "preserved-provider");
  const tmuxCanary = join(testRoot, "preserved-tmux");
  for (const directory of [
    dataDirectory,
    repositoryCanary,
    providerCanary,
    tmuxCanary,
  ]) {
    await mkdir(directory);
    await writeFile(join(directory, "sentinel"), "preserve\n");
  }
  await chmod(dataDirectory, 0o700);

  const port = await allocateLoopbackPort();
  const serverEnvironment = {
    ...process.env,
    PACIUM_NODE_BINARY: process.execPath,
    PACIUM_PORT: String(port),
    PACIUM_DEFAULT_CWD: repositoryRoot,
    PACIUM_DATA_DIR: dataDirectory,
    PACIUM_OPEN_BROWSER: "0",
  };
  serverProcess = spawn(commandLink, ["--no-open"], {
    cwd: testRoot,
    env: serverEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const processOutput = captureBoundedOutput(serverProcess);
  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await waitForHealth(baseUrl, serverProcess, processOutput);
  assertEqual(
    health.headers.get("x-pacium-protocol"),
    String(manifest.protocolVersion),
    "The installed server health signature is incorrect.",
  );
  assertDeepEqual(
    await health.json(),
    { status: "ok" },
    "The installed server health body is incorrect.",
  );
  const web = await fetch(baseUrl);
  assertEqual(
    web.status,
    200,
    "The installed server did not serve the web UI.",
  );
  assert(
    (await web.text()).includes("<title>Pacium Control</title>"),
    "The installed production asset is not the Pacium web application.",
  );

  const reuse = await runScript(commandLink, serverEnvironment, ["--no-open"]);
  assert(
    reuse.stdout.includes(`already running at ${baseUrl}`),
    "The package launcher did not reuse the exact running instance.",
  );

  const activeUninstall = await runScriptExpectFailure(
    join(extractedRoot, "uninstall.sh"),
    lifecycleEnvironment,
  );
  assert(
    activeUninstall.stderr.includes("is running"),
    "Uninstall did not refuse the active package server.",
  );
  await stopServer();

  await runScript(join(extractedRoot, "uninstall.sh"), lifecycleEnvironment);
  await assertMissing(installedApp, "The application survived uninstall.");
  await assertMissing(
    commandLink,
    "The owned command link survived uninstall.",
  );
  for (const directory of [
    dataDirectory,
    repositoryCanary,
    providerCanary,
    tmuxCanary,
  ]) {
    assertEqual(
      await readFile(join(directory, "sentinel"), "utf8"),
      "preserve\n",
      `Uninstall modified ${relative(testRoot, directory)}.`,
    );
  }
  await runScript(join(extractedRoot, "uninstall.sh"), lifecycleEnvironment);

  const archiveBytes = (await stat(archivePath)).size;
  process.stdout.write(
    [
      "macOS package verification: passed",
      `archive: ${archiveName}`,
      `archive bytes: ${archiveBytes}`,
      `archive sha256: ${rebuiltArchiveHash}`,
      `manifest files: ${manifest.files.length}`,
      "native PTY: arm64 load, Unicode input, resize, and exit passed",
      "install/upgrade: passed",
      "production health/assets/exact-instance reuse: passed",
      "active uninstall refusal: passed",
      "uninstall/state preservation: passed",
      "developer id signed: no",
      "notarized: no",
      "",
    ].join("\n"),
  );
} finally {
  await stopServer();
  await rm(testRoot, { recursive: true, force: true });
}

async function verifyChecksum(expectedHash) {
  const checksum = await readFile(checksumPath, "utf8");
  assertEqual(
    checksum,
    `${expectedHash}  ${archiveName}\n`,
    "The archive checksum file is malformed.",
  );
}

function verifyManifestShape(manifest) {
  assertEqual(manifest.schemaVersion, 1, "Unsupported package manifest.");
  assertEqual(
    manifest.packageVersion,
    packageVersion,
    "Manifest package version mismatch.",
  );
  assertEqual(manifest.target.platform, "darwin", "Manifest target mismatch.");
  assertEqual(
    manifest.target.architecture,
    "arm64",
    "Manifest architecture mismatch.",
  );
  assertEqual(
    manifest.runtime.nodeRequirement,
    "24.18.x",
    "Manifest Node requirement mismatch.",
  );
  assertEqual(
    manifest.runtime.nodeBundled,
    false,
    "The package must not claim a bundled Node runtime.",
  );
  assertDeepEqual(
    manifest.distribution,
    {
      developerIdSigned: false,
      notarized: false,
      releaseEligible: false,
    },
    "The development distribution status is dishonest.",
  );
  assert(Array.isArray(manifest.files), "Manifest files must be an array.");
}

async function verifyManifestFiles(extractedRoot, manifest) {
  const manifestPaths = new Set();
  for (const entry of manifest.files) {
    assertSafeManifestPath(entry.path);
    assert(
      !manifestPaths.has(entry.path),
      `Duplicate manifest path: ${entry.path}`,
    );
    manifestPaths.add(entry.path);
    const path = join(extractedRoot, ...entry.path.split("/"));
    const metadata = await lstat(path);
    assert(metadata.isFile(), `Manifest path is not a file: ${entry.path}`);
    assertEqual(metadata.size, entry.bytes, `Byte mismatch: ${entry.path}`);
    assertEqual(
      await hashFile(path),
      entry.sha256,
      `Hash mismatch: ${entry.path}`,
    );
    assertEqual(
      octalMode(metadata.mode),
      entry.mode,
      `Mode mismatch: ${entry.path}`,
    );
  }

  const actualFiles = await listFiles(extractedRoot);
  const manifestRelativePath =
    "Pacium Control.app/Contents/Resources/app/package-manifest.json";
  const expectedPaths = new Set([...manifestPaths, manifestRelativePath]);
  assertEqual(
    actualFiles.length,
    expectedPaths.size,
    "The archive file count differs from its manifest.",
  );
  for (const path of actualFiles) {
    const name = relative(extractedRoot, path).split(sep).join("/");
    assert(expectedPaths.has(name), `Unmanifested package file: ${name}`);
  }
}

async function verifyNoSensitiveManifestContent(manifestText) {
  const checksumText = await readFile(checksumPath, "utf8");
  const forbidden = [
    repositoryRoot,
    testRoot,
    homedir(),
    process.env.USER,
    process.env.LOGNAME,
    process.env.PACIUM_ACCESS_TOKEN,
  ].filter((value) => typeof value === "string" && value.length >= 3);
  for (const value of forbidden) {
    assert(
      !manifestText.includes(value) && !checksumText.includes(value),
      "The manifest or checksum contains machine-local data.",
    );
  }
}

async function verifyPackagedPty(nativeRoot) {
  const script = String.raw`
const pty = require(process.argv[1]);
let output = "";
const terminal = pty.spawn("/bin/zsh", ["-f"], {
  name: "xterm-256color",
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: { TERM: "xterm-256color", PATH: process.env.PATH }
});
const timer = setTimeout(() => {
  terminal.kill();
  process.stderr.write("packaged PTY timeout\n");
  process.exitCode = 1;
}, 5000);
terminal.onData((data) => {
  output += data;
});
terminal.onExit(({ exitCode }) => {
  clearTimeout(timer);
  if (exitCode !== 0 || !output.includes("PACIUM_PTY_π")) {
    process.stderr.write(output);
    process.exitCode = 1;
  }
});
terminal.resize(96, 30);
terminal.write("printf 'PACIUM_PTY_π\\n'\r");
terminal.write("exit 0\r");
`;
  await execFileAsync(process.execPath, ["-e", script, nativeRoot], {
    cwd: testRoot,
    timeout: 10_000,
    maxBuffer: 128 * 1024,
  });
}

async function verifyRejectedInstallerDestinations(extractedRoot, root) {
  const installer = join(extractedRoot, "install.sh");
  const relativeFailure = await runScriptExpectFailure(installer, {
    ...process.env,
    PACIUM_APPLICATIONS_DIR: "relative/apps",
    PACIUM_BIN_DIR: join(root, "reject-relative-bin"),
  });
  assert(
    relativeFailure.stderr.includes("absolute path"),
    "Installer accepted a relative destination.",
  );

  const foreignApplications = join(root, "foreign-applications");
  const foreignBin = join(root, "foreign-bin");
  await mkdir(foreignApplications);
  await mkdir(foreignBin);
  await writeFile(join(foreignBin, "pacium"), "foreign\n");
  const foreignFailure = await runScriptExpectFailure(installer, {
    ...process.env,
    PACIUM_APPLICATIONS_DIR: foreignApplications,
    PACIUM_BIN_DIR: foreignBin,
  });
  assert(
    foreignFailure.stderr.includes("foreign file"),
    "Installer accepted a foreign command target.",
  );
  assertEqual(
    await readFile(join(foreignBin, "pacium"), "utf8"),
    "foreign\n",
    "Installer modified a foreign command target.",
  );
  await assertMissing(
    join(foreignApplications, "Pacium Control.app"),
    "Installer modified the application target after a foreign-link refusal.",
  );
}

async function runScript(path, environment, arguments_ = []) {
  return await execFileAsync(path, arguments_, {
    cwd: dirname(path),
    env: environment,
    timeout: 15_000,
    maxBuffer: 256 * 1024,
  });
}

async function runScriptExpectFailure(path, environment, arguments_ = []) {
  try {
    await runScript(path, environment, arguments_);
  } catch (error) {
    return {
      code: error.code,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? ""),
    };
  }
  throw new Error(`Expected command to fail: ${path}`);
}

async function waitForHealth(baseUrl, process_, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (process_.exitCode !== null) {
      throw new Error(
        `Installed server exited before health: ${output.value()}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status === 200) {
        return response;
      }
    } catch {
      // The foreground server is still starting.
    }
    await new Promise((resolve_) => setTimeout(resolve_, 50));
  }
  throw new Error(`Installed server health timed out: ${output.value()}`);
}

function captureBoundedOutput(process_) {
  let output = "";
  const capture = (data) => {
    output = `${output}${String(data)}`.slice(-65_536);
  };
  process_.stdout?.on("data", capture);
  process_.stderr?.on("data", capture);
  return { value: () => output };
}

async function stopServer() {
  const process_ = serverProcess;
  if (process_ === null) {
    return;
  }
  serverProcess = null;
  if (process_.exitCode !== null || process_.signalCode !== null) {
    return;
  }
  await new Promise((resolve_, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Packaged server did not stop.")),
      10_000,
    );
    process_.once("exit", () => {
      clearTimeout(timer);
      resolve_();
    });
    process_.kill("SIGTERM");
  });
}

async function allocateLoopbackPort() {
  const server = createServer();
  await new Promise((resolve_, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve_);
  });
  const address = server.address();
  assert(
    typeof address === "object" && address !== null,
    "Could not allocate a loopback port.",
  );
  await new Promise((resolve_, reject) => {
    server.close((error) => (error === undefined ? resolve_() : reject(error)));
  });
  return address.port;
}

async function verifyArm64MachO(path, label) {
  const description = execFileSync("/usr/bin/file", ["-b", path], {
    encoding: "utf8",
  });
  assert(
    description.includes("Mach-O 64-bit") && description.includes("arm64"),
    `${label} is not arm64 Mach-O.`,
  );
}

async function listFiles(root) {
  const files = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error("The extracted archive contains a special file.");
    }
  }
  return files;
}

async function assertMissing(path, message) {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(message);
}

async function hashFile(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message} Expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
    );
  }
}
