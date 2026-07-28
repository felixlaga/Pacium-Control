import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  HOST_SETUP_SCHEMA_VERSION,
  HostSetupApplyRequestSchema,
  HostSetupApplyResultSchema,
  HostSetupSnapshotSchema,
  type HostSetupApplyRequest,
  type HostSetupApplyResult,
  type HostSetupDocument,
  type HostSetupSnapshot,
  type MetaSessionCapability,
  type TmuxSessionsObservation,
} from "@pacium/contracts";

import type { ServerConfig } from "./config.js";
import { HostSetupStore } from "./host-setup-store.js";
import { findExecutable } from "./launch-presets.js";

interface HostSetupSessions {
  discoverTmux(): Promise<TmuxSessionsObservation>;
  attachConfiguredMetaTmux(
    sessionName: string | null,
  ): Promise<MetaSessionCapability>;
}

interface HostSetupStoreLike {
  inspect(): Promise<HostSetupDocument | null>;
  replace(input: HostSetupDocument): Promise<HostSetupDocument>;
}

const execFileAsync = promisify(execFile);
const INSPECTION_TIMEOUT_MS = 3_000;
const APPLY_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const HOST_SETUP_LOOPBACK_PORT = 4174;
const APPROVAL_URL =
  /https:\/\/login\.tailscale\.com\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]{1,1900}/g;

interface CommandResult {
  stdout: string;
  stderr: string;
}

type CommandExecutor = (
  executable: string,
  args: readonly string[],
  options: {
    env: Readonly<Record<string, string>>;
    timeout: number;
    maxBuffer: number;
  },
) => Promise<CommandResult>;

interface TailscaleIdentity {
  origin: string;
  login: string;
}

export class HostSetupService {
  private applyInFlight: Promise<HostSetupApplyResult> | null = null;

  public constructor(
    private readonly config: ServerConfig,
    private readonly sessions: HostSetupSessions,
    private readonly store: HostSetupStoreLike = new HostSetupStore(
      config.dataDirectory,
    ),
    private readonly environment: Readonly<Record<string, string>> = {},
    private readonly execute: CommandExecutor = executeCommand,
    private readonly tailscaleExecutable: string | null = findExecutable(
      "tailscale",
      environment.PATH,
    ),
  ) {}

  public async inspect(): Promise<HostSetupSnapshot> {
    const tmuxSessions = await this.inspectTmux();
    let configured: HostSetupDocument | null;
    try {
      configured = await this.store.inspect();
    } catch {
      return HostSetupSnapshotSchema.parse({
        status: "error",
        tmuxSessions,
        selectedTmuxSessionId: null,
        tailscale: {
          state: "unavailable",
          origin: null,
          login: null,
        },
        remoteUrl: null,
        canApply: false,
        detail:
          "Existing host setup is unsafe or invalid and must be repaired before replacement.",
      });
    }
    const selected =
      configured === null
        ? null
        : (tmuxSessions.find(
            ({ name }) => name === configured.metaTmuxSessionName,
          )?.id ?? null);
    if (
      configured !== null &&
      this.config.tailscaleServe?.origin === configured.tailscaleOrigin
    ) {
      return HostSetupSnapshotSchema.parse({
        status: "configured",
        tmuxSessions,
        selectedTmuxSessionId: selected,
        tailscale: {
          state: "ready",
          origin: configured.tailscaleOrigin,
          login: configured.tailscaleOperatorLogin,
        },
        remoteUrl: configured.tailscaleOrigin,
        canApply: false,
        detail: "Remote Meta is configured. Open Pacium from the tailnet URL.",
      });
    }
    if (this.config.port !== HOST_SETUP_LOOPBACK_PORT) {
      return unavailableSnapshot(
        tmuxSessions,
        "unavailable",
        "Button setup is available only on Pacium's default local port.",
      );
    }

    const executable = this.tailscaleExecutable;
    if (executable === null) {
      return unavailableSnapshot(
        tmuxSessions,
        "not_installed",
        "Tailscale is not available to this Pacium process.",
      );
    }
    const identity = await this.inspectIdentity(executable);
    if (identity.status !== "ready") {
      return unavailableSnapshot(tmuxSessions, identity.state, identity.detail);
    }
    const serve = await this.inspectServe(executable);
    if (serve !== "empty") {
      return HostSetupSnapshotSchema.parse({
        status: serve === "existing" ? "unavailable" : "error",
        tmuxSessions,
        selectedTmuxSessionId: null,
        tailscale: {
          state: serve === "existing" ? "existing_serve" : "unavailable",
          origin: null,
          login: null,
        },
        remoteUrl: null,
        canApply: false,
        detail:
          serve === "existing"
            ? "An existing Tailscale Serve configuration must be reviewed before Pacium changes it."
            : "Tailscale Serve status could not be inspected safely.",
      });
    }
    return HostSetupSnapshotSchema.parse({
      status: tmuxSessions.length === 0 ? "unavailable" : "ready",
      tmuxSessions,
      selectedTmuxSessionId: null,
      tailscale: {
        state: "ready",
        origin: identity.value.origin,
        login: identity.value.login,
      },
      remoteUrl: null,
      canApply: tmuxSessions.length > 0,
      detail:
        tmuxSessions.length === 0
          ? "Start the existing Meta tmux session, then refresh setup."
          : "Choose the existing Meta session and enable remote access.",
    });
  }

