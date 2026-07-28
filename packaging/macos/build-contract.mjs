import { isAbsolute, normalize, sep } from "node:path";

const SUPPORTED_NODE_VERSION = /^24\.18\.\d+$/;

export function assertMacosBuildRuntime({
  platform,
  architecture,
  nodeVersion,
}) {
  if (platform !== "darwin") {
    throw new Error("macOS packaging requires darwin.");
  }
  if (architecture !== "arm64") {
    throw new Error("macOS packaging requires arm64.");
  }
  if (!SUPPORTED_NODE_VERSION.test(nodeVersion)) {
    throw new Error("macOS packaging requires Node.js 24.18.x.");
  }
}

export function assertSafeManifestPath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4_096 ||
    isAbsolute(value) ||
    normalize(value).startsWith(`..${sep}`) ||
    normalize(value) === ".." ||
    value.includes("\\") ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
      );
    })
  ) {
    throw new Error("Package manifests require bounded relative POSIX paths.");
  }
}

export function octalMode(mode) {
  return (mode & 0o777).toString(8).padStart(4, "0");
}
