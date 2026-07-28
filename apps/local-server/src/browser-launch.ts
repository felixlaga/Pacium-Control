import { spawn } from "node:child_process";

export interface BrowserChild {
  once(event: "spawn", listener: () => void): BrowserChild;
  once(event: "error", listener: () => void): BrowserChild;
  unref(): void;
}

export type BrowserSpawner = (
  executable: string,
  arguments_: string[],
  options: {
    detached: true;
    stdio: "ignore";
  },
) => BrowserChild;

export interface BrowserLaunchOptions {
  platform?: NodeJS.Platform;
  spawnBrowser?: BrowserSpawner;
}

export async function openPaciumBrowser(
  url: string,
  {
    platform = process.platform,
    spawnBrowser = spawn,
  }: BrowserLaunchOptions = {},
): Promise<boolean> {
  if (!isCanonicalPaciumUrl(url)) {
    return false;
  }
  const executable = browserOpenExecutable(platform);
  if (executable === null) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    try {
      const child = spawnBrowser(executable, [url], {
        detached: true,
        stdio: "ignore",
      });
      let settled = false;
      const finish = (result: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };
      child.once("spawn", () => {
        child.unref();
        finish(true);
      });
      child.once("error", () => {
        finish(false);
      });
    } catch {
      resolve(false);
    }
  });
}

export function browserOpenExecutable(
  platform: NodeJS.Platform,
): string | null {
  if (platform === "darwin") {
    return "/usr/bin/open";
  }
  if (platform === "linux") {
    return "/usr/bin/xdg-open";
  }
  return null;
}

export function isCanonicalPaciumUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const port = Number(url.port);
  return (
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    Number.isInteger(port) &&
    port >= 1_024 &&
    port <= 65_535 &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    value === `http://127.0.0.1:${port}`
  );
}
