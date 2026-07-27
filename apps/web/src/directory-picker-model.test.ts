import { describe, expect, it } from "vitest";

import {
  addRecentDirectory,
  directoryBreadcrumbs,
  parseRecentDirectories,
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
});
