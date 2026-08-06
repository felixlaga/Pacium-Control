import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

test.skip(
  process.env.PACIUM_E2E_HOST_SETUP !== "1" ||
    process.env.PACIUM_TMUX_SOCKET === undefined,
  "run with PACIUM_E2E_HOST_SETUP=1 and the isolated tmux fixture",
);

test("configures remote Meta from local settings without command fields", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Workspace settings" });
  const setup = dialog.getByText("Remote Meta").locator("..").locator("..");
  await expect(
    dialog.getByText("Choose the existing Meta session"),
  ).toBeVisible();
  await expect(dialog.getByLabel("Meta session")).toHaveValue("$0");
  await expect(dialog).toContainText("Tailscale · felix@example.com");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Enable remote Meta" }).click();
  const open = dialog.getByRole("link", { name: "Open Pacium" });
  await expect(open).toHaveAttribute(
    "href",
    "https://felix-harness.example-tailnet.ts.net",
  );
  expect(existsSync(process.env.PACIUM_E2E_TAILSCALE_STATE!)).toBe(true);
  await expect(setup).not.toContainText("ssh root@");

  await dialog.getByRole("button", { name: "Cancel settings" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("main.stage")).toContainText("pacium-e2e");
});
