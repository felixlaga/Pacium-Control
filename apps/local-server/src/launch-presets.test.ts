import {
  chmod,
  mkdtemp,
  mkdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildLaunchPresetDefinitions,
  findExecutable,
  presetCapabilities,
} from "./launch-presets.js";

describe("launch preset catalog", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("finds only executable files on the configured PATH", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pacium-presets-"));
    temporaryDirectories.push(directory);
    const executable = join(directory, "codex");
    const nonExecutable = join(directory, "claude");
    await writeFile(executable, "#!/bin/sh\n");
    await chmod(executable, 0o755);
    await writeFile(nonExecutable, "#!/bin/sh\n");

    expect(findExecutable("codex", directory)).toBe(await realpath(executable));
    expect(findExecutable("claude", directory)).toBeNull();
  });

  it("advertises honest availability without exposing commands or arguments", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pacium-presets-"));
    temporaryDirectories.push(directory);
    await mkdir(join(directory, "bin"));
    const codex = join(directory, "bin", "codex");
    await writeFile(codex, "#!/bin/sh\n");
    await chmod(codex, 0o755);

    const definitions = buildLaunchPresetDefinitions("/bin/zsh", {
      PATH: join(directory, "bin"),
    });
    expect(presetCapabilities(definitions)).toEqual([
      {
        id: "shell",
        label: "Shell",
        available: true,
        unavailableReason: null,
      },
      {
        id: "codex",
        label: "Codex",
        available: true,
        unavailableReason: null,
      },
      {
        id: "claude",
        label: "Claude Code",
        available: false,
        unavailableReason: "Claude Code is not installed or not on PATH.",
      },
    ]);
  });

  it("classifies only the exact server-owned launch preset", () => {
    const definitions = buildLaunchPresetDefinitions("/bin/zsh", { PATH: "" });

    expect(
      definitions.map(({ id, classification }) => ({
        id,
        classification,
      })),
    ).toEqual([
      {
        id: "shell",
        classification: {
          type: "shell",
          label: "Shell",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
      {
        id: "codex",
        classification: {
          type: "codex",
          label: "Codex CLI",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
      {
        id: "claude",
        classification: {
          type: "claude",
          label: "Claude Code CLI",
          source: "launch_preset",
          confidence: "confirmed",
        },
      },
    ]);
  });
});
