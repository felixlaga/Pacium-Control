import type { ReactNode } from "react";

/**
 * A minimal, safe markdown renderer for untrusted agent-written files.
 *
 * Every piece of source text becomes a React text node, so raw HTML in the
 * input stays literal text. No dangerouslySetInnerHTML, no raw HTML pass
 * through, and links only become anchors for http(s) URLs.
 */

const MAX_INPUT_LENGTH = 262_144;
const HEADING = /^(#{1,4})\s+(.*)$/;
const HORIZONTAL_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*```/;
const QUOTE = /^\s*>/;
const LIST_LINE = /^(\s*)(?:([-*])|(\d{1,3})\.)\s+(.*)$/;
const TASK_TEXT = /^\[([ xX])\]\s*(.*)$/;
const CODE_SPAN_SPLIT = /(`[^`]+`)/;
const LINK = /\[([^\]]*)\]\(([^()\s]*)\)/g;
const BOLD_SPLIT = /(\*\*[^*]+\*\*)/;
const ITALIC_SPLIT = /(\*[^*]+\*)/;

interface ListItemLine {
  indent: number;
  ordered: boolean;
  task: "open" | "done" | null;
  text: string;
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.slice(0, MAX_INPUT_LENGTH).split(/\r\n|\r|\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="md-code-block" key={blocks.length}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (HORIZONTAL_RULE.test(line)) {
      blocks.push(<hr className="md-hr" key={blocks.length} />);
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      blocks.push(
        <div className={`md-heading md-h${level}`} key={blocks.length}>
          {renderInline(heading[2] ?? "")}
        </div>,
      );
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? "")) {
        quoted.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote className="md-quote" key={blocks.length}>
          {quoted.map((entry, quoteIndex) => (
            <p className="md-p" key={quoteIndex}>
              {renderInline(entry)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const item = parseListLine(line);
    if (item !== null) {
      const items: ListItemLine[] = [item];
      index += 1;
      while (index < lines.length) {
        const next = parseListLine(lines[index] ?? "");
        if (next === null) {
          break;
        }
        items.push(next);
        index += 1;
      }
      blocks.push(renderList(items, blocks.length));
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (nextLine.trim() === "" || startsBlock(nextLine)) {
        break;
      }
      paragraph.push(nextLine.trim());
      index += 1;
    }
    blocks.push(
      <p className="md-p" key={blocks.length}>
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }
  return <div className="md-root">{blocks}</div>;
}

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HORIZONTAL_RULE.test(line) ||
    HEADING.test(line) ||
    QUOTE.test(line) ||
    LIST_LINE.test(line)
  );
}

function parseListLine(line: string): ListItemLine | null {
  const match = LIST_LINE.exec(line);
  if (match === null) {
    return null;
  }
  const indent = (match[1] ?? "").length;
  if (indent > 8) {
    return null;
  }
  const ordered = match[2] === undefined;
  let text = match[4] ?? "";
  let task: ListItemLine["task"] = null;
  if (!ordered) {
    const taskMatch = TASK_TEXT.exec(text);
    if (taskMatch !== null) {
      task = taskMatch[1] === " " ? "open" : "done";
      text = taskMatch[2] ?? "";
    }
  }
  return { indent, ordered, task, text };
}

function renderList(items: ListItemLine[], key: number): ReactNode {
  const ordered = items[0]?.ordered === true;
  const rendered: ReactNode[] = [];
  let current: ListItemLine | null = null;
  let nested: ListItemLine[] = [];
  const flush = () => {
    if (current === null) {
      return;
    }
    rendered.push(renderListItem(current, nested, rendered.length));
    current = null;
    nested = [];
  };
  for (const entry of items) {
    if (entry.indent >= 2 && current !== null) {
      nested.push(entry);
      continue;
    }
    flush();
    current = entry;
  }
  flush();
  return ordered ? (
    <ol className="md-list md-ordered" key={key}>
      {rendered}
    </ol>
  ) : (
    <ul className="md-list" key={key}>
      {rendered}
    </ul>
  );
}

function renderListItem(
  entry: ListItemLine,
  nested: ListItemLine[],
  key: number,
): ReactNode {
  const children =
    nested.length === 0 ? null : (
      <ul className="md-list md-nested">
        {nested.map((child, childIndex) =>
          renderListItem(child, [], childIndex),
        )}
      </ul>
    );
  if (entry.task !== null) {
    const done = entry.task === "done";
    return (
      <li
        className={`md-item md-task ${done ? "is-done" : "is-open"}`}
        key={key}
      >
        <span aria-hidden="true" className="md-task-box">
          {done ? "✓" : ""}
        </span>
        <span className="md-task-text">{renderInline(entry.text)}</span>
        {children}
      </li>
    );
  }
  return (
    <li className="md-item" key={key}>
      {renderInline(entry.text)}
      {children}
    </li>
  );
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  text.split(CODE_SPAN_SPLIT).forEach((part, index) => {
    if (index % 2 === 1) {
      nodes.push(
        <code className="md-code" key={`code-${index}`}>
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    nodes.push(...renderLinks(part, index));
  });
  return nodes;
}

function renderLinks(text: string, keyBase: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK)) {
    const label = match[1] ?? "";
    const url = match[2] ?? "";
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(...renderEmphasis(text.slice(cursor, start), keyBase));
    }
    if (/^https?:\/\//i.test(url)) {
      nodes.push(
        <a
          className="md-link"
          href={url}
          key={`link-${keyBase}-${start}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          {renderEmphasis(label, keyBase)}
        </a>,
      );
    } else {
      nodes.push(url === "" ? label : `${label} (${url})`);
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push(...renderEmphasis(text.slice(cursor), keyBase));
  }
  return nodes;
}

function renderEmphasis(text: string, keyBase: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  text.split(BOLD_SPLIT).forEach((part, boldIndex) => {
    if (boldIndex % 2 === 1) {
      nodes.push(
        <strong className="md-strong" key={`b-${keyBase}-${boldIndex}`}>
          {part.slice(2, -2)}
        </strong>,
      );
      return;
    }
    part.split(ITALIC_SPLIT).forEach((segment, italicIndex) => {
      if (italicIndex % 2 === 1) {
        nodes.push(
          <em
            className="md-em"
            key={`i-${keyBase}-${boldIndex}-${italicIndex}`}
          >
            {segment.slice(1, -1)}
          </em>,
        );
        return;
      }
      if (segment !== "") {
        nodes.push(segment);
      }
    });
  });
  return nodes;
}
