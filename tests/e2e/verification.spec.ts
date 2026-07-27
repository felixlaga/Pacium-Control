import { expect, test, type Page } from "@playwright/test";

const repositoryRoot = process.cwd();

test.afterEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  if (!(await sidebar.isVisible())) {
    await page.getByRole("button", { name: "Show session sidebar" }).click();
  }
  const session = sidebar.getByRole("button", {
    name: /^Verification fixture,/,
  });
  if ((await session.count()) === 0) {
    return;
  }
  await session.click({ button: "right" });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: /Terminate process and close/ })
    .click();
  await expect(session).not.toBeAttached();
});

test("configured checks run, reconnect, cancel, and fit the narrow inspector", async ({
  page,
}) => {
  const workspaceStatus = await openVerificationTerminal(page);
  const checksTab = page.getByRole("tab", { name: "Checks" });
  await expect(
    page.getByRole("tabpanel", { name: "Checks" }),
  ).not.toBeAttached();

  await checksTab.click();
  let checksPanel = page.getByRole("tabpanel", { name: "Checks" });
  await expect(checksPanel).toContainText("2 configured checks");
  await expect(workspaceStatus).toContainText("Verification fixture");

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

  const activityTab = page.getByRole("tab", { name: "Activity" });
  await activityTab.click();
  const activityPanel = page.getByRole("tabpanel", { name: "Activity" });
  await expect(activityPanel).toContainText("Current evidence");
  await expect(activityPanel).toContainText("Unknown");
  await expect(activityPanel).toContainText(
    "assigned-task activity is unverified",
  );
  await expect(activityPanel.locator(".activity-fact-list")).toContainText(
    /changed files? observed|Working tree observed clean/,
  );
  await expect(activityPanel).toContainText("Verification passed");
  await expect(activityPanel).toContainText("Project verify");
  await expect(activityPanel).toContainText("Deterministic local facts only");
  await expect(workspaceStatus).toContainText("Verification fixture");

  await activityPanel.getByRole("button", { name: "Refresh" }).click();
  await expect(
    activityPanel.getByRole("button", { name: "Refresh" }),
  ).toBeEnabled();
  await expect(activityPanel).toContainText("Verification passed");
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(activityPanel).toBeVisible();
  await expect(
    activityPanel.getByRole("heading", { name: "Evidence sources" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 1280, height: 720 });
  await checksTab.click();

  const waitCard = checksPanel
    .getByRole("listitem")
    .filter({ hasText: "Cancellation fixture" });
  await waitCard.getByRole("button", { name: "Run" }).click();
  await expect(waitCard.getByRole("button", { name: "Cancel" })).toBeVisible();

  await page.reload();
  await expect(page.locator(".workspace-status")).toContainText("Connected");
  await page.getByRole("tab", { name: "Checks" }).click();
  checksPanel = page.getByRole("tabpanel", { name: "Checks" });
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
  await expect(workspaceStatus).toContainText("Verification fixture");

  const reconnectedChecksTab = page.getByRole("tab", { name: "Checks" });
  await reconnectedChecksTab.focus();
  await reconnectedChecksTab.press("ArrowRight");
  await expect(activityTab).toBeFocused();
  await expect(activityTab).toHaveAttribute("aria-selected", "true");
  await activityTab.press("ArrowRight");
  const overviewTab = page.getByRole("tab", { name: "Overview" });
  await expect(overviewTab).toBeFocused();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await overviewTab.press("End");
  await expect(activityTab).toBeFocused();
  await activityTab.press("ArrowLeft");
  await expect(reconnectedChecksTab).toBeFocused();

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(checksPanel).toBeVisible();
  await expect(reconnectedWaitCard).toBeVisible();
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(320);
});

async function openVerificationTerminal(page: Page) {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");

  await page.getByRole("button", { name: "Open first terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryRoot);
  await page.getByPlaceholder("Project shell").fill("Verification fixture");
  await page.getByRole("button", { name: "Open terminal" }).click();
  await expect(workspaceStatus).toContainText("Verification fixture");
  return workspaceStatus;
}