  public apply(input: HostSetupApplyRequest): Promise<HostSetupApplyResult> {
    const parsed = HostSetupApplyRequestSchema.parse(input);
    if (this.applyInFlight !== null) {
      return this.applyInFlight;
    }
    const operation = this.applyOnce(parsed);
    this.applyInFlight = operation;
    void operation.then(
      () => this.clearApply(operation),
      () => this.clearApply(operation),
    );
    return operation;
  }

  private async applyOnce(
    input: HostSetupApplyRequest,
  ): Promise<HostSetupApplyResult> {
    const before = await this.inspect();
    if (before.status === "configured") {
      return result("configured", before, null);
    }
    if (!before.canApply || before.tailscale.state !== "ready") {
      return result("refused", before, null);
    }
    const selected = before.tmuxSessions.find(
      ({ id }) => id === input.tmuxSessionId,
    );
    if (selected === undefined || this.config.tmuxSocket === null) {
      return result("refused", await this.inspect(), null);
    }
    const executable = this.tailscaleExecutable;
    if (executable === null) {
      return result("failed", before, null);
    }
    try {
      await this.execute(
        executable,
        ["serve", "--bg", "--yes", String(HOST_SETUP_LOOPBACK_PORT)],
        commandOptions(this.environment, APPLY_TIMEOUT_MS),
      );
    } catch (error) {
      const approvalUrl = extractApprovalUrl(error);
      if (approvalUrl !== null) {
        return result("approval_required", before, approvalUrl);
      }
      return result(
        "failed",
        {
          ...before,
          status: "error",
          canApply: true,
          detail:
            "Tailscale could not enable private Serve access. Existing terminals are unchanged.",
        },
        null,
      );
    }

    const origin = before.tailscale.origin;
    const login = before.tailscale.login;
    if (origin === null || login === null) {
      return result("unknown", before, null);
    }
    try {
      await this.store.replace({
        schemaVersion: HOST_SETUP_SCHEMA_VERSION,
        loopbackPort: HOST_SETUP_LOOPBACK_PORT,
        tmuxSocket: this.config.tmuxSocket,
        metaTmuxSessionName: selected.name,
        tailscaleOrigin: origin,
        tailscaleOperatorLogin: login,
      });
    } catch {
      const rolledBack = await this.disableServe(executable);
      return result(rolledBack ? "failed" : "unknown", before, null);
    }

    this.config.metaTmuxSessionName = selected.name;
    this.config.tailscaleServe = {
      origin,
      hostname: new URL(origin).hostname,
      operatorLogins: new Set([login]),
    };
    await this.sessions.attachConfiguredMetaTmux(selected.name);
    return result(
      "configured",
      HostSetupSnapshotSchema.parse({
        status: "configured",
        tmuxSessions: before.tmuxSessions,
        selectedTmuxSessionId: selected.id,
        tailscale: {
          state: "ready",
          origin,
          login,
        },
        remoteUrl: origin,
        canApply: false,
        detail: "Remote Meta is configured. Open Pacium from the tailnet URL.",
      }),
      null,
    );
  }

  private async inspectTmux() {
    try {
      const observation = await this.sessions.discoverTmux();
      return observation.status === "ready"
        ? observation.sessions.map(({ target }) => ({
            id: target.sessionId,
            name: target.sessionName,
          }))
        : [];
    } catch {
      return [];
    }
  }

  private clearApply(operation: Promise<HostSetupApplyResult>): void {
    if (this.applyInFlight === operation) {
      this.applyInFlight = null;
    }
  }

  private async inspectIdentity(executable: string): Promise<
    | { status: "ready"; value: TailscaleIdentity }
    | {
        status: "unavailable";
        state: "signed_out" | "unavailable";
        detail: string;
      }
  > {
    try {
      const { stdout } = await this.execute(
        executable,
        ["status", "--json"],
        commandOptions(this.environment, INSPECTION_TIMEOUT_MS),
      );
      const value = JSON.parse(stdout) as unknown;
      const identity = projectTailscaleIdentity(value);
      return { status: "ready", value: identity };
    } catch (error) {
      return {
        status: "unavailable",
        state: isSignedOutStatus(error) ? "signed_out" : "unavailable",
        detail: isSignedOutStatus(error)
          ? "Sign in to Tailscale on this host, then refresh setup."
          : "Tailscale identity could not be inspected safely.",
      };
    }
  }

