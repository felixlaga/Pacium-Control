import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  const openDialog = page.getByRole("dialog");
  if ((await openDialog.count()) > 0) {
    await page.keyboard.press("Escape");
  }
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  const sessions = sidebar
    .locator(".session-item")
    .filter({ hasText: "Recovery fixture" });
  while ((await sessions.count()) > 0) {
    const previousCount = await sessions.count();
    await sessions.first().click({ button: "right" });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: /Terminate process and close|Remove session/,
      })
      .click();
    await expect
      .poll(() => sessions.count(), { timeout: 10_000 })
      .toBeLessThan(previousCount);
  }
});

test("previews a detached manifest and relaunches a fresh successor", async ({
  page,
}) => {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");

  await page.getByRole("button", { name: "Open first terminal" }).click();
  await page.getByPlaceholder("Project shell").fill("Recovery fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(workspaceStatus).toContainText("Recovery fixture");

  const terminal = page.getByRole("main", { name: "Terminal workspace" });
  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("exit");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "Recovery fixture" });
  await expect(actions).toContainText("Shell · exited");
  await expect(actions).toContainText("Remove this ended session record");
  page.once("dialog", (dialog) => dialog.accept());
  await actions.getByRole("button", { name: "Remove session" }).click();

  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  const recovery = sidebar
    .locator(".recovery-item")
    .filter({ hasText: "Recovery fixture" });
  await expect(recovery).toBeVisible();
  await recovery.click();

  const preview = page.getByRole("dialog", {
    name: "Relaunch Recovery fixture",
  });
  await expect(preview).toContainText(
    "fresh PTY with a new immutable session ID",
  );
  await expect(preview).toContainText("key names only");
  await expect(preview).toContainText("not resumed automatically");
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(recovery).toBeFocused();

  await recovery.click();
  await preview.getByRole("button", { name: "Start fresh process" }).click();
  await expect(workspaceStatus).toContainText("Recovery fixture");
  await expect(recovery).toHaveCount(0);
  await expect(terminal.locator(".xterm-helper-textarea")).toBeVisible();
});
