import { describe, expect, it, vi } from "vitest";

import { observeVerificationHead } from "./verification-head.js";

describe("verification HEAD observation", () => {
  it("uses one fixed local HEAD command", async () => {
    const runGit = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: `${"a".repeat(40)}\n`,
      stderr: "",
    });

    await expect(observeVerificationHead("/work/repo", runGit)).resolves.toBe(
      "a".repeat(40),
    );
    expect(runGit).toHaveBeenCalledWith("/work/repo", [
      "-c",
      "core.fsmonitor=false",
      "-C",
      "/work/repo",
      "rev-parse",
      "--verify",
      "HEAD",
    ]);
  });

  it("returns unavailable for unborn, malformed, and failed observations", async () => {
    await expect(
      observeVerificationHead("/work/repo", () =>
        Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }),
      ),
    ).resolves.toBeNull();
    await expect(
      observeVerificationHead("/work/repo", () =>
        Promise.resolve({ exitCode: 0, stdout: "not-an-object\n", stderr: "" }),
      ),
    ).resolves.toBeNull();
    await expect(
      observeVerificationHead("/work/repo", () =>
        Promise.reject(new Error("git unavailable")),
      ),
    ).resolves.toBeNull();
  });
});
