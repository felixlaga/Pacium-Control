import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaciumRoleBindingDialog } from "./pacium-role-binding.js";
import type { PaciumRoleBindingOptions } from "./pacium-role-binding-model.js";

describe("Pacium role binding dialog semantics", () => {
  it("labels the role and exposes only bounded session/preset/repository choices", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleBindingDialog
        binding={{
          type: "session",
          sessionId: "00000000-0000-4000-8000-000000000001",
        }}
        connected
        onCancel={() => undefined}
        onSave={() => undefined}
        options={options()}
        role="meta"
        saving={false}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Assign Meta");
    expect(markup).toContain("Running session");
    expect(markup).toContain("Meta terminal");
    expect(markup).toContain("Launch preset");
    expect(markup).toContain("Save Meta");
    expect(markup).not.toContain("executable");
    expect(markup).not.toContain("terminal.input");
  });

  it("renders hostile labels and paths as text", () => {
    const hostile = options();
    hostile.sessions[0] = {
      ...hostile.sessions[0]!,
      label: "<script>session()</script>",
      detail: "</small><img src=x>",
    };
    const markup = renderToStaticMarkup(
      <PaciumRoleBindingDialog
        binding={null}
        connected
        onCancel={() => undefined}
        onSave={() => undefined}
        options={hostile}
        role="orchestrator"
        saving={false}
      />,
    );

    expect(markup).toContain("&lt;script&gt;session()&lt;/script&gt;");
    expect(markup).toContain("&lt;/small&gt;&lt;img src=x&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("disables saving while disconnected without hiding terminal survival", () => {
    const markup = renderToStaticMarkup(
      <PaciumRoleBindingDialog
        binding={null}
        connected={false}
        onCancel={() => undefined}
        onSave={() => undefined}
        options={options()}
        role="meta"
        saving={false}
      />,
    );

    expect(markup).toContain(
      "Reconnect before saving. Existing terminals are unchanged.",
    );
    expect(markup).toContain('disabled="" type="submit"');
  });
});

function options(): PaciumRoleBindingOptions {
  return {
    sessions: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        label: "Meta terminal",
        detail: "Codex · /work/pacium",
      },
    ],
    presets: [
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
        unavailableReason: "Not installed.",
      },
    ],
    repositories: [
      {
        id: "pacium",
        label: "Pacium",
        root: "/work/pacium",
      },
    ],
  };
}
