export {
  assertSafeManifestPath,
  octalMode,
} from "../shared/package-contract.mjs";

const SUPPORTED_NODE_VERSION = /^24\.18\.\d+$/;

export function assertLinuxBuildRuntime({
  platform,
  architecture,
  nodeVersion,
}) {
  if (platform !== "linux") {
    throw new Error("Linux packaging requires linux.");
  }
  if (architecture !== "x64") {
    throw new Error("Linux packaging requires x64.");
  }
  if (!SUPPORTED_NODE_VERSION.test(nodeVersion)) {
    throw new Error("Linux packaging requires Node.js 24.18.x.");
  }
}
