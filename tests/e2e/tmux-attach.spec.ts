import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test.skip(
  process.env.PACIUM_TMUX_SOCKET === undefined ||
    process.env.PACIUM_E2E_TMUX_EXECUTABLE === undefined,
  "tmux is not installed for the isolated attachment canary",
);

test.afterEach(async ({ page }) => {
  const dialog = page.getByRole("dialog");
  if ((await dialog.count()) > 0) {
    await page.keyboard.press("Escape");
  }
  const session = page
    .locator(".session-item")
    .filter({ hasText: "pacium-e2e" });
  if ((await session.count()) > 0) {
    await session.first().click({ button: "right" });
    page.once("dialog", (confirmation) => confirmation.accept());
    await page
      .getByRole("button", {
        name: /Disconnect tmux client and close|Remove session/,
      })
      .click();
    await expect(session).toHaveCount(0);
  }
});

test("attaches, reconnects, and disconnects one external tmux session", async ({
  page,
}) => {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");

  const attachButton = page.getByRole("button", { name: /Attach tmux/ });
  await expect(attachButton).toContainText("ready");
  await attachButton.click();

  const dialog = page.getByRole("dialog", {
    name: "Attach a tmux session",
  });
  await expect(dialog).toContainText("pacium-e2e");
  await expect(dialog).toContainText("revalidated immediately");
  await dialog
    .locator(".tmux-session-option")
    .filter({
      hasText: "pacium-e2e",
    })
    .click();
  await dialog.getByRole("button", { name: "Attach session" }).click();

  await expect(dialog).toBeHidden();
  await expect(workspaceStatus).toContainText("pacium-e2e");
  const session = page
    .locator(".session-item")
    .filter({ hasText: "pacium-e2e" });
  await expect(session).toContainText("tmux");

  const terminal = page.getByRole("main", { name: "Terminal workspace" });
  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("printf 'PC-070 tmux attached\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-070 tmux attached",
  );

  await page.reload();
  await expect(workspaceStatus).toContainText("Connected");
  await expect(session).toBeVisible();
  await session.click();
  await expect(workspaceStatus).toContainText("pacium-e2e");

  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "pacium-e2e" });
  await expect(actions).toContainText(
    "Client and tmux server session keep running",
  );
  await actions.getByRole("button", { name: "Close browser view" }).click();
  await expect(session).toBeVisible();

  await session.click();
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  page.once("dialog", (confirmation) => {
    expect(confirmation.message()).toContain(
      "the tmux server session may continue",
    );
    confirmation.accept();
  });
  await page
    .getByRole("button", { name: "Disconnect tmux client and close" })
    .click();
  await expect(session).toHaveCount(0);

  const output = execFileSync(process.env.PACIUM_E2E_TMUX_EXECUTABLE!, [
    "-S",
    process.env.PACIUM_TMUX_SOCKET!,
    "list-sessions",
    "-F",
    "#{session_name}",
  ]).toString();
  expect(output).toContain("pacium-e2e");
});
