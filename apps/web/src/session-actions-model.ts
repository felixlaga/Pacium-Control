import type { LaunchPresetId, SessionSummary } from "@pacium/contracts";

export interface SessionActionAvailability {
  canCopyDirectory: boolean;
  canDuplicate: boolean;
  canInterrupt: boolean;
  canRelaunch: boolean;
  canRename: boolean;
  canRevealRepository: boolean;
  canTerminate: boolean;
}

export interface SessionLaunchInput {
  cwd: string;
  displayName: string;
  launchPreset: LaunchPresetId;
  cols: number;
  rows: number;
}

export function sessionActionAvailability(
  session: SessionSummary,
): SessionActionAvailability {
  const live = session.processState === "live";
  const ended =
    session.processState === "exited" || session.processState === "failed";
  return {
    canCopyDirectory: true,
    canDuplicate: session.processState !== "creating",
    canInterrupt: live,
    canRelaunch: ended,
    canRename: session.processState !== "closing",
    canRevealRepository: session.repositoryRoot !== null,
    canTerminate:
      session.processState !== "creating" && session.processState !== "closing",
  };
}

export function duplicateSessionInput(
  session: SessionSummary,
): SessionLaunchInput {
  const suffix = " copy";
  const maximumBaseLength = 120 - suffix.length;
  const baseName =
    session.displayName.length > maximumBaseLength
      ? session.displayName.slice(0, maximumBaseLength).trimEnd()
      : session.displayName;
  return {
    cwd: session.cwd,
    displayName: `${baseName}${suffix}`,
    launchPreset: session.launchPreset,
    cols: session.cols,
    rows: session.rows,
  };
}

export function relaunchSessionInput(
  session: SessionSummary,
): SessionLaunchInput | null {
  if (!sessionActionAvailability(session).canRelaunch) {
    return null;
  }
  return {
    cwd: session.cwd,
    displayName: session.displayName,
    launchPreset: session.launchPreset,
    cols: session.cols,
    rows: session.rows,
  };
}
