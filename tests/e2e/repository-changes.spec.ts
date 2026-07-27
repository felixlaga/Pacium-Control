import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { runGitOk } from "../../apps/local-server/src/git-fixture-test-utils.js";

let repositoryDirectory: string;

test.beforeAll(async () => {
  repositoryDirectory = await mkdtemp(
    join(tmpdir(), "pacium-repository-changes-e2e-"),
  );
  await runGitOk(repositoryDirectory, ["init", "--quiet"]);
  await runGitOk(repositoryDirectory, [
    "config",
    "user.email",
    "pacium@example.test",
  ]);
  await runGitOk(repositoryDirectory, ["config", "user.name", "Pacium E2E"]);
  await writeFile(
    join(repositoryDirectory, "file.txt"),
    "before\nshared context\n",
  );
  await runGitOk(repositoryDirectory, ["add", "file.txt"]);
  await runGitOk(repositoryDirectory, ["commit", "--quiet", "-m", "fixture"]);
  await writeFile(
    join(repositoryDirectory, "file.txt"),
    "after\nshared context\n",
  );
});

test.afterAll(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
});

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
  await page.setViewportSize({ width: 1280, height: 720 });
  if (!(await sidebar.isVisible())) {
    await page.getByRole("button", { name: "Show session sidebar" }).click();
    await expect(sidebar).toBeVisible();
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
  const workspaceStatus = await openFixtureTerminal(page);
  const overviewTab = page.getByRole("tab", { name: "Overview" });
  const changesTab = page.getByRole("tab", { name: "Changes" });
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Changes" }),
  ).not.toBeAttached();

  await changesTab.click();
  const changesPanel = page.getByRole("tabpanel", { name: "Changes" });
  await expect(changesPanel).toBeVisible();
  await expect(changesPanel).toContainText("1 reported change");
  await expect(
    changesPanel.getByRole("button", { name: "Open diff for file.txt" }),
  ).toBeVisible();
  await expect(
    changesPanel.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await expect(workspaceStatus).toContainText("Oversight fixture");

  const openDiff = changesPanel.getByRole("button", {
    name: "Open diff for file.txt",
  });
  await openDiff.click();
  const diffPanel = page.getByRole("tabpanel", { name: "Changes" });
  await expect(diffPanel.locator(".repository-diff-heading strong")).toHaveText(
    "file.txt",
  );
  await expect(diffPanel.locator(".diff-line.is-deletion")).toContainText(
    "before",
  );
  await expect(diffPanel.locator(".diff-line.is-addition")).toContainText(
    "after",
  );

  const search = diffPanel.getByRole("searchbox", { name: "Search diff" });
  await search.fill("after");
  await expect(diffPanel.getByRole("status")).toHaveText("1 matching line");
  await search.press("Escape");
  await expect(search).toHaveValue("");

  const wrap = diffPanel.getByRole("button", { name: "Wrap" });
  await wrap.click();
  await expect(wrap).toHaveAttribute("aria-pressed", "true");
  await diffPanel.getByRole("button", { name: "Collapse all" }).click();
  await expect(
    diffPanel.getByRole("button", { name: "Expand all" }),
  ).toBeVisible();

  await diffPanel.focus();
  await diffPanel.press("Escape");
  await expect(openDiff).toBeFocused();
  await expect(changesPanel).toContainText("1 reported change");

  await changesTab.focus();
  await changesTab.press("ArrowLeft");
  await expect(overviewTab).toBeFocused();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await overviewTab.press("ArrowRight");
  await expect(changesTab).toBeFocused();
  await expect(changesPanel).toBeVisible();
});

test("recent history loads lazily without changing terminal selection", async ({
  page,
}) => {
  const workspaceStatus = await openFixtureTerminal(page);
  const historyTab = page.getByRole("tab", { name: "History" });
  await expect(
    page.getByRole("tabpanel", { name: "History" }),
  ).not.toBeAttached();

  await historyTab.click();
  const historyPanel = page.getByRole("tabpanel", { name: "History" });
  await expect(historyPanel).toContainText("1 recent commit");
  const commit = historyPanel.getByRole("listitem").first();
  await expect(commit).toContainText("fixture");
  await expect(commit).toContainText("Pacium E2E");
  await expect(commit.locator("code")).toHaveText(/^[0-9a-f]{8}$/);
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await historyPanel.getByRole("button", { name: "Refresh" }).click();
  await expect(historyPanel).toContainText("1 recent commit");

  await historyTab.focus();
  await historyTab.press("ArrowLeft");
  const changesTab = page.getByRole("tab", { name: "Changes" });
  await expect(changesTab).toBeFocused();
  await expect(changesTab).toHaveAttribute("aria-selected", "true");
  await changesTab.press("ArrowRight");
  await expect(historyTab).toBeFocused();
  await expect(historyPanel).toBeVisible();
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(historyPanel).toBeVisible();
  await expect(commit).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
});

test("General and Pacium modes preserve terminal and inspector context", async ({
  page,
}) => {
  const workspaceStatus = await openFixtureTerminal(page);
  const changesTab = page.getByRole("tab", { name: "Changes" });
  await changesTab.click();
  await expect(changesTab).toHaveAttribute("aria-selected", "true");

  const paciumButton = page.getByRole("button", { name: "Pacium" });
  await paciumButton.click();
  await expect(paciumButton).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("region", { name: "Pacium workspace definition" }),
  ).toContainText(
    /Pacium setup needed|Primary roles and queue-source health resolve below/,
  );
  await expect(changesTab).toHaveAttribute("aria-selected", "true");
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await page.getByRole("main", { name: "Terminal workspace" }).focus();
  await page.keyboard.press("g");
  await page.keyboard.press("p");
  const generalButton = page.getByRole("button", { name: "General" });
  await expect(generalButton).toHaveAttribute("aria-pressed", "true");
  await expect(changesTab).toHaveAttribute("aria-selected", "true");
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette
    .getByRole("combobox", { name: "Search commands" })
    .fill("pacium mode");
  await palette.getByRole("option", { name: /Switch to Pacium mode/ }).click();
  await expect(paciumButton).toHaveAttribute("aria-pressed", "true");
  await expect(workspaceStatus).toContainText("Oversight fixture");

  await page.reload();
  await expect(paciumButton).toHaveAttribute("aria-pressed", "true");
  await expect(workspaceStatus).toContainText("Oversight fixture");
  await expect(
    page.getByRole("region", { name: "Pacium workspace definition" }),
  ).toContainText(
    /Pacium setup needed|Primary roles and queue-source health resolve below/,
  );
});

async function openFixtureTerminal(page: Page) {
  await page.goto("/");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");

  await page.getByRole("button", { name: "Open first terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill("Oversight fixture");
  await page.getByRole("button", { name: "Open terminal" }).click();
  await expect(workspaceStatus).toContainText("Oversight fixture");
  return workspaceStatus;
}
