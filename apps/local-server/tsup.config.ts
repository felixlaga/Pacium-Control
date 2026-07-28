import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/package-launcher.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  sourcemap: true,
  shims: true,
  banner: {
    js: 'import { createRequire as __paciumCreateRequire } from "node:module"; const require = __paciumCreateRequire(import.meta.url);',
  },
  clean: true,
  external: ["node-pty"],
  noExternal: [
    "@pacium/contracts",
    "@xterm/addon-serialize",
    "@xterm/headless",
    "ws",
    "zod",
  ],
});
