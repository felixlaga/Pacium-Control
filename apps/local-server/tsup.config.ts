import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/package-launcher.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  external: ["node-pty"],
  noExternal: ["@pacium/contracts"],
});
