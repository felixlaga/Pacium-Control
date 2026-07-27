import { MAX_DIRECTORY_PATH_CHARS } from "@pacium/contracts";

const MAX_RECENT_DIRECTORIES = 6;

export interface DirectoryBreadcrumb {
  label: string;
  path: string;
}

export interface RecentDirectoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type DirectoryPickerKeyAction =
  | { kind: "confirm-current" }
  | { kind: "edit-path" }
  | { kind: "focus-filter" }
  | { kind: "focus-result"; index: number }
  | null;

export function parseRecentDirectories(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  try {
    const candidate = JSON.parse(value) as unknown;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("version" in candidate) ||
      candidate.version !== 1 ||
      !("paths" in candidate) ||
      !Array.isArray(candidate.paths)
    ) {
      return [];
    }
    const paths = candidate.paths as unknown[];
    if (
      paths.some(
        (path) =>
          typeof path !== "string" ||
          !path.startsWith("/") ||
          path.length > MAX_DIRECTORY_PATH_CHARS,
      )
    ) {
      return [];
    }
    return uniquePaths(paths as string[]).slice(0, MAX_RECENT_DIRECTORIES);
  } catch {
    return [];
  }
}

export function addRecentDirectory(
  paths: string[],
  selectedPath: string,
): string[] {
  return uniquePaths([selectedPath, ...paths]).slice(0, MAX_RECENT_DIRECTORIES);
}

export function serializeRecentDirectories(paths: string[]): string {
  return JSON.stringify({
    version: 1,
    paths: uniquePaths(paths).slice(0, MAX_RECENT_DIRECTORIES),
  });
}

export function loadRecentDirectories(
  storage: RecentDirectoryStorage,
  key: string,
): string[] {
  try {
    return parseRecentDirectories(storage.getItem(key));
  } catch {
    return [];
  }
}

export function saveRecentDirectories(
  storage: RecentDirectoryStorage,
  key: string,
  paths: string[],
): boolean {
  try {
    storage.setItem(key, serializeRecentDirectories(paths));
    return true;
  } catch {
    return false;
  }
}

export function directoryBreadcrumbs(path: string): DirectoryBreadcrumb[] {
  const segments = path.split("/").filter(Boolean);
  const breadcrumbs: DirectoryBreadcrumb[] = [{ label: "Root", path: "/" }];
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    breadcrumbs.push({ label: segment, path: current });
  }
  return breadcrumbs;
}

export function resolveDirectoryPickerKeyAction(input: {
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  resultCount: number;
  resultIndex?: number;
  source: "dialog" | "filter" | "result";
}): DirectoryPickerKeyAction {
  const commandKey = input.ctrlKey || input.metaKey;
  if (commandKey && input.key.toLocaleLowerCase() === "l") {
    return { kind: "edit-path" };
  }
  if (commandKey && input.key === "Enter") {
    return { kind: "confirm-current" };
  }
  if (
    input.source === "filter" &&
    input.key === "ArrowDown" &&
    input.resultCount > 0
  ) {
    return { kind: "focus-result", index: 0 };
  }
  if (
    input.source !== "result" ||
    input.resultIndex === undefined ||
    input.resultCount === 0
  ) {
    return null;
  }
  if (input.key === "ArrowDown") {
    return {
      kind: "focus-result",
      index: Math.min(input.resultIndex + 1, input.resultCount - 1),
    };
  }
  if (input.key === "ArrowUp") {
    return input.resultIndex === 0
      ? { kind: "focus-filter" }
      : { kind: "focus-result", index: input.resultIndex - 1 };
  }
  if (input.key === "Home") {
    return { kind: "focus-result", index: 0 };
  }
  if (input.key === "End") {
    return { kind: "focus-result", index: input.resultCount - 1 };
  }
  return null;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}
