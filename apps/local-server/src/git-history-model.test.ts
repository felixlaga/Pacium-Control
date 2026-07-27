import {
  MAX_GIT_HISTORY_AUTHOR_CHARS,
  MAX_GIT_HISTORY_COMMITS,
  MAX_GIT_HISTORY_PARENTS,
  MAX_GIT_HISTORY_SUBJECT_CHARS,
} from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  InvalidHistoryOutput,
  normalizeGitHistoryOutput,
} from "./git-history-model.js";

const firstId = "a".repeat(40);
const parentId = "b".repeat(40);

describe("bounded Git history normalization", () => {
  it("parses fixed NUL records including merge parents", () => {
    const output = [
      historyRecord({
        id: firstId,
        parents: [parentId, "c".repeat(40)],
        authorName: "Pacium Agent",
        authoredAt: "2026-07-27T10:00:00+02:00",
        subject: "Merge bounded work",
      }),
      historyRecord({
        id: parentId,
        parents: [],
        authorName: "Felix",
        authoredAt: "2026-07-27T09:00:00Z",
        subject: "Start work",
      }),
    ].join("");

    expect(normalizeGitHistoryOutput(output)).toEqual({
      commits: [
        {
          id: firstId,
          parents: [parentId, "c".repeat(40)],
          authorName: "Pacium Agent",
          authoredAt: "2026-07-27T10:00:00+02:00",
          subject: "Merge bounded work",
        },
        {
          id: parentId,
          parents: [],
          authorName: "Felix",
          authoredAt: "2026-07-27T09:00:00Z",
          subject: "Start work",
        },
      ],
      truncated: false,
    });
  });

  it("normalizes layout controls and labels empty display evidence", () => {
    const normalized = normalizeGitHistoryOutput(
      historyRecord({
        authorName: "Agent\tName",
        subject: "Line one\nforged row\u007f",
      }),
    );
    expect(normalized.commits[0]).toMatchObject({
      authorName: "Agent Name",
      subject: "Line one forged row",
    });

    const empty = normalizeGitHistoryOutput(
      historyRecord({ authorName: "\t", subject: "" }),
    );
    expect(empty.commits[0]).toMatchObject({
      authorName: "(Unknown author)",
      subject: "(No subject)",
    });
  });

  it("returns only the newest 50 records and marks truncation", () => {
    const output = Array.from(
      { length: MAX_GIT_HISTORY_COMMITS + 1 },
      (_, index) =>
        historyRecord({
          id: index.toString(16).padStart(40, "0"),
          subject: `Commit ${index}`,
        }),
    ).join("");
    const result = normalizeGitHistoryOutput(output);
    expect(result.commits).toHaveLength(MAX_GIT_HISTORY_COMMITS);
    expect(result.commits[0]?.subject).toBe("Commit 0");
    expect(result.commits.at(-1)?.subject).toBe("Commit 49");
    expect(result.truncated).toBe(true);
  });

  it("rejects malformed framing, fields, parents, and duplicates", () => {
    const valid = historyRecord();
    const cases = [
      valid.slice(0, -1),
      `${valid}extra\0`,
      historyRecord({ id: "not-an-object" }),
      historyRecord({ authoredAt: "yesterday" }),
      historyRecord({ parents: ["not-an-object"] }),
      historyRecord({
        parents: Array.from(
          { length: MAX_GIT_HISTORY_PARENTS + 1 },
          (_, index) => index.toString(16).padStart(40, "0"),
        ),
      }),
      `${valid}${valid}`,
    ];
    for (const output of cases) {
      expect(() => normalizeGitHistoryOutput(output)).toThrow(
        InvalidHistoryOutput,
      );
    }
  });

  it("rejects excessive fields and record counts without partial evidence", () => {
    for (const output of [
      historyRecord({
        authorName: "a".repeat(MAX_GIT_HISTORY_AUTHOR_CHARS + 1),
      }),
      historyRecord({
        subject: "s".repeat(MAX_GIT_HISTORY_SUBJECT_CHARS + 1),
      }),
      Array.from({ length: MAX_GIT_HISTORY_COMMITS + 2 }, (_, index) =>
        historyRecord({
          id: index.toString(16).padStart(40, "0"),
        }),
      ).join(""),
    ]) {
      expect(() => normalizeGitHistoryOutput(output)).toThrow(
        InvalidHistoryOutput,
      );
    }
  });

  it("accepts an empty stream as an empty fixed read", () => {
    expect(normalizeGitHistoryOutput("")).toEqual({
      commits: [],
      truncated: false,
    });
  });
});

function historyRecord(
  overrides: Partial<{
    id: string;
    parents: string[];
    authorName: string;
    authoredAt: string;
    subject: string;
  }> = {},
): string {
  const record = {
    id: firstId,
    parents: [parentId],
    authorName: "Pacium Agent",
    authoredAt: "2026-07-27T10:00:00+02:00",
    subject: "Bounded history",
    ...overrides,
  };
  return [
    record.id,
    record.parents.join(" "),
    record.authorName,
    record.authoredAt,
    record.subject,
    "",
  ].join("\0");
}
