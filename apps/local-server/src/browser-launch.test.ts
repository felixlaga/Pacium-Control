import { describe, expect, it, vi } from "vitest";

import {
  browserOpenExecutable,
  isCanonicalPaciumUrl,
  openPaciumBrowser,
  type BrowserChild,
  type BrowserSpawner,
} from "./browser-launch.js";

describe("browser launch", () => {
  it("opens one canonical loopback URL through the fixed macOS executable", async () => {
    const child = createBrowserChild();
    const spawnBrowser = vi.fn<BrowserSpawner>(() => child);

    const result = openPaciumBrowser("http://127.0.0.1:4174", {
      platform: "darwin",
      spawnBrowser,
    });
    child.emit("spawn");

    await expect(result).resolves.toBe(true);
    expect(spawnBrowser).toHaveBeenCalledWith(
      "/usr/bin/open",
      ["http://127.0.0.1:4174"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    expect(child.unref.mock.calls).toHaveLength(1);
  });

  it("reports a launch error without throwing", async () => {
    const child = createBrowserChild();
    const result = openPaciumBrowser("http://127.0.0.1:4174", {
      platform: "darwin",
      spawnBrowser: () => child,
    });
    child.emit("error");

    await expect(result).resolves.toBe(false);
  });

  it.each([
    "https://127.0.0.1:4174",
    "http://localhost:4174",
    "http://127.0.0.1:80",
    "http://127.0.0.1:4174/path",
    "http://127.0.0.1:4174?command=open",
    "not-a-url",
  ])("rejects a non-canonical browser target: %s", async (url) => {
    const spawnBrowser = vi.fn<BrowserSpawner>();

    expect(isCanonicalPaciumUrl(url)).toBe(false);
    await expect(
      openPaciumBrowser(url, { platform: "darwin", spawnBrowser }),
    ).resolves.toBe(false);
    expect(spawnBrowser).not.toHaveBeenCalled();
  });

  it("selects only the fixed supported host opener", async () => {
    expect(browserOpenExecutable("darwin")).toBe("/usr/bin/open");
    expect(browserOpenExecutable("linux")).toBe("/usr/bin/xdg-open");
    expect(browserOpenExecutable("win32")).toBeNull();

    const linuxChild = createBrowserChild();
    const spawnBrowser = vi.fn<BrowserSpawner>(() => linuxChild);
    const result = openPaciumBrowser("http://127.0.0.1:4174", {
      platform: "linux",
      spawnBrowser,
    });
    linuxChild.emit("spawn");
    await expect(result).resolves.toBe(true);
    expect(spawnBrowser).toHaveBeenCalledWith(
      "/usr/bin/xdg-open",
      ["http://127.0.0.1:4174"],
      {
        detached: true,
        stdio: "ignore",
      },
    );

    await expect(
      openPaciumBrowser("http://127.0.0.1:4174", {
        platform: "win32",
        spawnBrowser,
      }),
    ).resolves.toBe(false);
    expect(spawnBrowser).toHaveBeenCalledOnce();
  });
});

function createBrowserChild(): BrowserChild & {
  emit(event: "spawn" | "error"): void;
  unref: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<"spawn" | "error", () => void>();
  const child = {
    once(event: "spawn" | "error", listener: () => void) {
      listeners.set(event, listener);
      return child;
    },
    emit(event: "spawn" | "error") {
      listeners.get(event)?.();
    },
    unref: vi.fn(),
  };
  return child;
}
