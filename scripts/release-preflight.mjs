import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertReleasePackageContract,
  assertReleaseRuntime,
  inspectArchivePaths,
  inspectTrackedPaths,
  parseLinuxHostContract,
  preflightError,
  validateReleaseManifest,
} from "./release-preflight-contract.mjs";

const repositoryRoot = realpathSync(
  join(dirname(fileURLToPath(import.meta.url)), ".."),
);
const gitExecutable = selectGitExecutable();
const MAX_COMMAND_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const REQUIRED_SOURCE_PATHS = [
  ".github/workflows/linux-validation.yml",
  "package.json",
  "pnpm-lock.yaml",
  "packaging/linux/INSTALL.md",
  "packaging/linux/PACKAGE_ID",
  "packaging/linux/build.mjs",
  "packaging/linux/install.sh",
  "packaging/linux/pacium.sh",
  "packaging/linux/uninstall.sh",
  "packaging/linux/verify.mjs",
  "packaging/macos/INSTALL.md",
  "packaging/macos/Pacium-Control.Info.plist",
  "packaging/macos/build.mjs",
  "packaging/macos/install.sh",
  "packaging/macos/pacium-control.sh",
  "packaging/macos/uninstall.sh",
  "packaging/macos/verify.mjs",
  "docs/decisions/ADR-0017-supported-hosts-and-development-packages.md",
  "docs/execution/release-readiness-assessment.md",
  "docs/execution/release-readiness-issue.md",
  "docs/execution/release-readiness-plan.md",
];

