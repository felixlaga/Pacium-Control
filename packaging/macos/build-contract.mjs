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

export function assertReproducibleMachOMetadata({
  loadCommands,
  symbols,
  label,
}) {
  const uuidCommands = loadCommands.match(/\bcmd LC_UUID\b/g) ?? [];
  const signatureCommands =
    loadCommands.match(/\bcmd LC_CODE_SIGNATURE\b/g) ?? [];
  if (uuidCommands.length !== 1 || signatureCommands.length !== 1) {
    throw new Error(
      `${label} must retain one loadable UUID and ad-hoc signature.`,
    );
  }
  if (symbols.split("\n").some((line) => /\s(?:SO|OSO)\s/.test(line))) {
    throw new Error(`${label} contains non-reproducible source metadata.`);
  }
}
