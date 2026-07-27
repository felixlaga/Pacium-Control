import { expect, test } from "@playwright/test";

test("changed files load lazily without changing terminal selection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Connected");

  await page.getByRole("button", { name: "Open first terminal" }).click();
  const workingDirectory = page.getByLabel("Working directory");
  await expect(workingDirectory).not.toHaveValue("");
  await page.getByPlaceholder("Project shell").fill("Oversight fixture");
  await page.getByRole("button", { name: "Open terminal" }).click();

  await expect(page.getByRole("status")).toContainText("Oversight fixture");
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
  await expect(page.getByRole("status")).toContainText("Oversight fixture");

  await changesTab.focus();
  await changesTab.press("ArrowLeft");
  await expect(overviewTab).toBeFocused();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await overviewTab.press("ArrowRight");
  await expect(changesTab).toBeFocused();
  await expect(changesPanel).toBeVisible();
});
