import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AnswerFileDeliveryError,
  inspectAnswerFileTarget,
  publishAnswerFile,
} from "./answer-file-delivery.js";

const cleanup = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...cleanup].map((path) => rm(path, { force: true, recursive: true })),
  );
  cleanup.clear();
});

describe("answer-file delivery", () => {
  it("publishes one private complete no-clobber file", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "PACIUM-ANSWERS");
    const bytes = '{"format":"pacium_decision_v1"}\n';
    const evidence = await publishAnswerFile(
      target,
      {
        bytes,
        byteLength: Buffer.byteLength(bytes),
        contentHash: "a".repeat(64),
      },
      { randomId: () => "first" },
    );

    expect(evidence).toEqual({
      kind: "answer_file_created",
      byteLength: Buffer.byteLength(bytes),
      contentHash: "a".repeat(64),
    });
    expect(await readFile(target, "utf8")).toBe(bytes);
    expect((await lstat(target)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual(["PACIUM-ANSWERS"]);
  });

  it("preserves an existing target and rejects a symlink target", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "PACIUM-ANSWERS");
    await expect(inspectAnswerFileTarget(target)).resolves.toBe("ready");
    await writeFile(target, "human answer\n", { mode: 0o600 });
    await expect(inspectAnswerFileTarget(target)).resolves.toBe("occupied");
    await expect(
      publishAnswerFile(target, payload(), { randomId: () => "occupied" }),
    ).rejects.toEqual(new AnswerFileDeliveryError("occupied"));
    expect(await readFile(target, "utf8")).toBe("human answer\n");

    const linkPath = join(directory, "SYMLINK-ANSWERS");
    await symlink(target, linkPath);
    await expect(inspectAnswerFileTarget(linkPath)).resolves.toBe(
      "unavailable",
    );
    await expect(
      publishAnswerFile(linkPath, payload(), {
        randomId: () => "symlink",
      }),
    ).rejects.toEqual(new AnswerFileDeliveryError("unavailable"));
    expect(await readFile(target, "utf8")).toBe("human answer\n");
  });

  it("reports unknown after publish when directory durability fails", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "PACIUM-ANSWERS");
    await expect(
      publishAnswerFile(target, payload(), {
        io: {
          syncDirectory: () =>
            Promise.reject(new Error("injected sync failure")),
        },
        randomId: () => "unknown",
      }),
    ).rejects.toEqual(new AnswerFileDeliveryError("unknown"));
    expect(await readFile(target, "utf8")).toBe(payload().bytes);
    expect(await readdir(directory)).toEqual(["PACIUM-ANSWERS"]);
  });

  it("fails before publish when temporary writing fails", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "PACIUM-ANSWERS");
    await expect(
      publishAnswerFile(target, payload(), {
        io: {
          open: () => Promise.reject(new Error("injected open failure")),
        },
        randomId: () => "failed",
      }),
    ).rejects.toEqual(new AnswerFileDeliveryError("write_failed"));
    await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readdir(directory)).toEqual([]);
  });
});

function payload() {
  const bytes = '{"format":"pacium_decision_v1"}\n';
  return {
    bytes,
    byteLength: Buffer.byteLength(bytes),
    contentHash: "a".repeat(64),
  };
}

async function temporaryDirectory(): Promise<string> {
  const created = await mkdtemp(join(tmpdir(), "pacium-answer-delivery-"));
  cleanup.add(created);
  return realpath(created);
}
