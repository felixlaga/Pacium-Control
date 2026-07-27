import { rm } from "node:fs/promises";

export default async function globalTeardown(): Promise<void> {
  for (const directory of [
    process.env.PACIUM_E2E_CONFIG_DIRECTORY,
    process.env.PACIUM_E2E_STATE_DIRECTORY,
  ]) {
    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
    }
  }
}
