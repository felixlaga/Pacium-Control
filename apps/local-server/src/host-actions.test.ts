import { describe, expect, it, vi } from "vitest";

import {
  createHostActions,
  HostActionError,
  revealCommand,
} from "./host-actions.js";

describe("host actions", () => {
  it("uses fixed executables and argument arrays without a shell", () => {
    expect(revealCommand("darwin", "/work/project")).toEqual({
      executable: "/usr/bin/open",
      args: ["/work/project"],
    });
    expect(revealCommand("linux", "/work/project")).toEqual({
      executable: "/usr/bin/xdg-open",
      args: ["/work/project"],
    });
  });

  it("rejects relative paths and unsupported platforms", () => {
    expect(() => revealCommand("darwin", "../other")).toThrow(HostActionError);
    expect(() => revealCommand("win32", "/work/project")).toThrow(
      "not supported",
    );
  });

  it("runs only the resolved fixed command and bounds failures", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const actions = createHostActions("darwin", run);
    await actions.revealPath("/work/project");
    expect(run).toHaveBeenCalledWith("/usr/bin/open", ["/work/project"]);

    const failing = createHostActions(
      "darwin",
      vi.fn().mockRejectedValue(new Error("private host error")),
    );
    await expect(failing.revealPath("/work/project")).rejects.toMatchObject({
      code: "REVEAL_FAILED",
      retryable: true,
    });
  });
});
