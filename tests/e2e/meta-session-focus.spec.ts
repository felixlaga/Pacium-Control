import { expect, test } from "@playwright/test";

test.skip(
  process.env.PACIUM_E2E_META_FOCUS !== "1" ||
    process.env.PACIUM_TMUX_SOCKET === undefined ||
    process.env.PACIUM_E2E_TMUX_EXECUTABLE === undefined,
  "run with PACIUM_E2E_META_FOCUS=1 and the isolated tmux fixture",
);

test("opens the configured Meta tmux session once in terminal-first view", async ({
  page,
}) => {
  await page.goto("/");

  const shell = page.locator(".app-shell");
  await expect(shell).toHaveAttribute("data-meta-focus", "true");
  await expect(shell).toHaveClass(/is-sidebar-collapsed/);
  await expect(shell).toHaveClass(/is-inspector-collapsed/);
  await expect(shell).toHaveAttribute("data-workspace-mode", "pacium");
  await expect(page.locator(".pacium-prompt-composer")).toHaveCount(0);

  const terminal = page.getByRole("main", { name: "Terminal workspace" });
  const input = terminal.locator(".xterm-helper-textarea");
  await expect(input).toBeFocused();
  await page.keyboard.type("printf 'PC-079 Meta focused\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-079 Meta focused",
  );

  await page.reload();
  await expect(shell).toHaveAttribute("data-meta-focus", "true");
  await expect(input).toBeFocused();
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-079 Meta focused",
  );
  await page.getByRole("button", { name: "Show session sidebar" }).click();
  await expect(
    page.locator(".session-item").filter({ hasText: "pacium-e2e" }),
  ).toHaveCount(1);
});
