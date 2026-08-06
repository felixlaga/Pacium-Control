import { expect, test, type Page } from "@playwright/test";

const repositoryRoot = process.cwd();
const sessionName = "Capability fixture";
const labelledStatus =
  /(Working|Waiting|Needs input|Finished|Failed|Stale|Unknown) · (Provider native|Provider hook|Human labelled|Process observed|Terminal inferred) · \d+[smhd] ago|Running · no provider signal/;

test.afterEach(async ({ page }) => {
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

test("provider state stays labelled in the header while the terminal remains usable", async ({
  page,
}) => {
  const { status, terminal } = await openClaudeTerminal(page);

  // The header must always name the state, the evidence source, and the
  // freshness of the observation — never an unlabelled guess.
  await expect(status).toBeVisible();
  await expect(status).toHaveText(labelledStatus);

  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("printf 'PC-degraded terminal stays usable\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-degraded terminal stays usable",
  );
  // The degraded provider signal never disables the direct terminal.
  await expect(status).toHaveText(labelledStatus);
});

async function openClaudeTerminal(page: Page) {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  const createDialog = page.getByRole("dialog", { name: "Open a terminal" });
  const claudePreset = createDialog.getByRole("radio", {
    name: /Claude Code/,
  });
  await expect(claudePreset).toBeEnabled();
  await createDialog.locator('label[title="Claude Code"]').click();
  await expect(claudePreset).toBeChecked();
  await createDialog.getByLabel("Working directory").fill(repositoryRoot);
  await createDialog.getByPlaceholder("Project shell").fill(sessionName);
  await createDialog
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();

  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText(sessionName);
  return {
    status: page.locator(".stage-status"),
    terminal: page.getByLabel(`Terminal for ${sessionName}`, { exact: true }),
    title,
  };
}
