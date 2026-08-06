import { expect, test } from "@playwright/test";

test("keyboard navigation controls the shell without affecting sessions", async ({
  page,
}) => {
  await page.goto("/");

  const rail = page.getByRole("complementary", {
    name: "Repositories and sessions",
  });
  const files = page.getByRole("complementary", {
    name: "Repository files and git",
  });

  const connectionBadge = page.getByLabel(
    "Pacium local connection: connected.",
  );
  await expect(connectionBadge).toBeVisible();
  await expect(connectionBadge).toContainText(/Local.*connected/);
  await expect(rail).toBeVisible();
  await expect(files).toBeVisible();
  await expect(page.locator("main.stage")).toBeVisible();
  await expect(page.locator(".stage-footer")).toContainText(
    "Click the terminal to type into it directly",
  );

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to terminal" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#shell-terminal$/);

  const sidebarToggle = page.getByRole("button", { name: "Hide sidebar" });
  await expect(sidebarToggle).toHaveAttribute("aria-expanded", "true");
  await sidebarToggle.focus();
  await page.keyboard.press("Enter");
  await expect(rail).toBeHidden();
  const showSidebar = page.getByRole("button", { name: "Show sidebar" });
  await expect(showSidebar).toHaveAttribute("aria-expanded", "false");
  await expect(showSidebar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rail).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide sidebar" }),
  ).toHaveAttribute("aria-expanded", "true");

  const filesToggle = page.getByRole("button", { name: "Hide files panel" });
  await expect(filesToggle).toHaveAttribute("aria-expanded", "true");
  await filesToggle.focus();
  await page.keyboard.press("Enter");
  await expect(files).toBeHidden();
  const showFiles = page.getByRole("button", { name: "Show files panel" });
  await expect(showFiles).toHaveAttribute("aria-expanded", "false");
  await expect(showFiles).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(files).toBeVisible();
});

test("terminal launcher and directory picker close with Escape", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New terminal" }).click();
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
});

test("dismissed terminal launcher restores focus to its invoker", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Pacium local connection: connected."),
  ).toBeVisible();

  const createButton = page.getByRole("button", { name: "New terminal" });
  await createButton.click();
  const dialog = page.getByRole("dialog", { name: "Open a terminal" });
  await expect(page.getByLabel("Working directory")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Keyboard users must land back on the control that opened the launcher,
  // not on the document body.
  await expect(createButton).toBeFocused();
});
