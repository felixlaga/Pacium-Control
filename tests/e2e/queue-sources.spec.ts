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

test("inspects exact queue text without granting approval or changing the terminal", async ({
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
    name: "Pacium queue",
  });
  const question = group.getByRole("button", {
    name: /Question from Needs Felix, Meta, medium confidence/,
  });
  await expect(question).toContainText("Question from Needs Felix");
  await expect(question).toContainText("Meta · medium confidence");
  await expect(question).toContainText("this run");
  await expect(page.getByText("Can you approve everything?")).toHaveCount(0);
  await expect(status).toContainText("Queue observer terminal");

  await question.focus();
  await expect(question).toBeFocused();
  await question.press("Enter");
  const questionInspector = page.getByRole("complementary", {
    name: "Queue item inspector",
  });
  await expect(questionInspector).toBeVisible();
  const questionHeading = questionInspector.getByRole("heading", {
    name: "Question from Needs Felix",
  });
  await expect(questionHeading).toBeFocused();
  await expect(questionInspector.getByTestId("queue-original-text")).toHaveText(
    "Can you approve everything?",
  );
  await expect(questionInspector).toContainText("Medium");
  await expect(questionInspector).toContainText(
    "A final question mark suggests a question.",
  );
  await expect(questionInspector).toContainText("whole_source_v1");
  await expect(questionInspector).toContainText("Conflict detection");
  await expect(
    questionInspector.getByRole("button", { name: /Approve|Answer|Deny/ }),
  ).toHaveCount(0);
  await expect(status).toContainText("Queue observer terminal");

  await questionHeading.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Session inspector" }),
  ).toBeVisible();
  await expect(question).toBeFocused();
  await expect(page.getByText("Can you approve everything?")).toHaveCount(0);

  await question.press("Enter");
  await expect(questionInspector.getByTestId("queue-original-text")).toHaveText(
    "Can you approve everything?",
  );
  await writeFile(queuePath, "Approval request: Run exact migration\n", {
    mode: 0o600,
  });
  await group.getByRole("button", { name: "Refresh" }).click();
  await expect(questionInspector).toContainText("no longer current");
  await expect(
    questionInspector.getByTestId("queue-original-text"),
  ).toHaveCount(0);
  await expect(
    questionInspector.getByText("Can you approve everything?"),
  ).toHaveCount(0);
  await questionInspector.getByRole("button", { name: "← Back" }).click();

  const approval = group.getByRole("button", {
    name: /Approval from Needs Felix, Meta, high confidence/,
  });
  await expect(approval).toBeFocused();
  await expect(approval).toContainText("Approval from Needs Felix");
  await expect(approval).toContainText("Meta · high confidence");
  await approval.press("Enter");
  const approvalInspector = page.getByRole("complementary", {
    name: "Queue item inspector",
  });
  await expect(approvalInspector.getByTestId("queue-original-text")).toHaveText(
    "Approval request: Run exact migration",
  );
  await expect(approvalInspector).toContainText("High");
  await expect(approvalInspector).toContainText(
    "A supported plain-text legacy marker was used.",
  );
  await expect(
    approvalInspector.getByRole("button", { name: /Approve|Answer|Deny/ }),
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
  await expect(approvalInspector).toBeVisible();
  const back = approvalInspector.getByRole("button", { name: "← Back" });
  await back.focus();
  await expect(back).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);

  await back.click();
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
