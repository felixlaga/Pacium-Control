import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";

export interface HostActions {
  revealPath(path: string): Promise<void>;
}

export interface HostCommand {
  executable: string;
  args: readonly string[];
}

export type HostCommandRunner = (
  executable: string,
  args: readonly string[],
) => Promise<void>;

export class HostActionError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function revealCommand(
  platform: NodeJS.Platform,
  path: string,
): HostCommand {
  if (!isAbsolute(path)) {
    throw new HostActionError(
      "INVALID_REVEAL_PATH",
      "Pacium can reveal only an absolute server-owned repository path.",
    );
  }
  if (platform === "darwin") {
    return { executable: "/usr/bin/open", args: [path] };
  }
  if (platform === "linux") {
    return { executable: "/usr/bin/xdg-open", args: [path] };
  }
  throw new HostActionError(
    "REVEAL_UNSUPPORTED",
    "Revealing a repository is not supported on this Pacium host.",
  );
}

export function createHostActions(
  platform: NodeJS.Platform = process.platform,
  run: HostCommandRunner = runHostCommand,
): HostActions {
  return {
    async revealPath(path) {
      const command = revealCommand(platform, path);
      try {
        await run(command.executable, command.args);
      } catch {
        throw new HostActionError(
          "REVEAL_FAILED",
          "Pacium could not open the repository on the host. Copy its path and open it manually.",
          true,
        );
      }
    },
  };
}

function runHostCommand(
  executable: string,
  args: readonly string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(executable, [...args], { windowsHide: true }, (error) => {
      if (error === null) {
        resolve();
      } else {
        reject(new Error(error.message, { cause: error }));
      }
    });
  });
}
