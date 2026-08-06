import type {
  RepoDoc,
  RepoDocKind,
  RepoDocStatus,
  RepoDocsResponse,
} from "@pacium/contracts";

import { browserReadMethod } from "./transport.js";

export type { RepoDoc, RepoDocKind, RepoDocStatus, RepoDocsResponse };

export interface RepoDocsRequest {
  root: string;
  accessToken: string | null;
  fetcher?: typeof fetch;
  secure?: boolean;
}

const MAX_DOCS = 16;
const MAX_CONTENT_LENGTH = 65_536;
const REPO_DOC_KINDS: readonly RepoDocKind[] = ["backlog", "needs", "queue"];
const REPO_DOC_STATUSES: readonly RepoDocStatus[] = [
  "stable",
  "empty",
  "changing",
  "oversized",
  "invalid_utf8",
  "unsafe_type",
  "read_error",
];
const ATTENTION_MARKER =
  /^#{0,4}\s*(question|approval request|needs (input|decision|felix|review)|review request)\b/im;

export async function fetchRepoDocs(
  request: RepoDocsRequest,
): Promise<RepoDocsResponse> {
  const fetcher = request.fetcher ?? fetch;
  const method = browserReadMethod(
    request.secure === undefined
      ? typeof window === "undefined"
        ? "http:"
        : window.location.protocol
      : request.secure
        ? "https:"
        : "http:",
  );
  const headers: Record<string, string> = { accept: "application/json" };
  if (request.accessToken !== null) {
    headers.authorization = `Bearer ${request.accessToken}`;
  }
  const response =
    method === "GET"
      ? await fetcher(
          `/api/pacium/repo-docs?root=${encodeURIComponent(request.root)}`,
          { credentials: "same-origin", headers, method },
        )
      : await fetcher("/api/pacium/repo-docs", {
          body: JSON.stringify({ root: request.root }),
          credentials: "same-origin",
          headers: { ...headers, "content-type": "application/json" },
          method,
        });
  if (!response.ok) {
    let message = `Repository files failed with HTTP ${response.status}`;
    try {
      const body = (await response.json()) as unknown;
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string" &&
        body.error.length <= 300
      ) {
        message = body.error;
      }
    } catch {
      // Keep the bounded HTTP status message when no JSON error exists.
    }
    throw new Error(message);
  }
  return parseRepoDocsResponse(await response.json());
}

function parseRepoDocsResponse(value: unknown): RepoDocsResponse {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      "The Pacium host returned an invalid repository files response.",
    );
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.root !== "string" ||
    candidate.root === "" ||
    !Array.isArray(candidate.docs) ||
    candidate.docs.length > MAX_DOCS
  ) {
    throw new Error(
      "The Pacium host returned an invalid repository files response.",
    );
  }
  return {
    root: candidate.root,
    docs: candidate.docs.map((doc) => parseRepoDoc(doc)),
  };
}

function parseRepoDoc(value: unknown): RepoDoc {
  if (typeof value !== "object" || value === null) {
    throw new Error("The Pacium host returned an invalid repository file.");
  }
  const doc = value as Record<string, unknown>;
  const kind = doc.kind;
  const status = doc.status;
  if (
    !REPO_DOC_KINDS.includes(kind as RepoDocKind) ||
    typeof doc.fileName !== "string" ||
    doc.fileName === "" ||
    typeof doc.path !== "string" ||
    doc.path === "" ||
    !REPO_DOC_STATUSES.includes(status as RepoDocStatus) ||
    typeof doc.byteLength !== "number" ||
    !Number.isFinite(doc.byteLength) ||
    doc.byteLength < 0 ||
    (doc.modifiedAt !== null && typeof doc.modifiedAt !== "string")
  ) {
    throw new Error("The Pacium host returned an invalid repository file.");
  }
  if (status === "stable") {
    if (
      typeof doc.content !== "string" ||
      doc.content.length > MAX_CONTENT_LENGTH
    ) {
      throw new Error("The Pacium host returned an invalid repository file.");
    }
  } else if (doc.content !== null) {
    throw new Error("The Pacium host returned an invalid repository file.");
  }
  return {
    kind: kind as RepoDocKind,
    fileName: doc.fileName,
    path: doc.path,
    status: status as RepoDocStatus,
    byteLength: doc.byteLength,
    modifiedAt: doc.modifiedAt,
    content: doc.content,
  };
}

/**
 * A doc needs the operator's attention when it is a stable needs-file whose
 * body holds more than a title, or when any stable content carries an explicit
 * question/approval/review marker line.
 */
export function docNeedsAttention(doc: RepoDoc): boolean {
  if (doc.status !== "stable" || doc.content === null) {
    return false;
  }
  if (ATTENTION_MARKER.test(doc.content)) {
    return true;
  }
  if (doc.kind !== "needs") {
    return false;
  }
  return doc.content
    .split(/\r\n|\r|\n/)
    .slice(1)
    .some((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("#");
    });
}

export function summarizeDocFreshness(doc: RepoDoc, nowIso: string): string {
  const kilobytes = `${(doc.byteLength / 1024).toFixed(1)} KB`;
  if (doc.modifiedAt === null) {
    return `Modified time unknown · ${kilobytes}`;
  }
  const modified = Date.parse(doc.modifiedAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(modified) || Number.isNaN(now)) {
    return `Modified time unknown · ${kilobytes}`;
  }
  const seconds = Math.max(0, Math.floor((now - modified) / 1000));
  if (seconds < 60) {
    return `Updated ${seconds}s ago · ${kilobytes}`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m ago · ${kilobytes}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago · ${kilobytes}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `Updated ${days}d ago · ${kilobytes}`;
  }
  return `Updated ${new Date(modified).toISOString().slice(0, 10)} · ${kilobytes}`;
}
