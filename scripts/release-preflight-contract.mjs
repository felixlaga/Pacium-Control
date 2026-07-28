import { normalize, sep } from "node:path";

const SUPPORTED_NODE_VERSION = /^24\.18\.\d+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MODE = /^0[0-7]{3}$/;
const MAX_TRACKED_FILES = 20_000;
const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_MANIFEST_FILES = 256;

const FORBIDDEN_DIRECTORY_SEGMENTS = new Set([
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const FORBIDDEN_ARCHIVE_DIRECTORY_SEGMENTS = new Set([
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
]);
const FORBIDDEN_BASENAMES = new Set([
  ".DS_Store",
  "pacium.json",
  "queue-state.json",
]);
const FORBIDDEN_SECRET_EXTENSIONS = [
  ".key",
  ".mobileprovision",
  ".p12",
  ".pem",
];

export function assertReleaseRuntime({
  platform,
  architecture,
  nodeVersion,
  osName,
  osVersion,
}) {
  if (!SUPPORTED_NODE_VERSION.test(nodeVersion)) {
    throw preflightError(
      "unsupported_node",
      "Release preflight requires Node.js 24.18.x.",
    );
  }

  if (platform === "darwin") {
    const macosMajor = Number.parseInt(osVersion.split(".")[0] ?? "", 10);
    if (
      architecture !== "arm64" ||
      osName !== "macOS" ||
      !Number.isInteger(macosMajor) ||
      macosMajor < 14
    ) {
      throw preflightError(
        "unsupported_host",
        "Release preflight supports Apple-silicon macOS 14 or newer.",
      );
    }
    return "darwin-arm64";
  }

  if (
    platform === "linux" &&
    architecture === "x64" &&
    osName === "Ubuntu" &&
    osVersion === "24.04"
  ) {
    return "ubuntu-24.04-linux-x64";
  }

  throw preflightError(
    "unsupported_host",
    "Release preflight supports only ADR-0017 hosts.",
  );
}

export function assertReleasePackageContract(packageJson) {
  if (
    packageJson === null ||
    typeof packageJson !== "object" ||
    packageJson.packageManager !== "pnpm@11.17.0" ||
    packageJson.engines?.node !== ">=24.18.0 <25" ||
    packageJson.private !== true
  ) {
    throw preflightError(
      "invalid_root_contract",
      "Root runtime and package-manager pins must match the release contract.",
    );
  }
}

export function parseLinuxHostContract(contents) {
  const values = new Map();
  for (const line of contents.split("\n")) {
    const match = /^([A-Z_]+)=(?:"([^"]*)"|([^#\s]*))$/.exec(line);
    if (match !== null) {
      values.set(match[1].toLowerCase(), match[2] ?? match[3] ?? "");
    }
  }
  return {
    name: values.get("id") === "ubuntu" ? "Ubuntu" : "Unsupported",
    version: values.get("version_id") ?? "",
  };
}

export function inspectTrackedPaths(paths) {
  assertPathCollection(paths, MAX_TRACKED_FILES, "tracked");
  const forbidden = paths.filter(isForbiddenReleasePath);
  if (forbidden.length > 0) {
    throw preflightError(
      "forbidden_tracked_path",
      "Tracked source contains a forbidden release path.",
    );
  }
  return { trackedFiles: paths.length };
}

export function inspectArchivePaths(paths) {
  assertPathCollection(paths, MAX_ARCHIVE_ENTRIES, "archive");
  const normalizedPaths = paths.map((path) =>
    path.endsWith("/") ? path.slice(0, -1) : path,
  );
  if (
    normalizedPaths.some(
      (path) =>
        path.length === 0 ||
        path.startsWith("/") ||
        path.includes("\\") ||
        normalize(path) === ".." ||
        normalize(path).startsWith(`..${sep}`),
    )
  ) {
    throw preflightError(
      "unsafe_archive_path",
      "Package archive contains an unsafe path.",
    );
  }
  if (normalizedPaths.some(isForbiddenArchivePath)) {
    throw preflightError(
      "forbidden_archive_path",
      "Package archive contains a forbidden release path.",
    );
  }
  return { archiveEntries: normalizedPaths.length };
}

export function validateReleaseManifest(manifest, expectedTarget) {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    manifest.schemaVersion !== 1 ||
    manifest.packageVersion !== "0.0.0" ||
    manifest.protocolVersion !== 24 ||
    manifest.runtime?.nodeRequirement !== "24.18.x" ||
    manifest.runtime?.nodeBundled !== false ||
    manifest.stateOwnership !== "external-preserved" ||
    manifest.distribution?.releaseEligible !== false ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0 ||
    manifest.files.length > MAX_MANIFEST_FILES
  ) {
    throw preflightError(
      "invalid_package_manifest",
      "Package manifest does not match the bounded release contract.",
    );
  }

  const actualTarget =
    manifest.target?.platform === "darwin" &&
    manifest.target?.architecture === "arm64"
      ? "darwin-arm64"
      : manifest.target?.platform === "linux" &&
          manifest.target?.architecture === "x64" &&
          manifest.target?.distribution === "ubuntu" &&
          manifest.target?.distributionVersion === "24.04"
        ? "ubuntu-24.04-linux-x64"
        : null;
  if (actualTarget !== expectedTarget) {
    throw preflightError(
      "package_target_mismatch",
      "Package manifest target does not match the current supported host.",
    );
  }

  if (
    (expectedTarget === "darwin-arm64" &&
      (manifest.distribution.developerIdSigned !== false ||
        manifest.distribution.notarized !== false)) ||
    (expectedTarget === "ubuntu-24.04-linux-x64" &&
      (manifest.distribution.artifactSigned !== false ||
        manifest.distribution.distroNative !== false))
  ) {
    throw preflightError(
      "unsupported_distribution_claim",
      "Development package distribution claims must remain explicit.",
    );
  }

  const paths = [];
  for (const file of manifest.files) {
    if (
      file === null ||
      typeof file !== "object" ||
      typeof file.path !== "string" ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !SHA256.test(file.sha256) ||
      !MODE.test(file.mode)
    ) {
      throw preflightError(
        "invalid_package_manifest",
        "Package manifest file metadata is invalid.",
      );
    }
    paths.push(file.path);
  }
  if (new Set(paths).size !== paths.length) {
    throw preflightError(
      "duplicate_manifest_path",
      "Package manifest paths must be unique.",
    );
  }
  inspectArchivePaths(paths);
  return { manifestFiles: paths.length };
}

