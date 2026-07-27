import { describe, expect, it } from "vitest";

import {
  addRecentDirectory,
  directoryBreadcrumbs,
  loadRecentDirectories,
  parseRecentDirectories,
  resolveDirectoryPickerKeyAction,
  saveRecentDirectories,
  serializeRecentDirectories,
} from "./directory-picker-model.js";

describe("directory picker model", () => {
  it("keeps six unique recent host paths in newest-first order", () => {
    const paths = Array.from({ length: 7 }, (_, index) => `/work/${index}`);
    expect(addRecentDirectory(paths, "/work/3")).toEqual([
      "/work/3",
      "/work/0",
      "/work/1",
      "/work/2",
      "/work/4",
      "/work/5",
    ]);
  });

  it("round trips versioned recent paths and rejects malformed state", () => {
    const paths = ["/work/alpha", "/work/beta"];
    expect(parseRecentDirectories(serializeRecentDirectories(paths))).toEqual(
      paths,
    );
    expect(parseRecentDirectories("{")).toEqual([]);
    expect(
      parseRecentDirectories(
        JSON.stringify({ version: 1, paths: ["relative"] }),
      ),
    ).toEqual([]);
  });

  it("builds navigable root-first breadcrumbs", () => {
    expect(directoryBreadcrumbs("/Users/felix/Projects")).toEqual([
      { label: "Root", path: "/" },
      { label: "Users", path: "/Users" },
      { label: "felix", path: "/Users/felix" },
      { label: "Projects", path: "/Users/felix/Projects" },
    ]);
  });

  it("fails soft when browser-local recent storage is unavailable", () => {
    const unavailable = {
      getItem: () => {
        throw new Error("storage denied");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };

    expect(loadRecentDirectories(unavailable, "recent")).toEqual([]);
    expect(
      saveRecentDirectories(unavailable, "recent", ["/work/pacium"]),
    ).toBe(false);
  });

  it("loads and saves versioned recents through the storage boundary", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(saveRecentDirectories(storage, "recent", ["/work/pacium"])).toBe(
      true,
    );
    expect(loadRecentDirectories(storage, "recent")).toEqual([
      "/work/pacium",
    ]);
  });

  it("resolves compact picker keyboard movement deterministically", () => {
    expect(
      resolveDirectoryPickerKeyAction({
        ctrlKey: false,
        key: "l",
        metaKey: true,
        resultCount: 3,
        source: "dialog",
      }),
    ).toEqual({ kind: "edit-path" });
    expect(
      resolveDirectoryPickerKeyAction({
        ctrlKey: true,
        key: "Enter",
        metaKey: false,
        resultCount: 3,
        source: "dialog",
      }),
    ).toEqual({ kind: "confirm-current" });
    expect(
      resolveDirectoryPickerKeyAction({
        ctrlKey: false,
        key: "ArrowDown",
        metaKey: false,
        resultCount: 3,
        source: "filter",
      }),
    ).toEqual({ kind: "focus-result", index: 0 });
    expect(
      resolveDirectoryPickerKeyAction({
        ctrlKey: false,
        key: "ArrowUp",
        metaKey: false,
        resultCount: 3,
        resultIndex: 0,
        source: "result",
      }),
    ).toEqual({ kind: "focus-filter" });
    expect(
      resolveDirectoryPickerKeyAction({
        ctrlKey: false,
        key: "End",
        metaKey: false,
        resultCount: 3,
        resultIndex: 1,
        source: "result",
      }),
    ).toEqual({ kind: "focus-result", index: 2 });
  });
});
