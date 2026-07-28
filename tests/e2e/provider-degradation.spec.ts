import { expect, test } from "@playwright/test";

const repositoryRoot = process.cwd();
const sessionName = "Capability fixture";

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test.afterEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  if (!(await sidebar.isVisible())) {
    await page.getByRole("button", { name: "Show session sidebar" }).click();
  }
  const session = sidebar.getByRole("button", {
    name: new RegExp(`^${sessionName},`),
  });
  if ((await session.count()) === 0) {
    return;
  }
  await session.click({ button: "right" });
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: /Terminate process and close|Remove session/,
    })
    .click();
  await expect(session).not.toBeAttached();
});

test("provider degradation stays explicit while the direct terminal remains usable", async ({
  page,
}) => {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");
  await page.getByRole("button", { name: "Open first terminal" }).click();
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
  await expect(workspaceStatus).toContainText(sessionName);

  const activityTab = page.getByRole("tab", {
    name: "Activity",
    exact: true,
  });
  await activityTab.click();
  let activityPanel = page.getByRole("tabpanel", {
    name: "Activity",
    exact: true,
  });
  let providerStatus = activityPanel.locator(".provider-status");
  await expect(providerStatus).toBeVisible();
  await expect(
    providerStatus.getByRole("heading", { name: "Provider status" }),
  ).toBeVisible();
  await expect(providerStatus).toContainText("Claude Code");
  await expect(providerStatus).toContainText("Provider");
  await expect(providerStatus).toContainText("Adapter");
  await expect(providerStatus).toContainText("Evidence");
  await expect(providerStatus).toContainText("Freshness");
  await expect(providerStatus).toContainText("Capabilities");
  await expect(
    providerStatus.locator(".provider-capability-list > li"),
  ).toHaveCount(8);
  await expect(providerStatus).toContainText("Terminal remains available");
  await expect(workspaceStatus).toContainText(sessionName);

  const state = (
    await providerStatus.locator(".provider-status-state").innerText()
  ).trim();
  expect([
    "READY",
    "UNAVAILABLE",
    "UNSUPPORTED",
    "DEGRADED",
    "FAILED",
    "STALE",
  ]).toContain(state);

  const terminal = page.getByLabel(`${sessionName} terminal`, { exact: true });
  await providerStatus.getByRole("button", { name: "Open terminal" }).click();
  await expect(terminal.locator(".xterm-helper-textarea")).toBeFocused();
  await activityTab.click();
  activityPanel = page.getByRole("tabpanel", {
    name: "Activity",
    exact: true,
  });
  providerStatus = activityPanel.locator(".provider-status");

  if (state === "READY") {
    await page.clock.fastForward(5 * 60_000 + 30_000);
    await expect(providerStatus.locator(".provider-status-state")).toHaveText(
      "Stale",
    );
  }
  const fallback = activityPanel.locator(".activity-terminal-fallback");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText(
    /provider evidence is stale|provider evidence is unavailable|provider runtime is unsupported|provider observation is degraded|provider observer failed/i,
  );
  await fallback
    .getByRole("button", { name: "Show recent terminal text" })
    .click();
  await expect(fallback).toContainText(/Terminal-derived|No non-empty recent/);
  await fallback.getByRole("button", { name: "Hide" }).click();

  await page.reload();
  await expect(page.locator(".workspace-status")).toContainText("Connected");
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  activityPanel = page.getByRole("tabpanel", {
    name: "Activity",
    exact: true,
  });
  providerStatus = activityPanel.locator(".provider-status");
  await expect(providerStatus).toBeVisible();
  await expect(
    activityPanel.locator(".activity-terminal-excerpt"),
  ).not.toBeAttached();
  await expect(workspaceStatus).toContainText(sessionName);

  await page.setViewportSize({ width: 640, height: 720 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(providerStatus).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await expect(providerStatus).toBeVisible();
  await expect(
    providerStatus.getByRole("button", { name: "Open terminal" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