export function isForbiddenReleasePath(path) {
  const segments = path.split("/");
  const basename = segments.at(-1) ?? "";
  if (segments.some((segment) => FORBIDDEN_DIRECTORY_SEGMENTS.has(segment))) {
    return true;
  }
  if (FORBIDDEN_BASENAMES.has(basename)) {
    return true;
  }
  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    basename !== ".env.example"
  ) {
    return true;
  }
  return FORBIDDEN_SECRET_EXTENSIONS.some((extension) =>
    basename.endsWith(extension),
  );
}

export function preflightError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertPathCollection(paths, limit, label) {
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > limit ||
    paths.some(
      (path) =>
        typeof path !== "string" ||
        path.length === 0 ||
        path.length > 4_096 ||
        [...path].some((character) => {
          const codePoint = character.codePointAt(0);
          return (
            codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
          );
        }),
    )
  ) {
    throw preflightError(
      `invalid_${label}_inventory`,
      `${label} inventory is not a bounded path collection.`,
    );
  }
}

function isForbiddenArchivePath(path) {
  const segments = path.split("/");
  const basename = segments.at(-1) ?? "";
  return (
    segments.some((segment) =>
      FORBIDDEN_ARCHIVE_DIRECTORY_SEGMENTS.has(segment),
    ) ||
    FORBIDDEN_BASENAMES.has(basename) ||
    ((basename === ".env" || basename.startsWith(".env.")) &&
      basename !== ".env.example") ||
    FORBIDDEN_SECRET_EXTENSIONS.some((extension) =>
      basename.endsWith(extension),
    )
  );
}
