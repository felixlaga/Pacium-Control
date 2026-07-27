import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumRoleCard, PaciumRoleGroup } from "./pacium-role-card.js";
import type { PaciumRoleModel } from "./pacium-role-model.js";

describe("pinned Pacium role semantics", () => {
  it("renders Meta then Orchestrator as a labelled two-role group", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleGroup
        onConfigure={() => undefined}
        onLaunch={() => undefined}
        onOpen={() => undefined}
        onRetry={() => undefined}
        roles={[
          model({
            role: "meta",
            label: "Meta",
            status: "connected",
            statusLabel: "Connected",
            sessionId: "00000000-0000-4000-8000-000000000001",
            canOpen: true,
          }),
          model({
            role: "orchestrator",
            label: "Orchestrator",
            status: "ready",
            statusLabel: "Ready to launch",
            launchPreset: "codex",
            launchCwd: "/work/pacium",
            canLaunch: true,
          }),
        ]}
      />,
    );

    expect(markup).toContain('aria-labelledby="pacium-role-heading"');
    expect(markup.indexOf("Meta role")).toBeLessThan(
      markup.indexOf("Orchestrator role"),
    );
    expect(markup).toContain(">Open</button>");
    expect(markup).toContain(">Launch</button>");
  });

  it("renders hostile role evidence only as escaped text", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleCard
        model={model({
          status: "error",
          statusLabel: "Configuration error",
          detail: "<img src=x onerror=terminal()>",
          context: "</small><script>role()</script>",
          canRetry: true,
        })}
        onConfigure={() => undefined}
        onLaunch={() => undefined}
        onOpen={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain("&lt;img src=x onerror=terminal()&gt;");
    expect(markup).toContain("&lt;/small&gt;&lt;script&gt;role()");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain(">Retry</button>");
  });

  it("keeps unavailable and disconnected mutations visibly disabled", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleCard
        model={model({
          status: "unavailable",
          statusLabel: "Disconnected · Unavailable",
          launchPreset: "claude",
          launchCwd: "/work",
          canLaunch: false,
          canConfigure: false,
          connectionLabel: "Server disconnected",
        })}
        onConfigure={() => undefined}
        onLaunch={() => undefined}
        onOpen={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain("Server disconnected");
    expect(markup).toContain("<button");
    expect(markup.match(/disabled/g)?.length).toBe(2);
  });

  it("does not offer another mutation while a launch is binding", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleCard
        model={model({
          status: "binding",
          statusLabel: "Binding terminal",
        })}
        onConfigure={() => undefined}
        onLaunch={() => undefined}
        onOpen={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(markup).not.toContain("<button");
    expect(markup).toContain("Binding terminal");
  });
});

function model(overrides: Partial<PaciumRoleModel> = {}): PaciumRoleModel {
  return {
    role: "meta",
    label: "Meta",
    status: "unassigned",
    statusLabel: "Not assigned",
    detail: "No binding is configured.",
    context: null,
    connectionLabel: "Server connected",
    sessionId: null,
    launchPreset: null,
    launchCwd: null,
    canOpen: false,
    canLaunch: false,
    canConfigure: true,
    canRetry: false,
    saving: false,
    ...overrides,
  };
}
