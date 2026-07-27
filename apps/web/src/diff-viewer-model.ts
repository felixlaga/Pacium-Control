import type { GitDiffSection } from "@pacium/contracts";

export type DiffLineKind =
  | "diff_header"
  | "file_header"
  | "hunk_header"
  | "addition"
  | "deletion"
  | "context"
  | "metadata";

export interface DiffViewLine {
  id: string;
  hunkId: string | null;
  kind: DiffLineKind;
  newLine: number | null;
  oldLine: number | null;
  text: string;
}

export interface DiffViewSection {
  source: GitDiffSection["source"];
  lines: DiffViewLine[];
  hunkIds: string[];
}

export interface DiffViewDocument {
  sections: DiffViewSection[];
  hunkIds: string[];
}

const MAX_DIFF_SEARCH_CHARS = 200;

export function parseDiffSections(
  sections: readonly GitDiffSection[],
): DiffViewDocument {
  const parsed = sections.map((section, sectionIndex) =>
    parseSection(section, sectionIndex),
  );
  return {
    sections: parsed,
    hunkIds: parsed.flatMap(({ hunkIds }) => hunkIds),
  };
}

export function normalizeDiffSearch(query: string): string {
  return query.slice(0, MAX_DIFF_SEARCH_CHARS).toLocaleLowerCase();
}

export function matchingDiffLineIds(
  document: DiffViewDocument,
  query: string,
): Set<string> {
  const normalized = normalizeDiffSearch(query);
  if (normalized.length === 0) {
    return new Set();
  }
  return new Set(
    document.sections.flatMap(({ lines }) =>
      lines.flatMap((line) =>
        line.text.toLocaleLowerCase().includes(normalized) ? [line.id] : [],
      ),
    ),
  );
}

export function visibleDiffLines(
  section: DiffViewSection,
  collapsedHunks: ReadonlySet<string>,
): DiffViewLine[] {
  return section.lines.filter(
    (line) =>
      line.hunkId === null ||
      !collapsedHunks.has(line.hunkId) ||
      line.kind === "hunk_header",
  );
}

export function hiddenDiffLineCount(
  section: DiffViewSection,
  hunkId: string,
): number {
  return section.lines.filter(
    (line) => line.hunkId === hunkId && line.kind !== "hunk_header",
  ).length;
}

export function toggleCollapsedHunk(
  collapsedHunks: ReadonlySet<string>,
  hunkId: string,
): Set<string> {
  const next = new Set(collapsedHunks);
  if (next.has(hunkId)) {
    next.delete(hunkId);
  } else {
    next.add(hunkId);
  }
  return next;
}

function parseSection(
  section: GitDiffSection,
  sectionIndex: number,
): DiffViewSection {
  const rawLines = splitPatchLines(section.patch);
  const lines: DiffViewLine[] = [];
  const hunkIds: string[] = [];
  let currentHunkId: string | null = null;
  let oldLine: number | null = null;
  let newLine: number | null = null;

  for (let index = 0; index < rawLines.length; index += 1) {
    const text = rawLines[index]!;
    const ordinaryHunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (ordinaryHunk !== null) {
      currentHunkId = `${sectionIndex}:hunk:${hunkIds.length}`;
      hunkIds.push(currentHunkId);
      oldLine = Number(ordinaryHunk[1]);
      newLine = Number(ordinaryHunk[2]);
      lines.push(
        viewLine(sectionIndex, index, currentHunkId, "hunk_header", text),
      );
      continue;
    }
    if (text.startsWith("@@@")) {
      currentHunkId = `${sectionIndex}:hunk:${hunkIds.length}`;
      hunkIds.push(currentHunkId);
      oldLine = null;
      newLine = null;
      lines.push(
        viewLine(sectionIndex, index, currentHunkId, "hunk_header", text),
      );
      continue;
    }

    const line = classifyLine({
      currentHunkId,
      index,
      newLine,
      oldLine,
      sectionIndex,
      text,
    });
    lines.push(line);
    if (currentHunkId !== null && oldLine !== null && newLine !== null) {
      if (line.kind === "context") {
        oldLine += 1;
        newLine += 1;
      } else if (line.kind === "deletion") {
        oldLine += 1;
      } else if (line.kind === "addition") {
        newLine += 1;
      }
    }
  }
  return { source: section.source, lines, hunkIds };
}

function classifyLine(input: {
  currentHunkId: string | null;
  index: number;
  newLine: number | null;
  oldLine: number | null;
  sectionIndex: number;
  text: string;
}): DiffViewLine {
  const { currentHunkId, index, newLine, oldLine, sectionIndex, text } = input;
  if (currentHunkId === null) {
    if (text.startsWith("--- ") || text.startsWith("+++ ")) {
      return viewLine(sectionIndex, index, null, "file_header", text);
    }
    return viewLine(
      sectionIndex,
      index,
      null,
      text.startsWith("diff --git ") ? "diff_header" : "metadata",
      text,
    );
  }
  if (text.startsWith("\\ ")) {
    return viewLine(sectionIndex, index, currentHunkId, "metadata", text);
  }
  if (text.startsWith("+")) {
    return viewLine(
      sectionIndex,
      index,
      currentHunkId,
      "addition",
      text,
      null,
      newLine,
    );
  }
  if (text.startsWith("-")) {
    return viewLine(
      sectionIndex,
      index,
      currentHunkId,
      "deletion",
      text,
      oldLine,
      null,
    );
  }
  if (text.startsWith(" ")) {
    return viewLine(
      sectionIndex,
      index,
      currentHunkId,
      "context",
      text,
      oldLine,
      newLine,
    );
  }
  return viewLine(sectionIndex, index, currentHunkId, "metadata", text);
}

function viewLine(
  sectionIndex: number,
  index: number,
  hunkId: string | null,
  kind: DiffLineKind,
  text: string,
  oldLine: number | null = null,
  newLine: number | null = null,
): DiffViewLine {
  return {
    id: `${sectionIndex}:line:${index}`,
    hunkId,
    kind,
    newLine,
    oldLine,
    text,
  };
}

function splitPatchLines(patch: string): string[] {
  const lines = patch.split("\n");
  if (patch.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}
