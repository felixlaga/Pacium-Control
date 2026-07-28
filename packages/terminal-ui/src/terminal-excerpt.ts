export const MAX_TERMINAL_EXCERPT_LINES = 4;
export const MAX_TERMINAL_EXCERPT_CHARACTERS = 800;
export const MAX_TERMINAL_EXCERPT_SCAN_LINES = 200;

export interface TerminalTextExcerpt {
  status: "ready" | "empty";
  text: string;
  lineCount: number;
  truncated: boolean;
}

export function buildTerminalTextExcerpt(
  lines: readonly string[],
): TerminalTextExcerpt {
  const scanStart = Math.max(0, lines.length - MAX_TERMINAL_EXCERPT_SCAN_LINES);
  const selected: string[] = [];
  let extraNonEmptyLine = false;

  for (let index = lines.length - 1; index >= scanStart; index -= 1) {
    const line = normalizeTerminalExcerptLine(lines[index] ?? "");
    if (line.trim().length === 0) {
      continue;
    }
    if (selected.length === MAX_TERMINAL_EXCERPT_LINES) {
      extraNonEmptyLine = true;
      break;
    }
    selected.push(line);
  }

  if (selected.length === 0) {
    return {
      status: "empty",
      text: "",
      lineCount: 0,
      truncated: false,
    };
  }

  selected.reverse();
  const combined = selected.join("\n");
  const characters = Array.from(combined);
  const characterTruncated =
    characters.length > MAX_TERMINAL_EXCERPT_CHARACTERS;
  const text = characterTruncated
    ? `${characters.slice(0, MAX_TERMINAL_EXCERPT_CHARACTERS - 1).join("")}…`
    : combined;

  return {
    status: "ready",
    text,
    lineCount: selected.length,
    truncated: extraNonEmptyLine || characterTruncated,
  };
}

function normalizeTerminalExcerptLine(line: string): string {
  return Array.from(line, (character) =>
    isUnsafeDisplayControl(character.codePointAt(0) ?? 0) ? "�" : character,
  )
    .join("")
    .trimEnd();
}

function isUnsafeDisplayControl(codePoint: number): boolean {
  return (
    (codePoint >= 0 && codePoint <= 8) ||
    codePoint === 11 ||
    codePoint === 12 ||
    (codePoint >= 14 && codePoint <= 31) ||
    (codePoint >= 127 && codePoint <= 159) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}
