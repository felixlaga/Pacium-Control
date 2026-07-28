import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "html"],
    },
    include: [
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "packaging/**/*.test.mjs",
      "packages/**/*.test.ts",
    ],
    restoreMocks: true,
  },
});
