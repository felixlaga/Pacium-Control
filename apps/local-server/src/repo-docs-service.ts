import { readdir, realpath } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { isAbsolute, join } from "node:path";

import {
  MAX_REPO_DOCS,
  MAX_REPO_DOC_PATH_CHARS,
  RepoDocsResponseSchema,
  type RepoDoc,
  type RepoDocKind,
  type RepoDocsResponse,
} from "@pacium/contracts";

import { readStableQueueFile } from "./queue-file-reader.js";

export interface RepoDocsRootProvider {
  listAllowedRoots(): Promise<readonly string[]>;
}

const DOC_KIND_ORDER: Readonly<Record<RepoDocKind, number>> = {
  backlog: 0,
  needs: 1,
  queue: 2,
};

const DOC_NAME_PATTERNS: ReadonlyArray<{
  kind: RepoDocKind;
  pattern: RegExp;
}> = [
  { kind: "backlog", pattern: /^backlog\.md$/ },
  { kind: "needs", pattern: /^needs-[a-z0-9._-]+\.md$/ },
  { kind: "queue", pattern: /^[a-z0-9._-]+-queue\.md$/ },
];

export class RepoDocsService {
  public constructor(private readonly roots: RepoDocsRootProvider) {}

  public async inspect(rootInput: string): Promise<RepoDocsResponse | null> {
    if (!isAbsolute(rootInput) || rootInput.length > MAX_REPO_DOC_PATH_CHARS) {
      return null;
    }
    const root = await canonicalize(rootInput);
    if (root === null || !(await this.isAllowedRoot(root))) {
      return null;
    }

    let children: Dirent[];
    try {
      children = await readdir(root, { withFileTypes: true });
    } catch {
      return null;
    }

    const matched = children
      .flatMap((entry) => {
        const kind = entry.isFile() ? classifyDocName(entry.name) : null;
        return kind === null ? [] : [{ kind, fileName: entry.name }];
      })
      .sort(
        (left, right) =>
          DOC_KIND_ORDER[left.kind] - DOC_KIND_ORDER[right.kind] ||
          left.fileName.localeCompare(right.fileName),
      )
      .slice(0, MAX_REPO_DOCS);

    const docs: RepoDoc[] = [];
    for (const { kind, fileName } of matched) {
      const path = join(root, fileName);
      const result = await readStableQueueFile(path);
      if (result.status === "missing") {
        continue;
      }
      docs.push({
        kind,
        fileName,
        path,
        status: result.status,
        byteLength: result.byteLength ?? 0,
        modifiedAt: result.modifiedAt,
        content: result.status === "stable" ? result.text : null,
      });
    }
    return RepoDocsResponseSchema.parse({ root, docs });
  }

  private async isAllowedRoot(canonicalRoot: string): Promise<boolean> {
    const allowed = await this.roots.listAllowedRoots();
    const canonical = await Promise.all(allowed.map(canonicalize));
    return canonical.includes(canonicalRoot);
  }
}

function classifyDocName(fileName: string): RepoDocKind | null {
  const normalized = fileName.toLowerCase();
  return (
    DOC_NAME_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.kind ??
    null
  );
}

async function canonicalize(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}
