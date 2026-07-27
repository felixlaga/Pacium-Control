import type { GitChangedFile } from "@pacium/contracts";

export const MAX_CHANGED_FILES = 500;
export const MAX_STATUS_RECORDS = 5_000;
export const MAX_GIT_CHANGES_OUTPUT_BYTES = 512 * 1024;
export const LARGE_CHANGED_FILE_BYTES = 1024 * 1024;

export type ParsedGitStatus = Pick<
  GitChangedFile,
  | "path"
  | "previousPath"
  | "kind"
  | "staged"
  | "unstaged"
  | "untracked"
  | "conflicted"
>;

export interface ParsedNumstat {
  path: string;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface ChangedFilesAggregation {
  files: GitChangedFile[];
  totals: {
    fileCount: number;
    additions: number;
    deletions: number;
    unavailableLineCount: number;
    conflictCount: number;
  };
  truncated: boolean;
}

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export function parsePorcelainV2(value: string): ParsedGitStatus[] {
  if (Buffer.byteLength(value) > MAX_GIT_CHANGES_OUTPUT_BYTES) {
    throw new Error("Git status output exceeded the configured bound.");
  }
  const tokens = value.split("\0");
  if (tokens.at(-1) === "") {
    tokens.pop();
  }
  const files: ParsedGitStatus[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const record = tokens[index]!;
    if (record.startsWith("# ")) {
      continue;
    }
    if (files.length >= MAX_STATUS_RECORDS) {
      throw new Error("Git status contained too many records.");
    }
    if (record.startsWith("? ")) {
      files.push(untrackedStatus(boundedPath(record.slice(2))));
      continue;
    }
    if (record.startsWith("! ")) {
      continue;
    }
    if (record.startsWith("1 ")) {
      files.push(parseOrdinaryRecord(record));
      continue;
    }
    if (record.startsWith("2 ")) {
      const previousPath = tokens[index + 1];
      if (previousPath === undefined) {
        throw new Error("Git rename record omitted its previous path.");
      }
      files.push(parseRenameRecord(record, boundedPath(previousPath)));
      index += 1;
      continue;
    }
    if (record.startsWith("u ")) {
      files.push(parseUnmergedRecord(record));
      continue;
    }
    throw new Error("Git status returned an unsupported record.");
  }

  const uniquePaths = new Set<string>();
  for (const file of files) {
    if (uniquePaths.has(file.path)) {
      throw new Error("Git status returned a duplicate current path.");
    }
    uniquePaths.add(file.path);
  }
  return files;
}

export function parseNumstat(value: string): ParsedNumstat[] {
  if (Buffer.byteLength(value) > MAX_GIT_CHANGES_OUTPUT_BYTES) {
    throw new Error("Git numstat output exceeded the configured bound.");
  }
  const records = value.split("\0");
  if (records.at(-1) === "") {
    records.pop();
  }
  const parsed: ParsedNumstat[] = [];
  const paths = new Set<string>();
  for (const record of records) {
    const firstTab = record.indexOf("\t");
    const secondTab = record.indexOf("\t", firstTab + 1);
    if (firstTab <= 0 || secondTab <= firstTab + 1) {
      throw new Error("Git numstat returned a malformed record.");
    }
    const additionsText = record.slice(0, firstTab);
    const deletionsText = record.slice(firstTab + 1, secondTab);
    const path = boundedPath(record.slice(secondTab + 1));
    if (paths.has(path)) {
      throw new Error("Git numstat returned a duplicate path.");
    }
    paths.add(path);
    const binary = additionsText === "-" && deletionsText === "-";
    if (
      !binary &&
      (!/^\d+$/.test(additionsText) || !/^\d+$/.test(deletionsText))
    ) {
      throw new Error("Git numstat returned invalid line counts.");
    }
    const additions = binary ? null : Number(additionsText);
    const deletions = binary ? null : Number(deletionsText);
    if (
      additions !== null &&
      (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions))
    ) {
      throw new Error("Git numstat line counts exceeded safe bounds.");
    }
    parsed.push({ path, additions, deletions, binary });
  }
  return parsed;
}