  private async inspectServe(
    executable: string,
  ): Promise<"empty" | "existing" | "error"> {
    try {
      const { stdout } = await this.execute(
        executable,
        ["serve", "status", "--json"],
        commandOptions(this.environment, INSPECTION_TIMEOUT_MS),
      );
      return isEmptyJson(stdout) ? "empty" : "existing";
    } catch {
      return "error";
    }
  }

  private async disableServe(executable: string): Promise<boolean> {
    try {
      await this.execute(
        executable,
        ["serve", "--https=443", "off"],
        commandOptions(this.environment, APPLY_TIMEOUT_MS),
      );
      return true;
    } catch {
      return false;
    }
  }
}

export function projectTailscaleIdentity(value: unknown): TailscaleIdentity {
  if (!isRecord(value) || value.BackendState !== "Running") {
    throw new Error("Tailscale is not signed in.");
  }
  const self = value.Self;
  const users = value.User;
  if (!isRecord(self) || !isRecord(users)) {
    throw new Error("Tailscale identity is unavailable.");
  }
  const dnsName = self.DNSName;
  const userId = self.UserID;
  if (
    typeof dnsName !== "string" ||
    (typeof userId !== "number" && typeof userId !== "string")
  ) {
    throw new Error("Tailscale identity is unavailable.");
  }
  const hostname = dnsName.endsWith(".") ? dnsName.slice(0, -1) : dnsName;
  const origin = `https://${hostname}`;
  const user = users[String(userId)];
  const login = isRecord(user) ? user.LoginName : undefined;
  if (typeof login !== "string") {
    throw new Error("Tailscale owner login is unavailable.");
  }
  const parsed = HostSetupSnapshotSchema.shape.tailscale.parse({
    state: "ready",
    origin,
    login,
  });
  return { origin: parsed.origin!, login: parsed.login! };
}

export function extractApprovalUrl(error: unknown): string | null {
  const output =
    error instanceof Error
      ? [
          "stdout" in error && typeof error.stdout === "string"
            ? error.stdout
            : "",
          "stderr" in error && typeof error.stderr === "string"
            ? error.stderr
            : "",
        ].join("\n")
      : "";
  for (const candidate of output.match(APPROVAL_URL) ?? []) {
    try {
      const url = new URL(candidate);
      if (
        url.protocol === "https:" &&
        url.hostname === "login.tailscale.com" &&
        url.username === "" &&
        url.password === "" &&
        candidate.length <= 2_048
      ) {
        return candidate;
      }
    } catch {
      // Ignore malformed command output.
    }
  }
  return null;
}

function unavailableSnapshot(
  tmuxSessions: Awaited<ReturnType<HostSetupService["inspectTmux"]>>,
  state: "not_installed" | "signed_out" | "unavailable",
  detail: string,
): HostSetupSnapshot {
  return HostSetupSnapshotSchema.parse({
    status: "unavailable",
    tmuxSessions,
    selectedTmuxSessionId: null,
    tailscale: { state, origin: null, login: null },
    remoteUrl: null,
    canApply: false,
    detail,
  });
}

function result(
  outcome: HostSetupApplyResult["outcome"],
  snapshot: HostSetupSnapshot,
  approvalUrl: string | null,
): HostSetupApplyResult {
  return HostSetupApplyResultSchema.parse({
    outcome,
    snapshot,
    approvalUrl,
  });
}

function commandOptions(
  environment: Readonly<Record<string, string>>,
  timeout: number,
) {
  return {
    env: environment,
    timeout,
    maxBuffer: MAX_OUTPUT_BYTES,
  };
}

async function executeCommand(
  executable: string,
  args: readonly string[],
  options: {
    env: Readonly<Record<string, string>>;
    timeout: number;
    maxBuffer: number;
  },
): Promise<CommandResult> {
  return execFileAsync(executable, [...args], {
    encoding: "utf8",
    env: { ...options.env },
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    windowsHide: true,
  });
}

function isEmptyJson(value: string): boolean {
  try {
    return isDeepEmpty(JSON.parse(value) as unknown);
  } catch {
    return false;
  }
}

function isDeepEmpty(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isRecord(value)) {
    return (
      Object.keys(value).length === 0 || Object.values(value).every(isDeepEmpty)
    );
  }
  return value === null;
}

function isSignedOutStatus(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const output = [
    error.message,
    "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
    "stderr" in error && typeof error.stderr === "string" ? error.stderr : "",
  ].join(" ");
  return /Logged out|NeedsLogin|not logged in|not signed in/i.test(output);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
