import { expect, test, type Page } from "@playwright/test";

const repositoryRoot = process.env.PACIUM_E2E_VERIFICATION_REPOSITORY;
if (repositoryRoot === undefined) {
  throw new Error("The verification repository fixture is unavailable.");
}

test.afterEach(async ({ page }) => {
  const rows = page
    .locator(".session-row")
    .filter({ hasText: "Verification fixture" });
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

test("configured checks load lazily, run, survive a reload, and cancel", async ({
  page,
}) => {
  const title = await openVerificationTerminal(page);
  const filesPanel = page.getByRole("complementary", {
    name: "Repository files and git",
  });
  await expect(
    page.locator(".repository-verification-panel"),
  ).not.toBeAttached();

  await filesPanel.getByRole("tab", { name: "Git" }).click();
  await filesPanel.getByRole("tab", { name: "Checks" }).click();
  const checksPanel = page.locator(".repository-verification-panel");
  await expect(checksPanel).toContainText("2 configured checks");
  await expect(title).toHaveText("Verification fixture");

  const verifyCard = checksPanel
    .getByRole("listitem")
    .filter({ hasText: "Project verify" });
  await expect(verifyCard).toContainText("Exact argv");
  await expect(verifyCard).toContainText("PC-037 verified");
  await verifyCard.getByRole("button", { name: "Run" }).click();
  const result = checksPanel.locator(".verification-run-result");
  await expect(result).toContainText("Verification passed");
  await expect(result).toContainText("PC-037 verified");
  await expect(result).toContainText("Exit code");
  await expect(result).toContainText("0");
  await expect(title).toHaveText("Verification fixture");

  const waitCard = checksPanel
    .getByRole("listitem")
    .filter({ hasText: "Cancellation fixture" });
  await waitCard.getByRole("button", { name: "Run" }).click();
  await expect(waitCard.getByRole("button", { name: "Cancel" })).toBeVisible();

  // Reloading reconnects to the same server-owned run instead of losing it.
  await page.reload();
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  await expect(title).toHaveText("Verification fixture");
  await filesPanel.getByRole("tab", { name: "Git" }).click();
  await filesPanel.getByRole("tab", { name: "Checks" }).click();
  const reconnectedWaitCard = checksPanel
    .getByRole("listitem")
    .filter({ hasText: "Cancellation fixture" });
  await expect(
    reconnectedWaitCard.getByRole("button", { name: "Cancel" }),
  ).toBeVisible();
  await reconnectedWaitCard.getByRole("button", { name: "Cancel" }).click();
  await expect(checksPanel.locator(".verification-run-result")).toContainText(
    "Verification cancelled",
  );
  await expect(title).toHaveText("Verification fixture");
});

async function openVerificationTerminal(page: Page) {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryRoot!);
  await page.getByPlaceholder("Project shell").fill("Verification fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText("Verification fixture");
  return title;
}
