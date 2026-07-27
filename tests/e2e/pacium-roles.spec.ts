import { rm } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const stateDirectory = process.env.PACIUM_E2E_STATE_DIRECTORY;

test.beforeEach(async ({ page }) => {
  if (stateDirectory !== undefined) {
    await rm(join(stateDirectory, "pacium.json"), { force: true });
  }
  await page.goto("/");
  await terminateAllSessions(page);
});

test.afterEach(async ({ page }) => {
  await terminateAllSessions(page);
  if (stateDirectory !== undefined) {
    await rm(join(stateDirectory, "pacium.json"), { force: true });
  }
});

test("assigns, opens, launches, and durably binds the two primary roles", async ({
  page,
}) => {
  await openTerminal(page, "Meta existing");
  await enterPaciumMode(page);

  const meta = roleCard(page, "meta");
  await expect(meta).toHaveAttribute("aria-label", /Meta role, Setup needed/);
  const assign = meta.getByRole("button", { name: "Assign" });
  await assign.click();

  const dialog = page.getByRole("dialog", { name: "Assign Meta" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Running session")).toBeFocused();
  await expect(dialog).toContainText("Meta existing");
  await dialog.getByRole("button", { name: "Save Meta" }).click();

  await expect(dialog).toBeHidden();
  await expect(meta).toHaveAttribute("aria-label", /Meta role, Connected/);
  await expect(meta).toContainText("Meta existing");

  await openTerminal(page, "Ordinary terminal");
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Ordinary terminal");

  const composer = page.getByRole("region", {
    name: "Send to one exact terminal",
  });
  const prompt = composer.getByLabel("Prompt");
  await composer.getByLabel("Target").selectOption("role:meta");
  await prompt.fill("printf 'PC043_TARGET\\n'");
  await prompt.press("Enter");
  await expect(prompt).toHaveValue("printf 'PC043_TARGET\\n'");
  await expect(workspaceStatus).toContainText("Ordinary terminal");
  await prompt.press("Control+Enter");
  await expect(page.locator(".notice")).toContainText(
    "Terminal input accepted for Meta. Agent handling is not confirmed.",
  );
  await expect(composer.getByLabel("Target")).toHaveValue("");
  await expect(prompt).toHaveValue("");
  await expect(workspaceStatus).toContainText("Ordinary terminal");

  await meta.getByRole("button", { name: "Open" }).click();
  await expect(workspaceStatus).toContainText("Meta existing");
  await expect(
    page.getByLabel("Meta existing terminal").locator(".xterm-rows"),
  ).toContainText("PC043_TARGET");
  await expect(
    page.locator(".session-item", { hasText: "Meta existing" }),
  ).toHaveCount(1);

  await composer.getByLabel("Target").selectOption("role:meta");
  await prompt.fill("first line\nsecond line");
  await expect(composer).toContainText(
    "Line breaks and terminal control characters are not allowed.",
  );
  await expect(composer.getByRole("button", { name: "Send" })).toBeDisabled();
  await prompt.fill("unsent mode-scoped draft");

  const general = page.getByRole("button", { name: "General" });
  await general.click();
  await expect(page.locator(".pacium-role-group")).toBeHidden();
  await expect(composer).toBeHidden();
  await page.getByRole("button", { name: "Pacium" }).click();
  await expect(meta).toBeVisible();
  await expect(composer.getByLabel("Target")).toHaveValue("");
  await expect(prompt).toHaveValue("");
  await expect(workspaceStatus).toContainText("Meta existing");

  const orchestrator = roleCard(page, "orchestrator");
  await orchestrator.getByRole("button", { name: "Assign" }).click();
  const orchestratorDialog = page.getByRole("dialog", {
    name: "Assign Orchestrator",
  });
  await expect(orchestratorDialog.getByLabel("Running session")).toBeFocused();
  await orchestratorDialog.getByText("Launch preset", { exact: true }).click();
  await expect(orchestratorDialog.getByLabel("Shell")).toBeChecked();
  await expect(orchestratorDialog.getByLabel("Working directory")).toHaveValue(
    "",
  );
  await orchestratorDialog
    .getByRole("button", { name: "Save Orchestrator" })
    .click();

  await expect(orchestratorDialog).toBeHidden();
  await expect(orchestrator).toHaveAttribute(
    "aria-label",
    /Orchestrator role, Ready to launch/,
  );
  await orchestrator.getByRole("button", { name: "Launch" }).click();

  await expect(orchestrator).toHaveAttribute(
    "aria-label",
    /Orchestrator role, Connected/,
  );
  await expect(page.locator(".workspace-status")).toContainText("Orchestrator");
  await expect(
    page.locator(".session-item", { hasText: "Orchestrator" }),
  ).toHaveCount(1);

  await composer.getByLabel("Target").selectOption("role:orchestrator");
  await prompt.fill("unsent refresh-scoped draft");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Send to one exact terminal" }),
  ).toBeVisible();
  await expect(page.getByLabel("Target")).toHaveValue("");
  await expect(page.getByLabel("Prompt")).toHaveValue("");
  await expect(roleCard(page, "meta")).toHaveAttribute(
    "aria-label",
    /Meta role, Connected/,
  );
  await expect(roleCard(page, "orchestrator")).toHaveAttribute(
    "aria-label",
    /Orchestrator role, Connected/,
  );
  await roleCard(page, "orchestrator")
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.locator(".workspace-status")).toContainText("Orchestrator");
});

async function enterPaciumMode(page: Page): Promise<void> {
  const pacium = page.getByRole("button", { name: "Pacium" });
  await pacium.click();
  await expect(pacium).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pacium-role-group")).toBeVisible();
}

async function openTerminal(page: Page, displayName: string): Promise<void> {
  if (page.url() === "about:blank") {
    await page.goto("/");
  }
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");
  const firstTerminal = page.getByRole("button", {
    name: "Open first terminal",
  });
  const newTerminal =
    (await firstTerminal.count()) > 0
      ? firstTerminal
      : page.getByRole("button", { name: "New terminal" });
  await newTerminal.click();
  await page.getByLabel("Working directory").fill(process.cwd());
  await page.getByPlaceholder("Project shell").fill(displayName);
  await page.getByRole("button", { name: "Open terminal" }).click();
  await expect(workspaceStatus).toContainText(displayName);
}

function roleCard(page: Page, role: "meta" | "orchestrator") {
  return page.locator(`.pacium-role-card[data-role="${role}"]`);
}

async function terminateAllSessions(page: Page): Promise<void> {
  if (page.isClosed()) {
    return;
  }
  const openDialog = page.getByRole("dialog");
  if ((await openDialog.count()) > 0) {
    await page.keyboard.press("Escape");
    if (await openDialog.isVisible().catch(() => false)) {
      await page.reload();
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const sidebar = page.getByRole("complementary", {
    name: "Session navigation",
  });
  if (!(await sidebar.isVisible().catch(() => false))) {
    const showSidebar = page.getByRole("button", {
      name: "Show session sidebar",
    });
    if ((await showSidebar.count()) > 0) {
      await showSidebar.click();
    }
  }

  const sessions = sidebar.locator(".session-item");
  while ((await sessions.count()) > 0) {
    const previousCount = await sessions.count();
    const session = sessions.first();
    await session.click({ button: "right" });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /Terminate process and close/ })
      .click();
    await expect
      .poll(() => sessions.count(), { timeout: 10_000 })
      .toBeLessThan(previousCount);
  }
}
