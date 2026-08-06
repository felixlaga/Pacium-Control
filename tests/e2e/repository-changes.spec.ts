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
  const rows = page
    .locator(".session-row")
    .filter({ hasText: "Oversight fixture" });
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

test("changed files load lazily in the Git tab without changing terminal selection", async ({
  page,
}) => {
  const title = await openFixtureTerminal(page);
  const filesPanel = page.getByRole("complementary", {
    name: "Repository files and git",
  });
  const filesTab = filesPanel.getByRole("tab", { name: "Files" });
  const gitTab = filesPanel.getByRole("tab", { name: "Git" });
  await expect(filesTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".repository-changes-panel")).not.toBeAttached();

  await gitTab.click();
  await expect(
    filesPanel.getByRole("tab", { name: "Changes" }),
  ).toHaveAttribute("aria-selected", "true");
  const changesPanel = page.locator(".repository-changes-panel");
  await expect(changesPanel).toBeVisible();
  await expect(changesPanel).toContainText("1 reported change");
  await expect(
    changesPanel.getByRole("button", { name: "Open diff for file.txt" }),
  ).toBeVisible();
  await expect(
    changesPanel.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  await expect(title).toHaveText("Oversight fixture");

  // Leaving Git and returning keeps the loaded evidence and the terminal.
  await filesTab.click();
  await expect(changesPanel).not.toBeAttached();
  await gitTab.click();
  await expect(changesPanel).toContainText("1 reported change");
  await expect(title).toHaveText("Oversight fixture");
});

test("opens one bounded diff from the changed-file list", async ({ page }) => {
  const title = await openFixtureTerminal(page);
  const filesPanel = page.getByRole("complementary", {
    name: "Repository files and git",
  });
  await filesPanel.getByRole("tab", { name: "Git" }).click();
  const changesPanel = page.locator(".repository-changes-panel");
  await expect(changesPanel).toContainText("1 reported change");

  const openDiff = changesPanel.getByRole("button", {
    name: "Open diff for file.txt",
  });
  // A user must be able to click the changed-file row while a terminal is
  // mounted next to the panel.
  await openDiff.click();
  const diffPanel = page.locator(".repository-diff-panel");
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
  await expect(diffPanel.locator(".diff-search-summary")).toHaveText(
    "1 matching line",
  );
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
  await expect(diffPanel).not.toBeAttached();
  await expect(changesPanel).toContainText("1 reported change");
  await expect(title).toHaveText("Oversight fixture");
});

async function openFixtureTerminal(page: Page) {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill("Oversight fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  const title = page.locator(".stage-title h1");
  await expect(title).toHaveText("Oversight fixture");
  return title;
}
