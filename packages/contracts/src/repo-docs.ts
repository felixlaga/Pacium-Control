import { z } from "zod";

export const MAX_REPO_DOCS = 16;
export const MAX_REPO_DOC_PATH_CHARS = 4_096;
export const MAX_REPO_DOC_CONTENT_CHARS = 64 * 1024;

export const RepoDocKindSchema = z.enum(["backlog", "needs", "queue"]);
export type RepoDocKind = z.infer<typeof RepoDocKindSchema>;

export const RepoDocStatusSchema = z.enum([
  "stable",
  "empty",
  "changing",
  "oversized",
  "invalid_utf8",
  "unsafe_type",
  "read_error",
]);
export type RepoDocStatus = z.infer<typeof RepoDocStatusSchema>;

export const RepoDocSchema = z
  .object({
    kind: RepoDocKindSchema,
    fileName: z.string().min(1).max(255),
    path: z.string().min(1).max(MAX_REPO_DOC_PATH_CHARS),
    status: RepoDocStatusSchema,
    byteLength: z.number().int().nonnegative(),
    modifiedAt: z.string().datetime().nullable(),
    content: z.string().max(MAX_REPO_DOC_CONTENT_CHARS).nullable(),
  })
  .strict()
  .superRefine((doc, context) => {
    if ((doc.status === "stable") !== (doc.content !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only stable repository documents contain content.",
      });
    }
  });
export type RepoDoc = z.infer<typeof RepoDocSchema>;

export const RepoDocsResponseSchema = z
  .object({
    root: z.string().min(1).max(MAX_REPO_DOC_PATH_CHARS),
    docs: z.array(RepoDocSchema).max(MAX_REPO_DOCS),
  })
  .strict();
export type RepoDocsResponse = z.infer<typeof RepoDocsResponseSchema>;
