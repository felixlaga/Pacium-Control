import { describe, expect, it } from "vitest";

import { MAX_REPO_DOCS, RepoDocsResponseSchema } from "./repo-docs.js";

function doc(fileName: string) {
  return {
    kind: "needs" as const,
    fileName,
    path: `/work/project/${fileName}`,
    status: "stable" as const,
    byteLength: 12,
    modifiedAt: "2026-08-05T10:00:00.000Z",
    content: "- ask Felix\n",
  };
}

describe("repository docs contract", () => {
  it("accepts a bounded repository docs response", () => {
    expect(
      RepoDocsResponseSchema.parse({
        root: "/work/project",
        docs: [
          {
            kind: "backlog",
            fileName: "BACKLOG.md",
            path: "/work/project/BACKLOG.md",
            status: "empty",
            byteLength: 0,
            modifiedAt: "2026-08-05T10:00:00.000Z",
            content: null,
          },
          doc("NEEDS-FELIX.md"),
        ],
      }),
    ).toMatchObject({ root: "/work/project" });
  });

  it("rejects content on a document that is not stable", () => {
    expect(() =>
      RepoDocsResponseSchema.parse({
        root: "/work/project",
        docs: [{ ...doc("NEEDS-FELIX.md"), status: "oversized" }],
      }),
    ).toThrow();
  });

  it("rejects a stable document without content", () => {
    expect(() =>
      RepoDocsResponseSchema.parse({
        root: "/work/project",
        docs: [{ ...doc("NEEDS-FELIX.md"), content: null }],
      }),
    ).toThrow();
  });

  it("rejects statuses outside the shared reader vocabulary", () => {
    expect(() =>
      RepoDocsResponseSchema.parse({
        root: "/work/project",
        docs: [{ ...doc("NEEDS-FELIX.md"), status: "missing", content: null }],
      }),
    ).toThrow();
  });

  it("rejects more than the advertised document limit", () => {
    const docs = Array.from({ length: MAX_REPO_DOCS + 1 }, (_, index) =>
      doc(`NEEDS-AGENT-${index}.md`),
    );
    expect(() =>
      RepoDocsResponseSchema.parse({ root: "/work/project", docs }),
    ).toThrow();
  });
});
