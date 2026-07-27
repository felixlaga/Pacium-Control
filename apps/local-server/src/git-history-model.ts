import {
  GitCommitRecordSchema,
  MAX_GIT_HISTORY_AUTHOR_CHARS,
  MAX_GIT_HISTORY_COMMITS,
  MAX_GIT_HISTORY_PARENTS,
  MAX_GIT_HISTORY_SUBJECT_CHARS,
  type GitCommitRecord,
} from "@pacium/contracts";

const HISTORY_READ_RECORDS = MAX_GIT_HISTORY_COMMITS + 1;
const FIELDS_PER_RECORD = 5;
const OBJECT_ID = /^[0-9a-f]{40,64}$/;
const OBJECT_ID_SEQUENCE = /^[0-9a-f]{40,64}(?: [0-9a-f]{40,64})*$/;

export interface NormalizedGitHistory {
  commits: GitCommitRecord[];
  truncated: boolean;
}

export class InvalidHistoryOutput extends Error {}

export function normalizeGitHistoryOutput(
  output: string,
): NormalizedGitHistory {
  if (output.length === 0) {
    return { commits: [], truncated: false };
  }
  if (!output.endsWith("\0")) {
    throw new InvalidHistoryOutput("History output is not NUL terminated.");
  }

  const fields = output.split("\0");
  fields.pop();
  if (
    fields.length % FIELDS_PER_RECORD !== 0 ||
    fields.length / FIELDS_PER_RECORD > HISTORY_READ_RECORDS
  ) {
    throw new InvalidHistoryOutput("History record framing is invalid.");
  }

  const commits: GitCommitRecord[] = [];
  for (let offset = 0; offset < fields.length; offset += FIELDS_PER_RECORD) {
    const record = normalizeRecord(fields.slice(offset, offset + 5));
    if (commits.some(({ id }) => id === record.id)) {
      throw new InvalidHistoryOutput("History contains a duplicate commit.");
    }
    commits.push(record);
  }

  return {
    commits: commits.slice(0, MAX_GIT_HISTORY_COMMITS),
    truncated: commits.length > MAX_GIT_HISTORY_COMMITS,
  };
}

function normalizeRecord(fields: string[]): GitCommitRecord {
  const [id, rawParents, rawAuthorName, authoredAt, rawSubject] = fields;
  if (
    id === undefined ||
    rawParents === undefined ||
    rawAuthorName === undefined ||
    authoredAt === undefined ||
    rawSubject === undefined ||
    !OBJECT_ID.test(id)
  ) {
    throw new InvalidHistoryOutput("History record fields are invalid.");
  }

  if (rawParents.length > 0 && !OBJECT_ID_SEQUENCE.test(rawParents)) {
    throw new InvalidHistoryOutput("History parent framing is invalid.");
  }
  const parents = rawParents.length === 0 ? [] : rawParents.split(" ");
  if (
    parents.length > MAX_GIT_HISTORY_PARENTS ||
    parents.some((parent) => !OBJECT_ID.test(parent))
  ) {
    throw new InvalidHistoryOutput("History parent evidence is invalid.");
  }

  const authorName = normalizeDisplayText(
    rawAuthorName,
    MAX_GIT_HISTORY_AUTHOR_CHARS,
    "(Unknown author)",
  );
  const subject = normalizeDisplayText(
    rawSubject,
    MAX_GIT_HISTORY_SUBJECT_CHARS,
    "(No subject)",
  );
  const parsed = GitCommitRecordSchema.safeParse({
    id,
    parents,
    authorName,
    authoredAt,
    subject,
  });
  if (!parsed.success) {
    throw new InvalidHistoryOutput("History record evidence is invalid.");
  }
  return parsed.data;
}

function normalizeDisplayText(
  value: string,
  maxChars: number,
  emptyLabel: string,
): string {
  if (value.length > maxChars) {
    throw new InvalidHistoryOutput("History display text is excessive.");
  }
  const normalized = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined &&
        (codePoint <= 0x1f || codePoint === 0x7f)
        ? " "
        : character;
    })
    .join("")
    .trim();
  return normalized.length === 0 ? emptyLabel : normalized;
}
