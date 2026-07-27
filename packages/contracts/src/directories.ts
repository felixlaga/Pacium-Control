import { z } from "zod";

export const MAX_DIRECTORY_ENTRIES = 250;
export const MAX_DIRECTORY_PATH_CHARS = 4_096;

export const DirectoryEntrySchema = z
  .object({
    name: z.string().min(1).max(255),
    path: z.string().min(1).max(MAX_DIRECTORY_PATH_CHARS),
    hidden: z.boolean(),
    repository: z.boolean(),
  })
  .strict();

export const DirectoryListingSchema = z
  .object({
    currentPath: z.string().min(1).max(MAX_DIRECTORY_PATH_CHARS),
    parentPath: z.string().min(1).max(MAX_DIRECTORY_PATH_CHARS).nullable(),
    homePath: z.string().min(1).max(MAX_DIRECTORY_PATH_CHARS),
    defaultPath: z.string().min(1).max(MAX_DIRECTORY_PATH_CHARS),
    entries: z.array(DirectoryEntrySchema).max(MAX_DIRECTORY_ENTRIES),
    truncated: z.boolean(),
  })
  .strict();

export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;
export type DirectoryListing = z.infer<typeof DirectoryListingSchema>;
