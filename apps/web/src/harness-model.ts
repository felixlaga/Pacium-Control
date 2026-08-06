const HARNESS_TARGET_KEY = "pacium.harnessTarget";
const HARNESS_TARGET_PATTERN = /^[a-z0-9._-]+@[a-z0-9._-]+$/i;
const MAX_TARGET_LENGTH = 128;

// Mirrors the deploy default in scripts/deploy-hetzner.sh so the login flow
// works with one click; the popover keeps the target editable and persisted.
export const DEFAULT_HARNESS_TARGET = "root@felix-harness";

export function isValidHarnessTarget(target: string): boolean {
  return (
    target.length <= MAX_TARGET_LENGTH && HARNESS_TARGET_PATTERN.test(target)
  );
}

export function loadHarnessTarget(storage: Pick<Storage, "getItem">): string {
  let stored: string | null;
  try {
    stored = storage.getItem(HARNESS_TARGET_KEY);
  } catch {
    return DEFAULT_HARNESS_TARGET;
  }
  return stored !== null && isValidHarnessTarget(stored)
    ? stored
    : DEFAULT_HARNESS_TARGET;
}

export function saveHarnessTarget(
  storage: Pick<Storage, "setItem">,
  target: string,
): void {
  if (!isValidHarnessTarget(target)) {
    return;
  }
  try {
    storage.setItem(HARNESS_TARGET_KEY, target);
  } catch {
    // Persisting the target is a convenience; losing it is not an error.
  }
}

/**
 * Builds the SSH command that opens the harness login flow. The remote command
 * is single-quoted so nothing expands locally, -t forces a TTY so the
 * Tailscale login URL prints, and sudo is a no-op for root while covering
 * non-root operator setups. The target is validated first, which also keeps
 * shell metacharacters out of the command.
 */
export function buildHarnessLoginCommand(target: string): string {
  if (!isValidHarnessTarget(target)) {
    throw new Error(
      "The harness SSH target must look like user@host with no spaces or shell characters.",
    );
  }
  return `ssh -t ${target} 'tailscale status >/dev/null 2>&1 || sudo tailscale login; exec $SHELL -l'`;
}
