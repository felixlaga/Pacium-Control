import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownLite } from "./markdown-lite.js";

function render(text: string): string {
  return renderToStaticMarkup(<MarkdownLite text={text} />);
}

describe("MarkdownLite safety", () => {
  it("keeps raw HTML as literal escaped text", () => {
    const markup = render(
      '<img src=x onerror=alert(1)>\n\n<script>alert("x")</script>',
    );

    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<script>");
  });

  it("keeps angle brackets literal inside headings and list items", () => {
    const markup = render("# Title <b>bold</b>\n- item <i>x</i>");

    expect(markup).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(markup).toContain("&lt;i&gt;x&lt;/i&gt;");
    expect(markup).not.toContain("<b>");
    expect(markup).not.toContain("<i>");
  });
});

describe("MarkdownLite blocks", () => {
  it("renders headings one through four and treats deeper markers as text", () => {
    const markup = render("# One\n## Two\n### Three\n#### Four\n##### Five");

    expect(markup).toContain('class="md-heading md-h1"');
    expect(markup).toContain('class="md-heading md-h2"');
    expect(markup).toContain('class="md-heading md-h3"');
    expect(markup).toContain('class="md-heading md-h4"');
    expect(markup).not.toContain("md-h5");
    expect(markup).toContain("##### Five");
  });

  it("renders task items with read-only checkbox state classes", () => {
    const markup = render("- [ ] open thing\n- [x] done thing");

    expect(markup).toContain('class="md-item md-task is-open"');
    expect(markup).toContain('class="md-item md-task is-done"');
    expect(markup).toContain("open thing");
    expect(markup).toContain("done thing");
    expect(markup).toContain('aria-hidden="true" class="md-task-box"');
    expect(markup).not.toContain("[ ]");
    expect(markup).not.toContain("[x]");
  });

  it("keeps markdown syntax literal inside fenced code blocks", () => {
    const markup = render(
      "```\n# not a heading\n**not bold**\n- [ ] not a task\n<b>html</b>\n```",
    );

    expect(markup).toContain('class="md-code-block"');
    expect(markup).toContain("# not a heading");
    expect(markup).toContain("**not bold**");
    expect(markup).toContain("- [ ] not a task");
    expect(markup).toContain("&lt;b&gt;html&lt;/b&gt;");
    expect(markup).not.toContain("md-h1");
    expect(markup).not.toContain("md-strong");
    expect(markup).not.toContain("md-task");
  });

  it("renders ordered lists, one nesting level, blockquotes, and rules", () => {
    const markup = render(
      "1. first\n2. second\n\n- top\n  - nested\n\n> quoted line\n\n---",
    );

    expect(markup).toContain('<ol class="md-list md-ordered">');
    expect(markup).toContain("first");
    expect(markup).toContain('<ul class="md-list md-nested">');
    expect(markup).toContain("nested");
    expect(markup).toContain('<blockquote class="md-quote">');
    expect(markup).toContain("quoted line");
    expect(markup).toContain('<hr class="md-hr"/>');
  });
});

describe("MarkdownLite inline", () => {
  it("parses bold, italic, and inline code", () => {
    const markup = render("mix **bold** and *ital* and `code()` here");

    expect(markup).toContain('<strong class="md-strong">bold</strong>');
    expect(markup).toContain('<em class="md-em">ital</em>');
    expect(markup).toContain('<code class="md-code">code()</code>');
  });

  it("keeps bold key-value bullets working", () => {
    const markup = render("- **Priority:** P0");

    expect(markup).toContain('<strong class="md-strong">Priority:</strong>');
    expect(markup).toContain("P0");
  });

  it("renders anchors only for http and https links", () => {
    const markup = render(
      "[safe](https://example.com/a?b=1) and [plain](http://example.com/x)",
    );

    expect(markup).toContain(
      '<a class="md-link" href="https://example.com/a?b=1" rel="noreferrer noopener" target="_blank">safe</a>',
    );
    expect(markup).toContain('href="http://example.com/x"');
  });

  it("neutralizes non-http links into plain text", () => {
    const markup = render(
      "[docs](file:///etc/passwd) and [evil](javascript:alert(1))",
    );

    expect(markup).not.toContain("<a");
    expect(markup).toContain("docs (file:///etc/passwd)");
    expect(markup).toContain("javascript:alert(1)");
    expect(markup).not.toContain("href");
  });

  it("keeps bare URLs as plain text", () => {
    const markup = render("see https://example.com/raw for details");

    expect(markup).not.toContain("<a");
    expect(markup).toContain("https://example.com/raw");
  });

  it("does not parse emphasis inside inline code", () => {
    const markup = render("`**still literal**`");

    expect(markup).toContain("**still literal**");
    expect(markup).not.toContain("md-strong");
  });
});
