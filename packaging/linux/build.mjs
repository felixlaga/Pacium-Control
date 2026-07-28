import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertLinuxBuildRuntime,
  assertSafeManifestPath,
  octalMode,
} from "./build-contract.mjs";

const packagingDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packagingDirectory, "../..");
const outputRoot = join(repositoryRoot, "dist", "linux");
const stagingRoot = join(outputRoot, "staging");
const packageName = "pacium-control";
const packageRoot = join(stagingRoot, packageName);
const applicationRoot = join(packageRoot, "app");
const manifestPath = join(packageRoot, "package-manifest.json");
const normalizedTime = new Date("2000-01-01T00:00:00.000Z");

assertLinuxBuildRuntime({
  platform: process.platform,
  architecture: process.arch,
  nodeVersion: process.versions.node,
});

const rootPackage = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
);
const packageVersion = requireBoundedVersion(rootPackage.version);
const protocolVersion = await readProtocolVersion();
const archiveName = `pacium-control-${packageVersion}-linux-x64.tar.gz`;
const archivePath = join(outputRoot, archiveName);

const serverDist = join(repositoryRoot, "apps", "local-server", "dist");
const webDist = join(repositoryRoot, "apps", "web", "dist");
const nodePtyLink = join(
  repositoryRoot,
  "apps",
  "local-server",
  "node_modules",
  "node-pty",
);
const nodePtySource = await realpath(nodePtyLink).catch(() => {
  throw new Error(
    "The source-built node-pty install is missing. Run a frozen source install.",
  );
});
const ptyModule = join(nodePtySource, "build", "Release", "pty.node");

await requireFile(join(serverDist, "index.js"), "production local server");
await requireFile(
  join(serverDist, "package-launcher.js"),
  "production package launcher",
);
await requireFile(join(webDist, "index.html"), "production web application");
await requireX64Elf(ptyModule, "node-pty native module");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(applicationRoot, { recursive: true });

await copyRuntimeTree(
  serverDist,
  join(applicationRoot, "apps/local-server/dist"),
  {
    excludeSourceMaps: true,
  },
);
await copyRuntimeTree(webDist, join(applicationRoot, "apps/web/dist"));
await copyNodePty(nodePtySource);

await copyFileWithMode(
  join(packagingDirectory, "pacium.sh"),
  join(packageRoot, "bin", "pacium"),
  0o755,
);
await copyFileWithMode(
  join(packagingDirectory, "PACKAGE_ID"),
  join(packageRoot, "PACKAGE_ID"),
  0o644,
);
for (const name of ["install.sh", "uninstall.sh"]) {
  await copyFileWithMode(
    join(packagingDirectory, name),
    join(stagingRoot, name),
    0o755,
  );
}
await copyFileWithMode(
  join(packagingDirectory, "INSTALL.md"),
  join(stagingRoot, "INSTALL.md"),
  0o644,
);

const files = await buildFileManifest(stagingRoot, manifestPath);
const manifest = {
  schemaVersion: 1,
  packageVersion,
  protocolVersion,
  target: {
    distribution: "ubuntu",
    distributionVersion: "24.04",
    platform: "linux",
    architecture: "x64",
  },
  runtime: {
    nodeRequirement: "24.18.x",
    nodeBundled: false,
    nodePty: "source-built-linux-x64",
    shellFallback: "/bin/bash",
  },
  distribution: {
    artifactSigned: false,
    distroNative: false,
    releaseEligible: false,
  },
  stateOwnership: "external-preserved",
  files,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  mode: 0o644,
});
await normalizeTree(stagingRoot);

execFileSync("/usr/bin/tar", [
  "--format=ustar",
  "--sort=name",
  "--owner=0",
  "--group=0",
  "--numeric-owner",
  "--mtime=@946684800",
  "--no-xattrs",
  "-cf",
  archivePath.replace(/\.gz$/, ""),
  "-C",
  stagingRoot,
  packageName,
  "install.sh",
  "uninstall.sh",
  "INSTALL.md",
]);
execFileSync("/usr/bin/gzip", ["-n", "-f", archivePath.replace(/\.gz$/, "")]);

