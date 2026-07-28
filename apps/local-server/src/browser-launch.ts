import { spawn } from "node:child_process";

const OPEN_EXECUTABLE = "/usr/bin/open";

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

export async function openPaciumBrowser(
  url: string,
  spawnBrowser: BrowserSpawner = spawn as BrowserSpawner,
): Promise<boolean> {
  if (!isCanonicalPaciumUrl(url)) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    try {
      const child = spawnBrowser(OPEN_EXECUTABLE, [url], {
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
