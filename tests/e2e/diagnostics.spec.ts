import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";

const repositoryDirectory = realpathSync(process.cwd());
const terminalMarker = "PC-073-terminal-survives";

test.afterEach(async ({ page }) => {
  const openDialog = page.getByRole("dialog");
  if ((await openDialog.count()) > 0) {
    await page.keyboard.press("Escape");
  }
  const rows = page
    .locator(".session-row")
    .filter({ hasText: "Diagnostics fixture" });
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

test("diagnostics preview and local export stay bounded while the terminal keeps running", async ({
  page,
}) => {
  let failDiagnostics = false;
  await page.route("**/api/diagnostics", async (route) => {
    if (failDiagnostics) {
      await route.fulfill({
        body: JSON.stringify({ error: "Bounded diagnostics unavailable" }),
        contentType: "application/json",
        status: 500,
      });
      return;
    }
    await route.continue();
  });

  const { composer, terminal } = await openTerminal(page);
  await composer.fill(`printf '${terminalMarker}\\n'`);
  await composer.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);

  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Diagnostics" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Current health")).toBeVisible();
  await expect(dialog.getByText("Terminal 1", { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText(terminalMarker);
  await expect(dialog).not.toContainText(repositoryDirectory);

  const downloadButton = dialog.getByRole("button", {
    name: "Download JSON",
  });
  await expect(downloadButton).toBeDisabled();
  await dialog.getByRole("button", { name: "Preview export" }).click();
  const preview = dialog.getByLabel("Exact diagnostics JSON");
  await expect(preview).toContainText('"schemaVersion": 1');
  await expect(preview).not.toContainText(terminalMarker);
  await expect(preview).not.toContainText("Initial private queue");
  await expect(downloadButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^pacium-diagnostics-[A-Za-z0-9_-]+\.json$/,
  );
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath, "utf8")) as {
    schemaVersion: number;
    sessions: Array<{ label: string }>;
    redactionManifest: { omitted: string[] };
  };
  expect(exported.schemaVersion).toBe(1);
  expect(exported.sessions[0]?.label).toBe("Terminal 1");
  expect(exported.redactionManifest.omitted).toContain("terminal_content");

  failDiagnostics = true;
  await dialog.getByRole("button", { name: "Refresh" }).click();
  await expect(dialog).toContainText(
    "Refresh failed; the snapshot below is stale.",
  );
  await expect(dialog.getByText("Terminal 1", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Close diagnostics" }).click();
  await expect(dialog).toBeHidden();
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);
});

test("route-based diagnostics open recovers from failure and reattaches the same terminal", async ({
  page,
}) => {
  let failDiagnostics = false;
  await page.route("**/api/diagnostics", async (route) => {
    if (failDiagnostics) {
      await route.fulfill({
        body: JSON.stringify({ error: "Bounded diagnostics unavailable" }),
        contentType: "application/json",
        status: 500,
      });
      return;
    }
    await route.continue();
  });

  const { composer, terminal } = await openTerminal(page);
  await composer.fill(`printf '${terminalMarker}\\n'`);
  await composer.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);

  failDiagnostics = true;
  await page.goto("/diagnostics");
  const dialog = page.getByRole("dialog", { name: "Diagnostics" });
  await expect(dialog).toBeVisible();
  const retry = dialog.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  failDiagnostics = false;
  await retry.click();
  await expect(dialog.getByText("Terminal 1", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Close diagnostics" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  await expect(page.locator(".stage-title h1")).toHaveText(
    "Diagnostics fixture",
  );
  // The session kept running on the host; the reloaded page must reattach and
  // show its live screen, not a blank terminal.
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker, {
    timeout: 15_000,
  });
});

async function openTerminal(page: Page) {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  await page.getByRole("button", { name: "New terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill("Diagnostics fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(page.locator(".stage-title h1")).toHaveText(
    "Diagnostics fixture",
  );
  return {
    composer: page.getByPlaceholder("Send to Diagnostics fixture"),
    terminal: page.getByLabel("Terminal for Diagnostics fixture", {
      exact: true,
    }),
  };
}