const archiveBytes = (await stat(archivePath)).size;
const archiveHash = await hashFile(archivePath);
const checksumPath = `${archivePath}.sha256`;
await writeFile(checksumPath, `${archiveHash}  ${archiveName}\n`, {
  mode: 0o644,
});
await rm(stagingRoot, { recursive: true, force: true });

process.stdout.write(
  [
    `Linux package: ${relative(repositoryRoot, archivePath)}`,
    `archive bytes: ${archiveBytes}`,
    `archive sha256: ${archiveHash}`,
    `manifest files: ${files.length}`,
    "target: ubuntu-24.04-linux-x64",
    "node runtime: external 24.18.x",
    "artifact signed: no",
    "distro native: no",
    "",
  ].join("\n"),
);

async function copyRuntimeTree(source, destination, options = {}) {
  await cp(source, destination, {
    recursive: true,
    dereference: true,
    filter: (candidate) =>
      !options.excludeSourceMaps || !candidate.endsWith(".map"),
  });
}

async function copyNodePty(source) {
  const destination = join(
    applicationRoot,
    "apps",
    "local-server",
    "node_modules",
    "node-pty",
  );
  await mkdir(join(destination, "build", "Release"), { recursive: true });
  await cp(join(source, "lib"), join(destination, "lib"), {
    recursive: true,
    filter: (candidate) =>
      !candidate.endsWith(".map") && !candidate.endsWith(".test.js"),
  });
  for (const name of ["LICENSE", "package.json"]) {
    await copyFileWithMode(join(source, name), join(destination, name), 0o644);
  }
  await copyFileWithMode(
    join(source, "build", "Release", "pty.node"),
    join(destination, "build", "Release", "pty.node"),
    0o755,
  );
}

async function copyFileWithMode(source, destination, mode) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  await chmod(destination, mode);
}

async function buildFileManifest(root, excludedPath) {
  const paths = await listFiles(root);
  const files = [];
  for (const path of paths) {
    if (path === excludedPath) {
      continue;
    }
    const name = relative(root, path).split(sep).join("/");
    assertSafeManifestPath(name);
    const metadata = await stat(path);
    files.push({
      path: name,
      bytes: metadata.size,
      sha256: await hashFile(path),
      mode: octalMode(metadata.mode),
    });
  }
  return files;
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort(compareEntryNames)) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      paths.push(path);
    } else {
      throw new Error("The package staging tree must not contain links.");
    }
  }
  return paths;
}

async function normalizeTree(root) {
  const paths = await listTree(root);
  for (const path of paths.reverse()) {
    await utimes(path, normalizedTime, normalizedTime);
  }
}

async function listTree(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [root];
  for (const entry of entries.sort(compareEntryNames)) {
    const path = join(root, entry.name);
    paths.push(path);
    if (entry.isDirectory()) {
      paths.push(...(await listTree(path)));
    }
  }
  return [...new Set(paths)];
}

async function hashFile(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function requireFile(path, label) {
  const metadata = await stat(path).catch(() => null);
  if (metadata === null || !metadata.isFile()) {
    throw new Error(`Missing ${label}: ${relative(repositoryRoot, path)}`);
  }
}

async function requireX64Elf(path, label) {
  await requireFile(path, label);
  const description = execFileSync("/usr/bin/file", ["-b", path], {
    encoding: "utf8",
  });
  if (
    !description.includes("ELF 64-bit") ||
    !description.includes("x86-64") ||
    !description.includes("shared object")
  ) {
    throw new Error(`${label} is not one x64 ELF shared object.`);
  }
}

async function readProtocolVersion() {
  const source = await readFile(
    join(repositoryRoot, "packages", "contracts", "src", "protocol.ts"),
    "utf8",
  );
  const match = source.match(/export const PROTOCOL_VERSION = (\d+) as const;/);
  const value = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new Error("Could not read the bounded Pacium protocol version.");
  }
  return value;
}

function requireBoundedVersion(value) {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value) ||
    value.length > 64
  ) {
    throw new Error("The root package version is invalid.");
  }
  return value;
}

function compareEntryNames(left, right) {
  if (left.name < right.name) {
    return -1;
  }
  if (left.name > right.name) {
    return 1;
  }
  return 0;
}
