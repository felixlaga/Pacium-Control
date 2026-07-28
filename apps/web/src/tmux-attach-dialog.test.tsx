import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TmuxAttachDialog } from "./tmux-attach-dialog.js";

const capability = {
  state: "ready" as const,
  serverId: "configured",
  executable: "/opt/homebrew/bin/tmux",
  version: "tmux 3.7b",
  detail: "One explicit local tmux socket is configured.",
};

describe("tmux attach dialog", () => {
  it("renders bounded server-published targets without socket authority", () => {
    const markup = renderToStaticMarkup(
      <TmuxAttachDialog
        attaching={false}
        capability={capability}
        connected
        error={null}
        loading={false}
        observation={{
          status: "ready",
          serverId: "configured",
          observedAt: "2026-07-28T10:00:00.000Z",
          sessions: [
            {
              target: {
                serverId: "configured",
                sessionId: "$4",
                sessionName: "<Meta>",
                observedAt: "2026-07-28T10:00:00.000Z",
              },
              windows: 2,
              attachedClients: 1,
              createdAt: "2026-07-28T09:00:00.000Z",
              currentPath: "/work/pacium",
            },
          ],
          error: null,
        }}
        onAttach={() => undefined}
        onCancel={() => undefined}
        onRefresh={() => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Attach a tmux session");
    expect(markup).toContain("&lt;Meta&gt;");
    expect(markup).toContain("$4 · 2 windows · 1 attached");
    expect(markup).toContain("/work/pacium");
    expect(markup).toContain("revalidated immediately before attachment");
    expect(markup).not.toContain("/opt/homebrew/bin/tmux");
    expect(markup).not.toContain("PACIUM_TMUX_SOCKET");
  });

  it("explains loading and failure without hiding direct terminals", () => {
    const loading = renderToStaticMarkup(
      <TmuxAttachDialog
        attaching={false}
        capability={capability}
        connected
        error={null}
        loading
        observation={null}
        onAttach={() => undefined}
        onCancel={() => undefined}
        onRefresh={() => undefined}
      />,
    );
    expect(loading).toContain("Inspecting the configured socket");

    const failed = renderToStaticMarkup(
      <TmuxAttachDialog
        attaching={false}
        capability={capability}
        connected
        error="The socket disappeared."
        loading={false}
        observation={null}
        onAttach={() => undefined}
        onCancel={() => undefined}
        onRefresh={() => undefined}
      />,
    );
    expect(failed).toContain("The socket disappeared.");
    expect(failed).toContain("Direct terminals remain available.");
  });
});
