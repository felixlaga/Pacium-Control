export {
  assertSafeManifestPath,
  octalMode,
} from "../shared/package-contract.mjs";

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