try {
  const includeArtifacts = parseArguments(process.argv.slice(2));
  const summary = await runPreflight({ includeArtifacts });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
} catch (error) {
  const code =
    error !== null &&
    typeof error === "object" &&
    typeof error.code === "string" &&
    /^[a-z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : "unexpected_failure";
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: 1, status: "failed", code })}\n`,
  );
  process.exitCode = 1;
}

export async function runPreflight({ includeArtifacts }) {
  const host = loadHostContract();
  const target = assertReleaseRuntime({
    platform: platform(),
    architecture: arch(),
    nodeVersion: process.versions.node,
    osName: host.name,
    osVersion: host.version,
  });
  const packageJson = JSON.parse(
    await readBoundedFile(join(repositoryRoot, "package.json"), 64 * 1024),
  );
  assertReleasePackageContract(packageJson);

  const canonicalTopLevel = realpathSync(
    runGit(["rev-parse", "--show-toplevel"]).trim(),
  );
  if (canonicalTopLevel !== repositoryRoot) {
    throw preflightError(
      "repository_root_mismatch",
      "Release preflight must run from its exact repository root.",
    );
  }

  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status !== "") {
    throw preflightError(
      "dirty_candidate",
      "Release candidate source must be clean.",
    );
  }

  const candidateCommit = runGit(["rev-parse", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/.test(candidateCommit)) {
    throw preflightError(
      "invalid_candidate_commit",
      "Release candidate commit must be immutable.",
    );
  }

  const trackedPaths = runGit(["ls-files", "-z"])
    .split("\0")
    .filter((path) => path.length > 0);
  const tracked = inspectTrackedPaths(trackedPaths);
  await assertRequiredSourcePaths();

  const artifact = includeArtifacts
    ? await inspectCurrentPlatformArtifact(target, packageJson.version)
    : null;

  return {
    schemaVersion: 1,
    status: "passed",
    target,
    nodeVersion: process.versions.node,
    candidateCommit,
    clean: true,
    trackedFiles: tracked.trackedFiles,
    sourceContracts: REQUIRED_SOURCE_PATHS.length,
    artifact,
  };
}

function parseArguments(args) {
  if (args.length === 0) {
    return false;
  }
  if (args.length === 1 && args[0] === "--artifacts") {
    return true;
  }
  throw preflightError(
    "invalid_arguments",
    "Release preflight accepts only --artifacts.",
  );
}

function loadHostContract() {
  if (platform() === "darwin") {
    return {
      name: "macOS",
      version: execBounded("/usr/bin/sw_vers", ["-productVersion"]).trim(),
    };
  }
  if (platform() === "linux") {
    return parseLinuxHostContract(readFileSync("/etc/os-release", "utf8"));
  }
  return { name: "Unsupported", version: "" };
}

async function assertRequiredSourcePaths() {
  for (const relativePath of REQUIRED_SOURCE_PATHS) {
    const metadata = await stat(join(repositoryRoot, relativePath)).catch(
      () => null,
    );
    if (metadata === null || !metadata.isFile()) {
      throw preflightError(
        "missing_source_contract",
        "Release source contract is incomplete.",
      );
    }
  }
}

async function inspectCurrentPlatformArtifact(target, packageVersion) {
  const definition =
    target === "darwin-arm64"
      ? {
          directory: "macos",
          archive: `pacium-control-${packageVersion}-darwin-arm64.tar.gz`,
          manifest:
            "Pacium Control.app/Contents/Resources/app/package-manifest.json",
        }
      : {
          directory: "linux",
          archive: `pacium-control-${packageVersion}-linux-x64.tar.gz`,
          manifest: "pacium-control/app/package-manifest.json",
        };
  const archivePath = join(
    repositoryRoot,
    "dist",
    definition.directory,
    definition.archive,
  );
  const checksumPath = `${archivePath}.sha256`;
  const metadata = await stat(archivePath).catch(() => null);
  if (
    metadata === null ||
    !metadata.isFile() ||
    metadata.size === 0 ||
    metadata.size > MAX_ARCHIVE_BYTES
  ) {
    throw preflightError(
      "missing_package_artifact",
      "Current target package artifact is unavailable or unbounded.",
    );
  }

  const checksum = (
    await readBoundedFile(checksumPath, 512).catch(() => "")
  ).trim();
  const checksumMatch = /^([a-f0-9]{64})[ ]{2}([^\s]+\.tar\.gz)$/.exec(
    checksum,
  );
  const actualHash = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  if (
    checksumMatch === null ||
    checksumMatch[1] !== actualHash ||
    checksumMatch[2] !== definition.archive
  ) {
    throw preflightError(
      "package_checksum_mismatch",
      "Current target package checksum is invalid.",
    );
  }

  const archiveEntries = execBounded("/usr/bin/tar", ["-tzf", archivePath])
    .split("\n")
    .filter((entry) => entry.length > 0);
  const archive = inspectArchivePaths(archiveEntries);
  if (!archiveEntries.includes(definition.manifest)) {
    throw preflightError(
      "missing_package_manifest",
      "Current target package manifest is missing.",
    );
  }
  const manifest = JSON.parse(
    execBounded(
      "/usr/bin/tar",
      ["-xOf", archivePath, definition.manifest],
      MAX_MANIFEST_BYTES,
    ),
  );
  const manifestSummary = validateReleaseManifest(manifest, target);
  const archiveEntrySet = new Set(
    archiveEntries.map((path) =>
      path.endsWith("/") ? path.slice(0, -1) : path,
    ),
  );
  if (manifest.files.some(({ path }) => !archiveEntrySet.has(path))) {
    throw preflightError(
      "manifest_archive_mismatch",
      "Package manifest references a missing archive entry.",
    );
  }

  return {
    archive: definition.archive,
    bytes: metadata.size,
    sha256: actualHash,
    archiveEntries: archive.archiveEntries,
    manifestFiles: manifestSummary.manifestFiles,
    releaseEligible: false,
  };
}

async function readBoundedFile(path, limit) {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > limit) {
    throw preflightError(
      "unbounded_source_file",
      "Release preflight source file is unavailable or unbounded.",
    );
  }
  return readFile(path, "utf8");
}

function runGit(args) {
  return execBounded(gitExecutable, args);
}

function execBounded(executable, args, maxBuffer = MAX_COMMAND_OUTPUT_BYTES) {
  try {
    return execFileSync(executable, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw preflightError(
      "command_failed",
      "A fixed release preflight command failed.",
    );
  }
}

function selectGitExecutable() {
  const xcodeGit = "/Applications/Xcode.app/Contents/Developer/usr/bin/git";
  if (platform() === "darwin" && existsSync(xcodeGit)) {
    return xcodeGit;
  }
  return "/usr/bin/git";
}
