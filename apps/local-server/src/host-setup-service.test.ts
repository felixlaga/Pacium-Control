import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  HostSetupDocument,
  MetaSessionCapability,
  TmuxSessionsObservation,
} from "@pacium/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadServerConfig } from "./config.js";
import {
  extractApprovalUrl,
  HostSetupService,
  projectTailscaleIdentity,
} from "./host-setup-service.js";

const directories: string[] = [];
const observation: TmuxSessionsObservation = {
  status: "ready",
  serverId: "configured",
  observedAt: "2026-07-28T10:00:00.000Z",
  sessions: [
    {
      target: {
        serverId: "configured",
        sessionId: "$7",
        sessionName: "meta",
        observedAt: "2026-07-28T10:00:00.000Z",
      },
      windows: 1,
      attachedClients: 0,
      createdAt: "2026-07-28T09:00:00.000Z",
      currentPath: process.cwd(),
    },
  ],
  error: null,
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("local host setup", () => {
  it("projects only one canonical current-node identity", () => {
    expect(
      projectTailscaleIdentity({
        BackendState: "Running",
        Self: {
          DNSName: "felix-harness.example-tailnet.ts.net.",
          UserID: 42,
          HostName: "<ignored>",
        },
        User: {
          "42": {
            LoginName: "felix@example.com",
            DisplayName: "<ignored>",
          },
        },
        Peer: { secret: "ignored" },
      }),
    ).toEqual({
      origin: "https://felix-harness.example-tailnet.ts.net",
      login: "felix@example.com",
    });

    for (const value of [
      {},
      { BackendState: "NeedsLogin" },
      {
        BackendState: "Running",
        Self: {
          DNSName: "host.example.com.",
          UserID: 42,
        },
        User: { "42": { LoginName: "felix@example.com" } },
      },
    ]) {
      expect(() => projectTailscaleIdentity(value)).toThrow();
    }
  });

  it("accepts only canonical Tailscale approval links", () => {
    expect(
      extractApprovalUrl(
        Object.assign(new Error("approval"), {
          stderr:
            "Open https://login.tailscale.com/admin/serve?node=abc to continue",
        }),
      ),
    ).toBe("https://login.tailscale.com/admin/serve?node=abc");
    expect(
      extractApprovalUrl(
        Object.assign(new Error("hostile"), {
          stderr: "Open https://login.tailscale.com.evil.test/steal",
        }),
      ),
    ).toBeNull();
  });

  it("applies one published Meta choice with one fixed Serve command", async () => {
    const fixture = await createFixture();
    const calls: Array<{ executable: string; args: readonly string[] }> = [];
    const execute = vi.fn(
      (
        executable: string,
        args: readonly string[],
      ): Promise<{ stdout: string; stderr: string }> => {
        calls.push({ executable, args });
        if (args[0] === "status") {
          return Promise.resolve({
            stdout: tailscaleStatus(),
            stderr: "",
          });
        }
        if (args[0] === "serve" && args[1] === "status") {
          return Promise.resolve({ stdout: "{}", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      },
    );
    const service = new HostSetupService(
      fixture.config,
      fixture.sessions,
      fixture.store,
      {},
      execute,
      "/opt/test/tailscale",
    );

    const before = await service.inspect();
    expect(before.status).toBe("ready");
    expect(before.tmuxSessions).toEqual([{ id: "$7", name: "meta" }]);

    const applied = await service.apply({ tmuxSessionId: "$7" });
    expect(applied.outcome).toBe("configured");
    expect(applied.snapshot.remoteUrl).toBe(
      "https://felix-harness.example-tailnet.ts.net",
    );
    expect(calls).toContainEqual({
      executable: "/opt/test/tailscale",
      args: ["serve", "--bg", "--yes", "4174"],
    });
    expect(fixture.saved?.metaTmuxSessionName).toBe("meta");
    expect(fixture.config.metaTmuxSessionName).toBe("meta");
    expect(fixture.config.tailscaleServe?.operatorLogins).toEqual(
      new Set(["felix@example.com"]),
    );
    expect(fixture.attach).toHaveBeenCalledWith("meta");
  });

  it("returns verified consent and refuses unknown existing Serve state", async () => {
    const approvalFixture = await createFixture();
    const approvalError = Object.assign(new Error("consent"), {
      stdout: "Visit https://login.tailscale.com/admin/serve?node=abc",
      stderr: "",
    });
    const approvalExecute = vi.fn(
      (_executable: string, args: readonly string[]) => {
        if (args[0] === "status") {
          return Promise.resolve({
            stdout: tailscaleStatus(),
            stderr: "",
          });
        }
        if (args[1] === "status") {
          return Promise.resolve({ stdout: "{}", stderr: "" });
        }
        return Promise.reject(approvalError);
      },
    );
    const approvalService = new HostSetupService(
      approvalFixture.config,
      approvalFixture.sessions,
      approvalFixture.store,
      {},
      approvalExecute,
      "/opt/test/tailscale",
    );
    const approval = await approvalService.apply({ tmuxSessionId: "$7" });
    expect(approval.outcome).toBe("approval_required");
    expect(approval.approvalUrl).toBe(
      "https://login.tailscale.com/admin/serve?node=abc",
    );
    expect(approvalFixture.saved).toBeNull();

    const existingFixture = await createFixture();
    const existingExecute = vi.fn(
      (_executable: string, args: readonly string[]) =>
        Promise.resolve({
          stdout:
            args[0] === "status"
              ? tailscaleStatus()
              : '{"Web":{"host:443":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:3000"}}}}}',
          stderr: "",
        }),
    );
    const existingService = new HostSetupService(
      existingFixture.config,
      existingFixture.sessions,
      existingFixture.store,
      {},
      existingExecute,
      "/opt/test/tailscale",
    );
    const snapshot = await existingService.inspect();
    expect(snapshot.tailscale.state).toBe("existing_serve");
    expect(snapshot.canApply).toBe(false);
    const refused = await existingService.apply({ tmuxSessionId: "$7" });
    expect(refused.outcome).toBe("refused");
    expect(
      existingExecute.mock.calls.some(
        ([, args]) => args[0] === "serve" && args[1] === "--bg",
      ),
    ).toBe(false);
  });

  it("does not reuse the fixed setup operation for another local port", async () => {
    const fixture = await createFixture();
    fixture.config.port = 5000;
    const execute = vi.fn(() =>
      Promise.resolve({ stdout: tailscaleStatus(), stderr: "" }),
    );
    const service = new HostSetupService(
      fixture.config,
      fixture.sessions,
      fixture.store,
      {},
      execute,
      "/opt/test/tailscale",
    );

    const snapshot = await service.inspect();
    expect(snapshot.status).toBe("unavailable");
    expect(snapshot.canApply).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});

async function createFixture() {
  const dataDirectory = await mkdtemp(join(tmpdir(), "pacium-host-setup-"));
  directories.push(dataDirectory);
  const config = loadServerConfig({
    HOME: process.env.HOME,
    PACIUM_DATA_DIR: dataDirectory,
    SHELL: "/bin/sh",
  });
  config.tmuxSocket = "/private/tmp/default.sock";
  let saved: HostSetupDocument | null = null;
  const attach = vi.fn((): Promise<MetaSessionCapability> =>
    Promise.resolve({
      state: "ready",
      sessionId: "10000000-0000-4000-8000-000000000001",
      detail: "Meta ready.",
    }),
  );
  return {
    config,
    attach,
    sessions: {
      discoverTmux: () => Promise.resolve(observation),
      attachConfiguredMetaTmux: attach,
    },
    store: {
      inspect: () => Promise.resolve(saved),
      replace: (document: HostSetupDocument) => {
        saved = document;
        return Promise.resolve(document);
      },
    },
    get saved() {
      return saved;
    },
  };
}

function tailscaleStatus(): string {
  return JSON.stringify({
    BackendState: "Running",
    Self: {
      DNSName: "felix-harness.example-tailnet.ts.net.",
      UserID: 42,
    },
    User: {
      "42": {
        LoginName: "felix@example.com",
      },
    },
  });
}
