import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";

const repositoryDirectory = realpathSync(process.cwd());
const terminalMarker = "PC-073-terminal-survives";

test("diagnostics preview and local export preserve terminal state across routing and refresh", async ({
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

  await openTerminal(page);
  const terminal = page.getByLabel("Diagnostics fixture terminal", {
    exact: true,
  });
  await terminal.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type(`printf '${terminalMarker}\\n'`);
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);

  const diagnosticsTrigger = page.getByRole("button", {
    name: "Open diagnostics",
    exact: true,
  });
  await diagnosticsTrigger.click();
  await expect(page).toHaveURL(/\/diagnostics$/);
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
  failDiagnostics = false;

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);

  await page.getByRole("button", { name: /Commands/ }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("diagnostics");
  await palette.getByRole("option", { name: /Open diagnostics/ }).click();
  await expect(page).toHaveURL(/\/diagnostics$/);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Commands/ })).toBeFocused();

  await page.setViewportSize({ height: 720, width: 640 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await page.goto("/diagnostics");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  const directRouteRead = dialog.getByRole("button", { name: "Retry" });
  await expect(directRouteRead).toBeVisible();
  await directRouteRead.click();
  await expect(dialog.getByText("Terminal 1", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
  const dialogStyles = await dialog.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      boxShadow: computed.boxShadow,
      transitionDuration: computed.transitionDuration,
    };
  });
  expect(dialogStyles.boxShadow).toBe("none");
  expect(
    Number.parseFloat(dialogStyles.transitionDuration || "0"),
  ).toBeLessThan(0.001);

  await dialog.getByRole("button", { name: "Close diagnostics" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(terminal.locator(".xterm-rows")).toContainText(terminalMarker);

  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.emulateMedia({
    forcedColors: "none",
    reducedMotion: "no-preference",
  });
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page
    .getByRole("button", { name: "Terminate process and close" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open first terminal" }),
  ).toBeVisible();
});

async function openTerminal(page: Page) {
  await page.goto("/");
  await expect(page.locator(".workspace-status")).toContainText("Connected");
  await page.getByRole("button", { name: "Open first terminal" }).click();
  await page.getByLabel("Working directory").fill(repositoryDirectory);
  await page.getByPlaceholder("Project shell").fill("Diagnostics fixture");
  await page
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  await expect(page.locator(".workspace-status")).toContainText(
    "Diagnostics fixture",
  );
}
