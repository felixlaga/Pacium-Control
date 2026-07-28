import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { runGitOk } from "../../apps/local-server/src/git-fixture-test-utils.js";

let repositoryDirectory: string;

test.beforeAll(async () => {
  repositoryDirectory = await mkdtemp(
    join(tmpdir(), "pacium-activity-cards-e2e-"),
  );
  await runGitOk(repositoryDirectory, ["init", "--quiet"]);
  await runGitOk(repositoryDirectory, [
    "config",
    "user.email",
    "pacium@example.test",
  ]);
  await runGitOk(repositoryDirectory, ["config", "user.name", "Pacium E2E"]);
  await writeFile(join(repositoryDirectory, "activity.txt"), "before\n");
  await runGitOk(repositoryDirectory, ["add", "activity.txt"]);
  await runGitOk(repositoryDirectory, [
    "commit",
    "--quiet",
    "-m",
    "activity fixture",
  ]);
  await writeFile(join(repositoryDirectory, "activity.txt"), "after\n");
});

test.afterAll(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
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
  const createDialog = page.getByRole("dialog", { name: "Open a terminal" });
  if (await createDialog.isVisible()) {
    await createDialog.getByRole("button", { name: "Cancel" }).click();
  }
  for (const sessionName of ["Evidence first", "Evidence second"]) {
    const session = sidebar.getByRole("button", {
      name: new RegExp(`^${sessionName},`),
    });
    if ((await session.count()) === 0) {
      continue;
    }
    await session.click({ button: "right" });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /Terminate process and close/ })
      .click();
    await expect(session).not.toBeAttached();
  }
});

test("activity cards navigate to evidence and keep terminal fallback explicit and ephemeral", async ({
  page,
}) => {
  const workspaceStatus = await openTerminal(page, "Evidence first");
  const terminal = page.getByLabel("Evidence first terminal", { exact: true });
  await terminal.click();
  await page.keyboard.type("printf 'PC-063 bounded terminal evidence\\n'");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(
    "PC-063 bounded terminal evidence",
  );

  const activityTab = page.getByRole("tab", {
    name: "Activity",
    exact: true,
  });
  await activityTab.click();
  let activityPanel = page.getByRole("tabpanel", { name: "Activity" });
  await expect(activityPanel.locator(".activity-card").first()).toBeVisible();
  await expect(activityPanel).toContainText("1 changed file observed");
  await expect(activityPanel).toContainText("activity fixture");
  await expect(workspaceStatus).toContainText("Evidence first");

  const fallback = activityPanel.locator(".activity-terminal-fallback");
  await expect(fallback.locator("pre")).not.toBeAttached();
  await fallback
    .getByRole("button", { name: "Show recent terminal text" })
    .click();
  await expect(fallback).toContainText("Terminal-derived");
  await expect(fallback).toContainText("Low confidence");
  await expect(fallback).toContainText("Not interpreted");
  await expect(fallback.locator("pre")).toContainText(
    "PC-063 bounded terminal evidence",
  );
  await fallback.getByRole("button", { name: "Refresh excerpt" }).click();
  await fallback.getByRole("button", { name: "Hide" }).click();
  await expect(fallback.locator("pre")).not.toBeAttached();

  await activityPanel
    .getByRole("button", { name: /Open Changes source/ })
    .click();
  await expect(page.getByRole("tab", { name: "Changes" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "Changes" })).toContainText(
    "1 reported change",
  );
  await activityTab.click();
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });

  await activityPanel
    .getByRole("button", { name: /Open History source/ })
    .click();
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "History" })).toContainText(
    "activity fixture",
  );
  await activityTab.click();
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });

  await activityPanel
    .getByRole("button", { name: /Open Terminal source/ })
    .first()
    .click();
  await expect(terminal.locator(".xterm-helper-textarea")).toBeFocused();
  await activityTab.click();
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });

  await activityPanel
    .getByRole("button", { name: "Show recent terminal text" })
    .click();
  await expect(
    activityPanel.locator(".activity-terminal-excerpt"),
  ).toBeVisible();
  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill("Evidence second");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(workspaceStatus).toContainText("Evidence second");
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });
  await expect(
    activityPanel.locator(".activity-terminal-excerpt"),
  ).not.toBeAttached();
  await expect(
    activityPanel.getByRole("button", { name: "Show recent terminal text" }),
  ).toBeVisible();

  await page
    .getByRole("complementary", { name: "Session navigation" })
    .getByRole("button", { name: /^Evidence first,/ })
    .click();
  await expect(workspaceStatus).toContainText("Evidence first");
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });
  await activityPanel
    .getByRole("button", { name: "Show recent terminal text" })
    .click();
  await expect(
    activityPanel.locator(".activity-terminal-excerpt"),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator(".workspace-status")).toContainText("Connected");
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  activityPanel = page.getByRole("tabpanel", { name: "Activity" });
  await expect(
    activityPanel.locator(".activity-terminal-excerpt"),
  ).not.toBeAttached();
  await expect(
    activityPanel.getByRole("button", { name: "Show recent terminal text" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 640, height: 720 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(activityPanel.locator(".activity-card").first()).toBeVisible();
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
  await expect(activityPanel.locator(".activity-card").first()).toBeVisible();
  await expect(
    activityPanel.getByRole("button", { name: "Show recent terminal text" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

async function openTerminal(page: Page, name: string) {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");
  await page.getByRole("button", { name: "Open first terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill(name);
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(workspaceStatus).toContainText(name);
  return workspaceStatus;
}
