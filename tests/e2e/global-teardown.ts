import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default async function globalTeardown(): Promise<void> {
  if (
    process.env.PACIUM_E2E_TMUX_EXECUTABLE !== undefined &&
    process.env.PACIUM_TMUX_SOCKET !== undefined
  ) {
    await execFileAsync(process.env.PACIUM_E2E_TMUX_EXECUTABLE, [
      "-S",
      process.env.PACIUM_TMUX_SOCKET,
      "kill-server",
    ]).catch(() => undefined);
  }
  for (const directory of [
    process.env.PACIUM_E2E_CONFIG_DIRECTORY,
    process.env.PACIUM_E2E_PROVIDER_DIRECTORY,
    process.env.PACIUM_E2E_STATE_DIRECTORY,
    process.env.PACIUM_E2E_TMUX_DIRECTORY,
  ]) {
    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
    }
  }
}
