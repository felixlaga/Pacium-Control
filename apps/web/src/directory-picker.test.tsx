import type { DirectoryListing } from "@pacium/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DirectoryPicker } from "./directory-picker.js";

const listing: DirectoryListing = {
  currentPath: "/work/pacium",
  defaultPath: "/work/pacium",
  entries: [],
  homePath: "/Users/operator",
  parentPath: "/work",
  truncated: false,
};

describe("directory picker semantics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the host picker modal and its loading state", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    const markup = renderToStaticMarkup(
      <DirectoryPicker
        initialPath={listing.currentPath}
        loadDirectories={() => Promise.resolve(listing)}
        onCancel={() => {}}
        onSelect={() => {}}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="directory-picker-title"');
    expect(markup).toContain('aria-label="Back to new terminal"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Reading host folders");
  });
});
