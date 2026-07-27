import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const stateDirectory = process.env.PACIUM_E2E_STATE_DIRECTORY;
const objectivePath = process.env.PACIUM_E2E_OBJECTIVE_PATH;
const planPath = process.env.PACIUM_E2E_PLAN_PATH;
const objectiveText = "Make local agents easy to supervise.\n";
const planText = "Keep terminal truth primary and context explicit.\n";

test.beforeEach(async ({ page }) => {
  if (
    stateDirectory === undefined ||
    objectivePath === undefined ||
    planPath === undefined
  ) {
    throw new Error("The disposable Pacium context fixture is unavailable.");
  }
  await rm(join(stateDirectory, "pacium.json"), { force: true });
  await rm(join(stateDirectory, "queue-state.json"), { force: true });
  await writeFile(objectivePath, objectiveText, { mode: 0o600 });
  await writeFile(planPath, planText, { mode: 0o600 });
  await page.goto("/");
  await terminateAllSessions(page);
});

test.afterEach(async ({ page }) => {
  await terminateAllSessions(page);
  if (stateDirectory !== undefined) {
    await rm(join(stateDirectory, "pacium.json"), { force: true });
    await rm(join(stateDirectory, "queue-state.json"), { force: true });
  }
});

test("supervises configured workers and explicit control context without replacing terminal truth", async ({
  page,
}) => {
  if (objectivePath === undefined || planPath === undefined) {
    throw new Error("The disposable Pacium context paths are unavailable.");
  }
  await openTerminal(page, "Worker alpha");
  await openTerminal(page, "Observer terminal");
  await configureContextWorkspace(page, objectivePath, planPath);
  await page.reload();

  const status = page.locator(".workspace-status");
  await expect(status).toContainText("Observer terminal");
  const pacium = page.getByRole("button", { name: "Pacium" });
  await pacium.click();
  await expect(pacium).toHaveAttribute("aria-pressed", "true");

  const workers = page.getByRole("region", { name: "Workers" });
  await expect(workers).toBeVisible();
  await expect(workers).toContainText(
    "Configured identities only. Process evidence does not prove task progress.",
  );
  const liveWorker = workers.getByRole("article", {
    name: /Worker alpha worker, Live process/,
  });
  await expect(liveWorker).toContainText("Shell");
  await expect(liveWorker).toContainText("Pacium Control");
  await expect(liveWorker).toContainText("Not inspected");
  const reserveWorker = workers.getByRole("article", {
    name: /Reserve worker worker, Configured · not started/,
  });
  await expect(reserveWorker).toContainText("No exact PTY exists");
  await expect(reserveWorker.getByRole("button")).toHaveCount(0);

  await liveWorker.getByRole("button", { name: "Open" }).click();
  await expect(status).toContainText("Worker alpha");
  await expect(
    page.getByLabel("Worker alpha terminal").locator(".xterm"),
  ).toBeVisible();

  const contextTrigger = page.getByRole("button", { name: "Open context" });
  await contextTrigger.focus();
  await contextTrigger.press("Enter");
  const inspector = page.getByRole("complementary", {
    name: "Control context inspector",
  });
  await expect(inspector).toBeVisible();
  await expect(
    inspector.getByRole("heading", {
      name: "Objective, plan, and decisions",
    }),
  ).toBeFocused();
  await expect(inspector).toContainText(objectiveText.trim());
  await expect(inspector).toContainText(planText.trim());
  await expect(inspector).toContainText(
    "No immutable local decisions are recorded for this profile.",
  );
  await expect(inspector).toContainText(
    "Pacium does not infer tasks, progress, or resulting work.",
  );
  await expect(status).toContainText("Worker alpha");

  await inspector.getByRole("button", { name: "Refresh" }).click();
  await expect(inspector).toContainText(objectiveText.trim());
  await expect(
    inspector.getByRole("button", { name: "Refresh" }),
  ).toBeEnabled();
  await expect(status).toContainText("Worker alpha");

  await page.reload();
  await expect(status).toContainText("Worker alpha");
  await expect(
    page.getByRole("complementary", { name: "Session inspector" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open context" }).click();
  const reconnectedInspector = page.getByRole("complementary", {
    name: "Control context inspector",
  });
  await expect(reconnectedInspector).toContainText(objectiveText.trim());
  await reconnectedInspector.press("Escape");
  await expect(contextTrigger).toBeFocused();
  await expect(status).toContainText("Worker alpha");

  await contextTrigger.click();
  await page.getByRole("button", { name: "General" }).click();
  await expect(
    page.getByRole("complementary", { name: "Session inspector" }),
  ).toBeVisible();
  await expect(status).toContainText("Worker alpha");
  await page.getByRole("button", { name: "Pacium" }).click();
  await page.getByRole("button", { name: "Open context" }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await expect(
    page.getByRole("complementary", {
      name: "Control context inspector",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(status).toContainText("Worker alpha");
});

async function configureContextWorkspace(
  page: Page,
  acceptedObjectivePath: string,
  acceptedPlanPath: string,
): Promise<void> {
  await page.evaluate(
    async ({ contextObjectivePath, contextPlanPath, repositoryRoot }) => {
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
          { once: true },
        );
      });
      const request = (message: Record<string, unknown>) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const requestId = message.requestId;
          const timeout = window.setTimeout(
            () => reject(new Error("Pacium context config timed out")),
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
      const listed = await request({
        type: "session.list",
        requestId: crypto.randomUUID(),
      });
      const sessions = listed.sessions as
        Array<{ id: string; displayName: string }> | undefined;
      const worker = sessions?.find(
        ({ displayName }) => displayName === "Worker alpha",
      );
      if (worker === undefined) {
        throw new Error("The exact worker session was not listed.");
      }
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
          label: "Control workspace",
          repositories: [
            {
              id: "pacium",
              label: "Pacium Control",
              root: repositoryRoot,
              verificationPresetIds: [],
            },
          ],
          roles: { meta: null, orchestrator: null },
          workers: [
            {
              id: "worker-alpha",
              label: "Worker alpha",
              binding: { type: "session", sessionId: worker.id },
            },
            {
              id: "reserve-worker",
              label: "Reserve worker",
              binding: {
                type: "launch_preset",
                launchPreset: "shell",
                repositoryId: "pacium",
              },
            },
          ],
          queueSources: [],
          deliveryMethods: [],
          context: {
            objective: {
              path: contextObjectivePath,
              format: "plain_text",
            },
            plan: { path: contextPlanPath, format: "plain_text" },
          },
        },
      });
      if (
        replaced.type !== "pacium.config" ||
        (replaced.observation as { status?: string } | undefined)?.status !==
          "ready"
      ) {
        throw new Error(
          "The control workspace configuration was not accepted.",
        );
      }
      socket.close();
    },
    {
      contextObjectivePath: acceptedObjectivePath,
      contextPlanPath: acceptedPlanPath,
      repositoryRoot: process.cwd(),
    },
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
