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

  await expect(page.locator(".shell")).toBeVisible();
  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText(/pacium-e2e|· Meta$/);

  const terminal = page.getByLabel("Terminal for pacium-e2e", { exact: true });
  const input = terminal.locator(".xterm-helper-textarea");
  await expect(input).toBeFocused();
  await page.keyboard.type("printf 'PC-079 Meta focused\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-079 Meta focused",
  );

  await page.reload();
  await expect(title).toHaveText(/pacium-e2e|· Meta$/);
  await expect(input).toBeFocused();
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-079 Meta focused",
  );
  await expect(
    page.locator(".session-row, .role-row").filter({ hasText: "pacium-e2e" }),
  ).toHaveCount(1);
});
