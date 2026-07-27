import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

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
  await workingDirectory.fill(repositoryDirectory);
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
