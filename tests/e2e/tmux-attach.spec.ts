import { expect, test, type Page } from "@playwright/test";

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
  const rows = page
    .locator(".session-row")
    .filter({ hasText: /pacium-e2e|PC-071 keep-alive/ });
  while ((await rows.count()) > 0) {
    const previousCount = await rows.count();
    const row = rows.first();
    await row.locator(".session-select").click();
    const composer = page.locator("form.composer textarea");
    if (await composer.isEnabled()) {
      // Detach the tmux client in-band (prefix + d) so the client process
      // ends while the external tmux session keeps running.
      await page.locator(".xterm-helper-textarea").focus();
      await page.keyboard.press("Control+b");
      await page.keyboard.press("d");
    }
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

test("attaches one external tmux session into the single-terminal stage", async ({
  page,
}) => {
  const { row, terminal } = await attachTmuxSession(page);

  await expect(terminal.locator(".xterm-rows")).toContainText(/[%$#>]/, {
    timeout: 15_000,
  });
  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("printf 'PC-070 tmux attached\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-070 tmux attached",
    { timeout: 15_000 },
  );

  await page.getByRole("button", { name: "Actions for pacium-e2e" }).click();
  const actions = page.getByRole("dialog", { name: "pacium-e2e" });
  await expect(actions).toContainText(
    "Client and tmux server session keep running",
  );
  await actions.getByRole("button", { name: "Close browser view" }).click();
  await expect(row).toBeVisible();
  await expect(page.locator(".stage-empty")).toContainText(
    "Pick a session from the sidebar",
  );
});

test("keeps the attached tmux session in the sidebar and selectable after a reload", async ({
  page,
}) => {
  const { row, title } = await attachTmuxSession(page);

  await page.reload();
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  // The tmux client keeps running host-side; the reloaded sidebar still lists
  // it and selecting it restores its title in the single-terminal stage.
  await expect(row).toBeVisible();
  await row.locator(".session-select").click();
  await expect(title).toHaveText("pacium-e2e");
});

test("offers keep-alive as an explicit unchecked launch choice", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  const createDialog = page.getByRole("dialog", { name: "Open a terminal" });
  const keepAlive = createDialog.getByLabel("Keep alive with tmux");
  await expect(keepAlive).not.toBeChecked();
  await keepAlive.check();
  await expect(createDialog).toContainText(
    "Closing Pacium disconnects its client but does not kill the tmux target.",
  );
});

async function attachTmuxSession(page: Page) {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  // The rail footer only offers attachment once the tmux capability is ready.
  const attachButton = page.getByRole("button", { name: "Attach tmux" });
  await expect(attachButton).toBeVisible();
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
  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText("pacium-e2e");
  await expect(page.locator(".notice-bar")).toContainText(
    "attached through tmux",
  );
  await page.getByRole("button", { name: "Dismiss notice" }).click();
  const row = page.locator(".session-row").filter({ hasText: "pacium-e2e" });
  await expect(row).toBeVisible();
  const terminal = page.getByLabel("Terminal for pacium-e2e", { exact: true });
  return { row, terminal, title };
}
