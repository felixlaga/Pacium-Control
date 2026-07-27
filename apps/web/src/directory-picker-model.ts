import { MAX_DIRECTORY_PATH_CHARS } from "@pacium/contracts";

const MAX_RECENT_DIRECTORIES = 6;

export interface DirectoryBreadcrumb {
  label: string;
  path: string;
}

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

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}
