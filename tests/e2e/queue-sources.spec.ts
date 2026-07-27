import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const queuePath = process.env.PACIUM_E2E_QUEUE_PATH;
const stateDirectory = process.env.PACIUM_E2E_STATE_DIRECTORY;

test.beforeEach(async ({ page }) => {
  if (stateDirectory !== undefined) {
    await rm(join(stateDirectory, "pacium.json"), { force: true });
  }
  await page.goto("/");
  await terminateAllSessions(page);
});

test.afterEach(async ({ page }) => {
  try {
    await terminateAllSessions(page);
  } finally {
    if (stateDirectory !== undefined) {
      await rm(join(stateDirectory, "pacium.json"), { force: true });
    }
  }
});

test("classifies a real queue source without granting approval or changing the terminal", async ({
  page,
}) => {
  if (queuePath === undefined) {
    throw new Error("The disposable queue fixture path is unavailable.");
  }
  await writeFile(queuePath, "Can you approve everything?\n", { mode: 0o600 });
  await openTerminal(page, "Queue observer terminal");
  await configureQueueWorkspace(page, queuePath);
  await page.reload();

  const status = page.locator(".workspace-status");
  await expect(status).toContainText("Queue observer terminal");
  await page.getByRole("button", { name: "Pacium" }).click();
  const group = page.getByRole("region", {
    name: "Queue source observation",
  });
  const source = group.getByRole("article", {
    name: /Needs Felix queue source/,
  });
  await expect(source).toContainText("Stable · Meta");
  await expect(source).toContainText("Question · Medium confidence");
  await expect(source).toContainText(
    "A final question mark suggests a question.",
  );
  await expect(source).toContainText("28 B");
  await expect(page.getByText("Can you approve everything?")).toHaveCount(0);

  const firstEvidence = await source.locator("small").last().textContent();
  await writeFile(queuePath, "Approval request: Run exact migration\n", {
    mode: 0o600,
  });
  await group.getByRole("button", { name: "Refresh" }).click();
  await expect(source).toContainText("Approval · High confidence");
  await expect(source).toContainText(
    "A supported plain-text legacy marker was used.",
  );
  await expect(source).toContainText("38 B");
  await expect(source.locator("small").last()).not.toHaveText(
    firstEvidence ?? "",
  );
  await expect(
    page.getByText("Approval request: Run exact migration"),
  ).toHaveCount(0);
  await expect(status).toContainText("Queue observer terminal");
  await expect(readFile(queuePath, "utf8")).resolves.toBe(
    "Approval request: Run exact migration\n",
  );

  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await expect(source).toBeVisible();
  await expect(source).toContainText("Approval · High confidence");
  const refresh = group.getByRole("button", { name: "Refresh" });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);

  const general = page.getByRole("button", { name: "General" });
  await general.focus();
  await general.press("Enter");
  await expect(group).toBeHidden();
  await expect(status).toContainText("Queue observer terminal");
});

async function configureQueueWorkspace(page: Page, path: string) {
  await page.evaluate(
    async ({ queueSourcePath }) => {
      const bootstrapResponse = await fetch("/api/bootstrap", {
        headers: { accept: "application/json" },
      });
      const bootstrap = (await bootstrapResponse.json()) as {
        accessToken: string;
        webSocketPath: string;
      };
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(
        `${scheme}//${window.location.host}${bootstrap.webSocketPath}`,
        ["pacium.v1", `pacium.token.${bootstrap.accessToken}`],
      );
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener(
          "error",
          () => reject(new Error("open failed")),
          {
            once: true,
          },
        );
      });
      const request = (message: Record<string, unknown>) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const requestId = message.requestId;
          const timeout = window.setTimeout(
            () => reject(new Error("Pacium config request timed out")),
            5_000,
          );
          const receive = (event: MessageEvent<string>) => {
            const response = JSON.parse(event.data) as Record<string, unknown>;
            if (response.requestId === requestId) {
              window.clearTimeout(timeout);
              socket.removeEventListener("message", receive);
              resolve(response);
            }
          };
          socket.addEventListener("message", receive);
          socket.send(JSON.stringify(message));
        });
      const current = await request({
        type: "pacium.config.get",
        requestId: crypto.randomUUID(),
      });
      const observation = current.observation as
        { status: string; revision: number | null } | undefined;
      const expectedRevision =
        observation?.status === "ready" && observation.revision !== null
          ? observation.revision
          : 0;
      const replaced = await request({
        type: "pacium.config.replace",
        requestId: crypto.randomUUID(),
        expectedRevision,
        workspace: {
          id: "primary",
          label: "Queue workspace",
          repositories: [],
          roles: { meta: null, orchestrator: null },
          workers: [],
          queueSources: [
            {
              id: "needs-felix",
              label: "Needs Felix",
              path: queueSourcePath,
              format: "plain_text",
              requestingRole: "meta",
              deliveryMethodId: null,
            },
          ],
          deliveryMethods: [],
          context: { objective: null, plan: null },
        },
      });
      if (
        replaced.type !== "pacium.config" ||
        (replaced.observation as { status?: string } | undefined)?.status !==
          "ready"
      ) {
        throw new Error("Queue workspace configuration was not accepted.");
      }
      socket.close();
    },
    { queueSourcePath: path },
  );
}

async function openTerminal(page: Page, displayName: string): Promise<void> {
  const workspaceStatus = page.locator(".workspace-status");
  await expect(workspaceStatus).toContainText("Connected");
  const firstTerminal = page.getByRole("button", {
    name: "Open first terminal",
  });
  const trigger =
    (await firstTerminal.count()) > 0
      ? firstTerminal
      : page.getByRole("button", { name: "New terminal" });
  await trigger.click();
  await page.getByLabel("Working directory").fill(process.cwd());
  await page.getByPlaceholder("Project shell").fill(displayName);
  await page.getByRole("button", { name: "Open terminal" }).click();
  await expect(workspaceStatus).toContainText(displayName);
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
    await sessions.first().click({ button: "right" });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /Terminate process and close/ })
      .click();
    await expect
      .poll(() => sessions.count(), { timeout: 10_000 })
      .toBeLessThan(previousCount);
  }
}
