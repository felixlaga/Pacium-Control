import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

import type { LaunchPresetCapability, LaunchPresetId } from "@pacium/contracts";

export interface LaunchPresetDefinition extends LaunchPresetCapability {
  executable: string | null;
  args: readonly string[];
}

export function buildLaunchPresetDefinitions(
  shell: string,
  environment: NodeJS.ProcessEnv = process.env,
): readonly LaunchPresetDefinition[] {
  const shellExecutable = findExecutable(shell, undefined);
  if (shellExecutable === null) {
    throw new Error(`Configured shell is not an executable file: ${shell}`);
  }
  return [
    {
      id: "shell",
      label: "Shell",
      available: true,
      unavailableReason: null,
      executable: shellExecutable,
      args: ["-l"],
    },
    buildOptionalPreset("codex", "Codex", "codex", environment),
    buildOptionalPreset("claude", "Claude Code", "claude", environment),
  ];
}

export function presetCapabilities(
  definitions: readonly LaunchPresetDefinition[],
): LaunchPresetCapability[] {
  return definitions.map(({ id, label, available, unavailableReason }) => ({
    id,
    label,
    available,
    unavailableReason,
  }));
}

export function findExecutable(
  command: string,
  pathValue: string | undefined,
): string | null {
  if (isAbsolute(command)) {
    return executablePath(command);
  }
  if (pathValue === undefined) {
    return null;
  }

  for (const directory of pathValue.split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }
    const resolved = executablePath(join(directory, command));
    if (resolved !== null) {
      return resolved;
    }
  }
  return null;
}

function buildOptionalPreset(
  id: Exclude<LaunchPresetId, "shell">,
  label: string,
  command: string,
  environment: NodeJS.ProcessEnv,
): LaunchPresetDefinition {
  const executable = findExecutable(command, environment.PATH);
  return {
    id,
    label,
    available: executable !== null,
    unavailableReason:
      executable === null ? `${label} is not installed or not on PATH.` : null,
    executable,
    args: [],
  };
}

function executablePath(candidate: string): string | null {
  try {
    accessSync(candidate, constants.X_OK);
    const canonical = realpathSync(candidate);
    return statSync(canonical).isFile() ? canonical : null;
  } catch {
    return null;
  }
}
