import { lstatSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";

const PACKAGE_LOCK_PATH = /^\/tmp\/com\.pacium\.control\.\d+\.lock$/;
const MAX_PACKAGE_ENTRY_BYTES = 4_096;
const PACKAGE_ENTRY_SUFFIXES = [
  "/Contents/Resources/app/apps/local-server/dist/package-launcher.js",
  "/pacium-control/app/apps/local-server/dist/package-launcher.js",
] as const;

export interface PackageProcessLockOptions {
  lockPath: string;
  packageEntry: string;
  pid?: number;
  processExists?: (pid: number) => boolean;
}

export function acquirePackageProcessLock({
  lockPath,
  packageEntry,
  pid = process.pid,
  processExists = defaultProcessExists,
}: PackageProcessLockOptions): () => void {
  validateLockIdentity(lockPath, packageEntry, pid);
  const contents = `${pid}\n${packageEntry}\n`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(lockPath, contents, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      return () => {
        try {
          if (readFileSync(lockPath, "utf8") === contents) {
            unlinkSync(lockPath);
          }
        } catch {
          // A missing or replaced lease is not owned by this process.
        }
      };
    } catch (error) {
      if (!isAlreadyExistsError(error) || attempt > 0) {
        throw new Error(
          "The Pacium package process lease could not be created.",
          { cause: error },
        );
      }
      const existing = readExistingLock(lockPath);
      if (
        existing === null ||
        existing.packageEntry !== packageEntry ||
        processExists(existing.pid)
      ) {
        throw new Error(
          "Another Pacium package process owns the local process lease.",
          { cause: error },
        );
      }
      unlinkSync(lockPath);
    }
  }

  throw new Error("The Pacium package process lease could not be created.");
}

function validateLockIdentity(
  lockPath: string,
  packageEntry: string,
  pid: number,
): void {
  if (!PACKAGE_LOCK_PATH.test(lockPath)) {
    throw new Error("PACIUM_PACKAGE_LOCK is not the fixed package lease path.");
  }
  if (
    !isAbsolute(packageEntry) ||
    !PACKAGE_ENTRY_SUFFIXES.some((suffix) => packageEntry.endsWith(suffix)) ||
    Buffer.byteLength(packageEntry) > MAX_PACKAGE_ENTRY_BYTES ||
    hasControlCharacter(packageEntry)
  ) {
    throw new Error("The Pacium package entry path is invalid.");
  }
  if (!Number.isSafeInteger(pid) || pid < 1) {
    throw new Error("The Pacium package process ID is invalid.");
  }
}

function readExistingLock(
  lockPath: string,
): { pid: number; packageEntry: string } | null {
  try {
    const metadata = lstatSync(lockPath);
    if (!metadata.isFile() || metadata.nlink !== 1) {
      return null;
    }
    const lines = readFileSync(lockPath, "utf8").split("\n");
    const pidLine = lines[0];
    const packageEntry = lines[1];
    if (
      lines.length !== 3 ||
      lines[2] !== "" ||
      pidLine === undefined ||
      packageEntry === undefined ||
      !/^[1-9]\d*$/.test(pidLine)
    ) {
      return null;
    }
    const pid = Number(pidLine);
    if (
      !Number.isSafeInteger(pid) ||
      !isAbsolute(packageEntry) ||
      Buffer.byteLength(packageEntry) > MAX_PACKAGE_ENTRY_BYTES ||
      hasControlCharacter(packageEntry)
    ) {
      return null;
    }
    return { pid, packageEntry };
  } catch {
    return null;
  }
}

function defaultProcessExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNoSuchProcessError(error);
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function isNoSuchProcessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ESRCH"
  );
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}
