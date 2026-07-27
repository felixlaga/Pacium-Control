import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConnectionBadge } from "./connection-badge.js";

describe("connection badge", () => {
  it("renders textual local and remote evidence with accessible identity", () => {
    const local = renderToStaticMarkup(
      <ConnectionBadge access={{ kind: "local" }} state="connected" />,
    );
    expect(local).toContain("Pacium local connection: connected.");
    expect(local).toContain("Local");
    expect(local).toContain("connected");

    const remote = renderToStaticMarkup(
      <ConnectionBadge
        access={{
          kind: "tailscale",
          login: "very-long-owner-login@example.com",
        }}
        state="connected"
      />,
    );
    expect(remote).toContain(
      "Pacium Tailscale connection for very-long-owner-login@example.com: connected.",
    );
    expect(remote).toContain('title="very-long-owner-login@example.com"');
    expect(remote).toContain("Tailscale");
  });

  it("does not render stale identity while reconnecting", () => {
    const html = renderToStaticMarkup(
      <ConnectionBadge
        access={{ kind: "tailscale", login: "former@example.com" }}
        state="reconnecting"
      />,
    );
    expect(html).toContain("Pacium connection: reconnecting.");
    expect(html).not.toContain("former@example.com");
    expect(html).not.toContain("Tailscale");
  });
});
