import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  const openDialog = page.getByRole("dialog");
  if ((await openDialog.count()) > 0) {
    await page.keyboard.press("Escape");
  }
  const rows = page
    .locator(".session-row")
    .filter({ hasText: "Recovery fixture" });
  while ((await rows.count()) > 0) {
    const previousCount = await rows.count();
    const row = rows.first();
    await row.locator(".session-select").click();
    await row.getByRole("button", { name: /^Actions for / }).click();
    // The session may still be live if the injected "exit" has not landed
    // yet, so handle both menu variants and their confirm dialogs.
    const removeItem = page.getByRole("button", { name: "Remove session" });
    if (await removeItem.count()) {
      await removeItem.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Remove session" })
        .click();
    } else {
      await page
        .getByRole("button", {
          name: /Terminate process and close|Disconnect (tmux client and close|keep-alive client)/,
        })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Terminate process|Disconnect and close/ })
        .click();
    }
    await expect
      .poll(() => rows.count(), { timeout: 15_000 })
      .toBeLessThan(previousCount);
  }
});

test("previews the retained manifest of an exited session and relaunches a fresh successor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByPlaceholder("Project shell").fill("Recovery fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText("Recovery fixture");

  const terminal = page.getByLabel("Terminal for Recovery fixture", {
    exact: true,
  });
  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("exit");
  await page.keyboard.press("Enter");
  await expect(page.locator(".stage-status")).toContainText("Exited");

  await page
    .getByRole("button", { name: "Actions for Recovery fixture" })
    .click();
  const actions = page.getByRole("dialog", { name: "Recovery fixture" });
  await expect(actions).toContainText("exited");
  await actions.getByRole("button", { name: "Relaunch ended session" }).click();

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

  await page
    .getByRole("button", { name: "Actions for Recovery fixture" })
    .first()
    .click();
  await actions.getByRole("button", { name: "Relaunch ended session" }).click();
  await preview.getByRole("button", { name: "Start fresh process" }).click();
  await expect(preview).toBeHidden();

  // The successor is a fresh live session; the ended record is preserved.
  await expect(title).toHaveText("Recovery fixture");
  await expect(page.locator(".stage-status")).not.toContainText("Exited");
  const composer = page.getByPlaceholder("Send to Recovery fixture");
  await expect(composer).toBeEnabled();
  await composer.fill("printf 'PC-076 relaunched\\n'");
  await composer.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-076 relaunched",
  );
  await expect(
    page.locator(".session-row").filter({ hasText: "Recovery fixture" }),
  ).toHaveCount(2);
});
