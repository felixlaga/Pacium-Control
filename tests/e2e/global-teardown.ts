import { rm } from "node:fs/promises";

export default async function globalTeardown(): Promise<void> {
  const directory = process.env.PACIUM_E2E_CONFIG_DIRECTORY;
  if (directory !== undefined) {
    await rm(directory, { force: true, recursive: true });
  }
}
