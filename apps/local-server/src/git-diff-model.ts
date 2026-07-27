import {
  MAX_GIT_DIFF_BYTES,
  MAX_GIT_DIFF_LINES,
  MAX_GIT_DIFF_LINE_CHARS,
  type GitDiffSection,
} from "@pacium/contracts";

export interface RawDiffSection {
  source: GitDiffSection["source"];
  patch: string;
}

export type NormalizedDiff =
  | {
      status: "ready";
      sections: GitDiffSection[];
      patchBytes: number;
      patchLines: number;
    }
  | {
      status: "empty" | "binary" | "too_large";
      sections: [];
      patchBytes: 0;
      patchLines: 0;
    };

export class InvalidDiffOutput extends Error {
  public constructor() {
    super("Git returned invalid diff output.");
  }
}

export function normalizeDiffSections(
  rawSections: readonly RawDiffSection[],
): NormalizedDiff {
  const populated = rawSections.filter(({ patch }) => patch.length > 0);
  validateSectionSources(populated);
  if (populated.length === 0) {
    return unavailable("empty");
  }
  if (populated.some(({ patch }) => isBinaryPatch(patch))) {
    return unavailable("binary");
  }

  const sections: GitDiffSection[] = [];
  let patchBytes = 0;
  let patchLines = 0;
  for (const raw of populated) {
    if (raw.patch.includes("\0") || raw.patch.includes("\uFFFD")) {
      throw new InvalidDiffOutput();
    }
    const byteCount = new TextEncoder().encode(raw.patch).byteLength;
    const lines = raw.patch.split("\n");
    const lineCount = raw.patch.endsWith("\n")
      ? lines.length - 1
      : lines.length;
    if (
      byteCount > MAX_GIT_DIFF_BYTES ||
      lineCount > MAX_GIT_DIFF_LINES ||
      lines.some((line) => line.length > MAX_GIT_DIFF_LINE_CHARS)
    ) {
      return unavailable("too_large");
    }
    patchBytes += byteCount;
    patchLines += lineCount;
    if (patchBytes > MAX_GIT_DIFF_BYTES || patchLines > MAX_GIT_DIFF_LINES) {
      return unavailable("too_large");
    }
    sections.push({
      source: raw.source,
      patch: raw.patch,
      byteCount,
      lineCount,
    });
  }
  return {
    status: "ready",
    sections,
    patchBytes,
    patchLines,
  };
}

function isBinaryPatch(patch: string): boolean {
  return patch
    .split("\n")
    .some(
      (line) =>
        line === "GIT binary patch" ||
        /^Binary files .+ differ$/.test(line) ||
        /^Binary file .+ has changed$/.test(line),
    );
}

function validateSectionSources(sections: readonly RawDiffSection[]): void {
  const sources = sections.map(({ source }) => source);
  if (
    sections.length > 2 ||
    new Set(sources).size !== sources.length ||
    ((sources.includes("combined") || sources.includes("untracked")) &&
      sources.length !== 1)
  ) {
    throw new InvalidDiffOutput();
  }
}

function unavailable(
  status: Exclude<NormalizedDiff["status"], "ready">,
): NormalizedDiff {
  return {
    status,
    sections: [],
    patchBytes: 0,
    patchLines: 0,
  };
}
