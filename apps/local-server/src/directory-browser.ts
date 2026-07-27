import { lstat, readdir, realpath, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

import {
  MAX_DIRECTORY_ENTRIES,
  MAX_DIRECTORY_PATH_CHARS,
  type DirectoryEntry,
  type DirectoryListing,
} from "@pacium/contracts";

export class DirectoryBrowserError extends Error {
  public constructor(
    public readonly code: "INVALID_DIRECTORY" | "DIRECTORY_UNREADABLE",
    message: string,
  ) {
    super(message);
  }
}

export async function browseHostDirectories(input: {
  requestedPath?: string;
  defaultPath: string;
  homePath: string;
  maxEntries?: number;
}): Promise<DirectoryListing> {
  const requestedPath = input.requestedPath?.trim() || input.defaultPath;
  if (
    !isAbsolute(requestedPath) ||
    requestedPath.length > MAX_DIRECTORY_PATH_CHARS
  ) {
    throw new DirectoryBrowserError(
      "INVALID_DIRECTORY",
      "Choose an existing absolute directory on the Pacium host.",
    );
  }

  let currentPath: string;
  try {
    currentPath = await realpath(requestedPath);
    const details = await stat(currentPath);
    if (!details.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    throw new DirectoryBrowserError(
      "INVALID_DIRECTORY",
      "That host directory does not exist or is not accessible.",
    );
  }

  let children: Dirent[];
  try {
    children = await readdir(currentPath, { withFileTypes: true });
  } catch {
    throw new DirectoryBrowserError(
      "DIRECTORY_UNREADABLE",
      "Pacium cannot read that directory with the current user permissions.",
    );
  }

  const limit = Math.max(
    1,
    Math.min(input.maxEntries ?? MAX_DIRECTORY_ENTRIES, MAX_DIRECTORY_ENTRIES),
  );
  const directories = children
    .filter((entry) => entry.isDirectory())
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  const truncated = directories.length > limit;
  const selected = directories.slice(0, limit);
  const entries: DirectoryEntry[] = await Promise.all(
    selected.map(async (entry) => {
      const path = join(currentPath, entry.name);
      return {
        name: entry.name,
        path,
        hidden: entry.name.startsWith("."),
        repository: await hasRepositoryMarker(path),
      };
    }),
  );

  const parent = dirname(currentPath);
  return {
    currentPath,
    parentPath: parent === currentPath ? null : parent,
    homePath: input.homePath,
    defaultPath: input.defaultPath,
    entries,
    truncated,
  };
}

async function hasRepositoryMarker(path: string): Promise<boolean> {
  try {
    const marker = await lstat(join(path, ".git"));
    return marker.isDirectory() || marker.isFile();
  } catch {
    return false;
  }
}
