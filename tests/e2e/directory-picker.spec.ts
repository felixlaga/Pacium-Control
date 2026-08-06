import { expect, test } from "@playwright/test";
import { realpathSync } from "node:fs";
import { join } from "node:path";

const projectRoot = realpathSync(process.cwd());
const defaultDirectory = realpathSync(join(projectRoot, "apps/local-server"));
const appsDirectory = realpathSync(join(projectRoot, "apps"));

test("host directory picker recovers, navigates by path and keyboard, and returns one canonical folder", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  await page.getByRole("button", { name: "New terminal" }).click();

  const createDialog = page.getByRole("dialog", { name: "Open a terminal" });
  const workingDirectory = createDialog.getByLabel("Working directory");
  await workingDirectory.fill(join(projectRoot, "missing-pc-078"));
  await createDialog.getByRole("button", { name: "Browse" }).click();

  const picker = page.getByRole("dialog", {
    name: "Choose a working directory",
  });
  await expect(picker).toBeVisible();
  await expect(picker.getByText("Folder unavailable")).toBeVisible();
  await expect(
    picker.getByText(
      "Running terminals and the new-terminal form are unchanged.",
    ),
  ).toBeVisible();

  await picker.getByRole("button", { name: "Pacium default" }).click();
  await expect(
    picker.getByRole("button", { name: "local-server", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await expect(
    picker.getByText(defaultDirectory, { exact: true }),
  ).toBeVisible();

  await page.keyboard.press("Control+l");
  const pathEditor = picker.getByLabel("Absolute path on the Pacium host");
  await expect(pathEditor).toBeFocused();
  await pathEditor.fill(projectRoot);
  await pathEditor.press("Enter");

  const filter = picker.getByLabel("Filter directories");
  await expect(
    picker.getByRole("button", { name: "Open apps, folder" }),
  ).toBeVisible();
  await filter.fill("apps");
  await filter.press("ArrowDown");
  await expect(
    picker.getByRole("button", { name: "Open apps, folder" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  const localServer = picker.getByRole("button", {
    name: "Open local-server, folder",
  });
  const web = picker.getByRole("button", { name: "Open web, folder" });
  await expect(localServer).toBeVisible();
  await expect(filter).toHaveValue("");
  await filter.press("ArrowDown");
  await expect(localServer).toBeFocused();
  await localServer.press("ArrowDown");
  await expect(web).toBeFocused();
  await web.press("ArrowUp");
  await expect(localServer).toBeFocused();

  await page.keyboard.press("Control+Enter");
  await expect(picker).toBeHidden();
  await expect(createDialog).toBeVisible();
  await expect(workingDirectory).toHaveValue(appsDirectory);
  await expect(
    createDialog.getByRole("button", { name: "Open terminal" }),
  ).toBeVisible();

  const browse = createDialog.getByRole("button", { name: "Browse" });
  await browse.click();
  await expect(
    page
      .getByRole("dialog", { name: "Choose a working directory" })
      .getByRole("complementary", { name: "Locations" })
      .getByTitle(appsDirectory),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(browse).toBeFocused();
});

test("recent-directory storage denial never blocks canonical selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem.bind(window.localStorage);
    const originalSetItem = Storage.prototype.setItem.bind(window.localStorage);
    Storage.prototype.getItem = function (key: string): string | null {
      if (key === "pacium.recentDirectories") {
        throw new DOMException("Storage denied", "SecurityError");
      }
      return originalGetItem(key);
    };
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === "pacium.recentDirectories") {
        throw new DOMException("Storage denied", "SecurityError");
      }
      originalSetItem(key, value);
    };
  });

  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();
  await page.getByRole("button", { name: "New terminal" }).click();
  const createDialog = page.getByRole("dialog", { name: "Open a terminal" });
  await createDialog.getByRole("button", { name: "Browse" }).click();

  const picker = page.getByRole("dialog", {
    name: "Choose a working directory",
  });
  await expect(
    picker.getByRole("button", { name: "Use current folder" }),
  ).toBeEnabled();
  await picker.getByRole("button", { name: "Use current folder" }).click();

  await expect(picker).toBeHidden();
  await expect(createDialog.getByLabel("Working directory")).toHaveValue(
    defaultDirectory,
  );
});
