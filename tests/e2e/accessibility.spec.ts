import { expect, test } from "@playwright/test";

test("keyboard navigation controls the desktop shell without affecting sessions", async ({
  page,
}) => {
  await page.goto("/");

  const workspace = page.getByRole("main", { name: "Terminal workspace" });
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  const inspector = page.getByRole("complementary", {
    name: "Session inspector",
  });

  await expect(workspace).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(inspector).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    /Connected · No terminal selected · Application controls/,
  );

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", {
    name: "Skip to terminal workspace",
  });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(workspace).toBeFocused();

  await page.keyboard.press("Control+b");
  await expect(sidebar).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Show session sidebar" }),
  ).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Control+b");
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Control+Shift+b");
  await expect(inspector).toBeHidden();
  await page.keyboard.press("Control+Shift+b");
  await expect(inspector).toBeVisible();
});

test("terminal launcher closes with Escape and restores invoking focus", async ({
  page,
}) => {
  await page.goto("/");

  const createButton = page.getByRole("button", {
    name: "Open first terminal",
  });
  await createButton.click();

  const dialog = page.getByRole("dialog", { name: "Open a terminal" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Working directory")).toBeFocused();

  const browseButton = page.getByRole("button", { name: "Browse" });
  await browseButton.click();
  const directoryDialog = page.getByRole("dialog", {
    name: "Choose a working directory",
  });
  await expect(directoryDialog).toBeVisible();
  await expect(page.getByLabel("Filter directories")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(directoryDialog).toBeHidden();
  await expect(browseButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(createButton).toBeFocused();
});

test("narrow shell exposes panels as dismissible drawers at 320 CSS pixels", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 320 });
  await page.goto("/");

  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  const inspector = page.getByRole("complementary", {
    name: "Session inspector",
  });

  await expect(sidebar).toBeHidden();
  await expect(inspector).toBeHidden();

  await page.getByRole("button", { name: "Show session sidebar" }).click();
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Pacium" }).click();
  await expect(
    sidebar.getByRole("region", { name: "Pacium workspace definition" }),
  ).toBeVisible();
  const primaryRoles = sidebar.locator(".pacium-role-group");
  await expect(primaryRoles).toBeVisible();
  await expect(primaryRoles.locator(".pacium-role-card")).toHaveCount(2);
  await expect(
    primaryRoles.locator('[data-role="orchestrator"]'),
  ).toBeVisible();
  const queueSources = sidebar.getByRole("region", {
    name: "Pacium queue",
  });
  await expect(queueSources).toBeVisible();
  await expect(
    queueSources.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close session sidebar" }).click();
  await expect(sidebar).toBeHidden();
  const composer = page.getByRole("region", {
    name: "Send to one exact terminal",
  });
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel("Target")).toBeVisible();
  await expect(composer.getByLabel("Prompt")).toBeVisible();
  await expect(composer.getByRole("button", { name: "Send" })).toBeVisible();

  await page.getByRole("button", { name: "Show inspector" }).click();
  await expect(inspector).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(inspector).toBeHidden();

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(320);
});

test("two-times zoom and system accessibility preferences keep controls usable", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 640 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });

  const workspace = page.getByRole("main", { name: "Terminal workspace" });
  await page.getByRole("button", { name: "Show session sidebar" }).click();
  const newTerminal = page.getByRole("button", { name: "New terminal" });
  const modeGroup = page.getByRole("group", { name: "Workspace mode" });
  await expect(workspace).toBeVisible();
  await expect(newTerminal).toBeVisible();
  await expect(modeGroup).toBeVisible();

  await page.getByRole("button", { name: "Close session sidebar" }).focus();
  await page.keyboard.press("Tab");
  await expect(newTerminal).toBeFocused();
  const accessibilityStyles = await newTerminal.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      outlineStyle: styles.outlineStyle,
      transitionDuration: styles.transitionDuration,
    };
  });
  expect(accessibilityStyles.outlineStyle).not.toBe("none");
  expect(
    Number.parseFloat(accessibilityStyles.transitionDuration),
  ).toBeLessThan(0.001);

  const paciumButton = modeGroup.getByRole("button", { name: "Pacium" });
  await paciumButton.focus();
  await expect(paciumButton).toBeFocused();
  await paciumButton.press("Enter");
  await expect(paciumButton).toHaveAttribute("aria-pressed", "true");
  const primaryRoles = page.locator(".pacium-role-group");
  await expect(primaryRoles).toBeVisible();
  const queueSources = page.getByRole("region", {
    name: "Pacium queue",
  });
  await expect(queueSources).toBeVisible();
  const refreshQueue = queueSources.getByRole("button", { name: "Refresh" });
  await refreshQueue.focus();
  await expect(refreshQueue).toBeFocused();
  const assignMeta = primaryRoles
    .locator('[data-role="meta"]')
    .getByRole("button", { name: "Assign" });
  await assignMeta.click();
  const roleDialog = page.getByRole("dialog", { name: "Assign Meta" });
  await expect(roleDialog).toBeVisible();
  await expect(roleDialog.getByLabel("Launch preset")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(roleDialog).toBeHidden();
  await expect(assignMeta).toBeFocused();
  await page.getByRole("button", { name: "Close session sidebar" }).click();

  const composer = page.getByRole("region", {
    name: "Send to one exact terminal",
  });
  const prompt = composer.getByLabel("Prompt");
  await expect(composer).toBeVisible();
  await prompt.focus();
  await expect(prompt).toBeFocused();
  const promptStyles = await prompt.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      outlineStyle: styles.outlineStyle,
      forcedColorAdjust: styles.forcedColorAdjust,
    };
  });
  expect(promptStyles.outlineStyle).not.toBe("none");
  expect(promptStyles.forcedColorAdjust).not.toBe("none");

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(640);
});
