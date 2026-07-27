import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  const session = sidebar.getByRole("button", {
    name: /^Oversight fixture,/,
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

test("changed files load lazily without changing terminal selection", async ({
  page,
}) => {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");

  await page.getByRole("button", { name: "Open first terminal" }).click();
  const workingDirectory = page.getByLabel("Working directory");
  await expect(workingDirectory).not.toHaveValue("");
  await page.getByPlaceholder("Project shell").fill("Oversight fixture");
  await page.getByRole("button", { name: "Open terminal" }).click();

  await expect(workspaceStatus).toContainText("Oversight fixture");
  const overviewTab = page.getByRole("tab", { name: "Overview" });
  const changesTab = page.getByRole("tab", { name: "Changes" });
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Changes" }),
  ).not.toBeAttached();

  await changesTab.click();
  const changesPanel = page.getByRole("tabpanel", { name: "Changes" });
  await expect(changesPanel).toBeVisible();
  await expect(changesPanel).toContainText(
    /Working tree clear|\d+ reported changes/,
  );
  await expect(
    changesPanel.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await changesTab.focus();
  await changesTab.press("ArrowLeft");
  await expect(overviewTab).toBeFocused();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await overviewTab.press("ArrowRight");
  await expect(changesTab).toBeFocused();
  await expect(changesPanel).toBeVisible();
});
