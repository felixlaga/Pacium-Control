import { expect, test } from "@playwright/test";

const sessionName = "Terminate fixture";

test.afterEach(async ({ page }) => {
  // If terminate worked, nothing is left. Otherwise end the process from
  // inside the terminal and remove the ended record so later specs stay clean.
  const rows = page.locator(".session-row").filter({ hasText: sessionName });
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

test("terminate action ends a live session's process and removes its row", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByPlaceholder("Project shell").fill(sessionName);
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(page.locator(".stage-title h1")).toHaveText(sessionName);

  await page
    .getByRole("button", { name: `Actions for ${sessionName}` })
    .click();
  await page
    .getByRole("button", { name: "Terminate process and close" })
    .click();
  // Terminating is destructive, so a confirmation dialog states the
  // consequence before anything is signalled.
  const confirmDialog = page.getByRole("dialog", { name: sessionName });
  await expect(confirmDialog).toContainText("SIGTERM");
  await confirmDialog
    .getByRole("button", { name: "Terminate process" })
    .click();
  await expect(
    page.locator(".session-row").filter({ hasText: sessionName }),
  ).toHaveCount(0);
});