export function aggregateChangedFiles(
  statusFiles: readonly ParsedGitStatus[],
  numstats: readonly ParsedNumstat[],
  sizeByPath: ReadonlyMap<string, number>,
): ChangedFilesAggregation {
  const numstatByPath = new Map(numstats.map((entry) => [entry.path, entry]));
  const allFiles = statusFiles.map((status): GitChangedFile => {
    const relatedStats = [status.path, status.previousPath].flatMap((path) =>
      path === null ? [] : (numstatByPath.get(path) ?? []),
    );
    const binary = relatedStats.some((entry) => entry.binary);
    const hasNumericStats =
      relatedStats.length > 0 &&
      relatedStats.every(
        (entry) => entry.additions !== null && entry.deletions !== null,
      );
    const sizeBytes = sizeByPath.get(status.path) ?? null;
    return {
      ...status,
      additions:
        binary || !hasNumericStats
          ? null
          : relatedStats.reduce(
              (sum, entry) => sum + (entry.additions ?? 0),
              0,
            ),
      deletions:
        binary || !hasNumericStats
          ? null
          : relatedStats.reduce(
              (sum, entry) => sum + (entry.deletions ?? 0),
              0,
            ),
      binary,
      large: sizeBytes !== null && sizeBytes > LARGE_CHANGED_FILE_BYTES,
      sizeBytes,
    };
  });
  allFiles.sort(compareChangedFiles);
  const truncated = allFiles.length > MAX_CHANGED_FILES;
  const files = allFiles.slice(0, MAX_CHANGED_FILES);
  return {
    files,
    totals: {
      fileCount: files.length,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      unavailableLineCount: files.filter((file) => file.additions === null)
        .length,
      conflictCount: files.filter((file) => file.conflicted).length,
    },
    truncated,
  };
}

function parseOrdinaryRecord(record: string): ParsedGitStatus {
  const match = /^1 (\S{2}) \S+ \S+ \S+ \S+ \S+ \S+ ([\s\S]+)$/.exec(record);
  if (match === null) {
    throw new Error("Git status returned a malformed ordinary record.");
  }
  const xy = match[1]!;
  const path = boundedPath(match[2]!);
  return trackedStatus(path, null, xy, kindFromStatus(xy));
}

function parseRenameRecord(
  record: string,
  previousPath: string,
): ParsedGitStatus {
  const match = /^2 (\S{2}) \S+ \S+ \S+ \S+ \S+ \S+ ([RC]\d+) ([\s\S]+)$/.exec(
    record,
  );
  if (match === null) {
    throw new Error("Git status returned a malformed rename record.");
  }
  const xy = match[1]!;
  const path = boundedPath(match[3]!);
  const kind = match[2]!.startsWith("R") ? "renamed" : "copied";
  return trackedStatus(path, previousPath, xy, kind);
}

function parseUnmergedRecord(record: string): ParsedGitStatus {
  const match = /^u (\S{2})(?: \S+){8} ([\s\S]+)$/.exec(record);
  if (match === null) {
    throw new Error("Git status returned a malformed unmerged record.");
  }
  const xy = match[1]!;
  return {
    path: boundedPath(match[2]!),
    previousPath: null,
    kind: "conflicted",
    staged: xy[0] !== ".",
    unstaged: xy[1] !== ".",
    untracked: false,
    conflicted: true,
  };
}

function trackedStatus(
  path: string,
  previousPath: string | null,
  xy: string,
  kind: GitChangedFile["kind"],
): ParsedGitStatus {
  const conflicted = CONFLICT_CODES.has(xy);
  return {
    path,
    previousPath,
    kind: conflicted ? "conflicted" : kind,
    staged: xy[0] !== ".",
    unstaged: xy[1] !== ".",
    untracked: false,
    conflicted,
  };
}

function untrackedStatus(path: string): ParsedGitStatus {
  return {
    path,
    previousPath: null,
    kind: "untracked",
    staged: false,
    unstaged: false,
    untracked: true,
    conflicted: false,
  };
}

function kindFromStatus(xy: string): GitChangedFile["kind"] {
  if (xy.includes("D")) {
    return "deleted";
  }
  if (xy.includes("T")) {
    return "type_changed";
  }
  if (xy.includes("A")) {
    return "added";
  }
  return "modified";
}

function compareChangedFiles(
  left: GitChangedFile,
  right: GitChangedFile,
): number {
  return (
    changeRank(left) - changeRank(right) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  );
}

function changeRank(file: GitChangedFile): number {
  if (file.conflicted) {
    return 0;
  }
  if (file.staged && file.unstaged) {
    return 1;
  }
  if (file.staged) {
    return 2;
  }
  if (file.unstaged) {
    return 3;
  }
  return 4;
}

function boundedPath(value: string): string {
  const segments = value.split(/[\\/]/);
  if (
    value.length === 0 ||
    value.length > 4096 ||
    value.includes("\0") ||
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    segments.includes("..")
  ) {
    throw new Error("Git status returned an invalid path.");
  }
  return value;
}
