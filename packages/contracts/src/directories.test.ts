import { describe, expect, it } from "vitest";

import {
  DirectoryListingSchema,
  MAX_DIRECTORY_ENTRIES,
} from "./directories.js";

describe("directory listing contract", () => {
  it("accepts a bounded host directory listing", () => {
    expect(
      DirectoryListingSchema.parse({
        currentPath: "/work",
        parentPath: "/",
        homePath: "/Users/operator",
        defaultPath: "/work",
        entries: [
          {
            name: "project",
            path: "/work/project",
            hidden: false,
            repository: true,
          },
        ],
        truncated: false,
      }),
    ).toMatchObject({ currentPath: "/work" });
  });

  it("rejects more than the advertised entry limit", () => {
    const entries = Array.from(
      { length: MAX_DIRECTORY_ENTRIES + 1 },
      (_, index) => ({
        name: `folder-${index}`,
        path: `/work/folder-${index}`,
        hidden: false,
        repository: false,
      }),
    );
    expect(() =>
      DirectoryListingSchema.parse({
        currentPath: "/work",
        parentPath: "/",
        homePath: "/Users/operator",
        defaultPath: "/work",
        entries,
        truncated: true,
      }),
    ).toThrow();
  });
});
