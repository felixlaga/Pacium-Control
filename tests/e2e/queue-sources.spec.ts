import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const queuePath = process.env.PACIUM_E2E_QUEUE_PATH;
const stateDirectory = process.env.PACIUM_E2E_STATE_DIRECTORY;
const answerPath =
  stateDirectory === undefined
    ? undefined
    : join(stateDirectory, "PACIUM-ANSWERS");

test.beforeEach(async ({ page }) => {
  if (stateDirectory !== undefined) {
    await rm(join(stateDirectory, "pacium.json"), { force: true });
    await rm(join(stateDirectory, "queue-state.json"), { force: true });
    await rm(join(stateDirectory, "PACIUM-ANSWERS"), { force: true });
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
      await rm(join(stateDirectory, "queue-state.json"), { force: true });
      await rm(join(stateDirectory, "PACIUM-ANSWERS"), { force: true });
    }
  }
});

test("records separate decisions and explicitly delivers one compatible answer", async ({
  page,
}) => {
  if (queuePath === undefined || answerPath === undefined) {
    throw new Error("The disposable queue fixture paths are unavailable.");
  }
  await writeFile(queuePath, "Can you approve everything?\n", { mode: 0o600 });
  await openTerminal(page, "Queue observer terminal");
  await configureQueueWorkspace(page, queuePath, answerPath);
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
  await expect(questionInspector).toContainText("No current conflict signal");
  await expect(
    questionInspector.getByRole("button", { name: "Record answer" }),
  ).toBeDisabled();
  await expect(
    questionInspector.getByRole("button", { name: /Approve|Deny/ }),
  ).toHaveCount(0);
  await expect(status).toContainText("Queue observer terminal");

  const answer = questionInspector.getByRole("textbox", {
    name: /^Answer/,
  });
  await answer.fill("Do not grant blanket approval.");
  await answer.press("Escape");
  await expect(answer).toBeFocused();
  await expect(questionInspector).toBeVisible();
  await questionInspector
    .getByRole("textbox", { name: /^Note/ })
    .fill("Keep authority scoped to one exact action.");
  await questionInspector
    .getByRole("button", { name: "Record answer" })
    .click();
  await expect(questionInspector).toContainText("Immutable local decision");
  await expect(questionInspector).toContainText(
    "Do not grant blanket approval.",
  );
  await expect(questionInspector).toContainText("Local operator");
  await expect(questionInspector).toContainText("Ready for delivery");
  await expect(
    questionInspector
      .getByRole("region", { name: "Ready for delivery" })
      .getByRole("code"),
  ).toContainText("PACIUM-ANSWERS");
  await expect(
    questionInspector.getByRole("button", { name: "Record answer" }),
  ).toHaveCount(0);
  await expect(readFile(queuePath, "utf8")).resolves.toBe(
    "Can you approve everything?\n",
  );
  if (stateDirectory === undefined) {
    throw new Error("The disposable decision state directory is unavailable.");
  }
  const decisionStatePath = join(stateDirectory, "queue-state.json");
  const recordedQuestionState = await readFile(decisionStatePath, "utf8");
  expect(recordedQuestionState).toContain("Do not grant blanket approval.");
  expect(recordedQuestionState).not.toContain("Can you approve everything?");
  await expect(readFile(answerPath, "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  });
  await questionInspector.getByText("Review delivery").click();
  const confirmDelivery = questionInspector.getByRole("button", {
    name: "Confirm delivery",
  });
  await expect(confirmDelivery).toBeVisible();
  await questionInspector.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmDelivery).toBeHidden();
  await expect(readFile(answerPath, "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  });
  await questionInspector.getByText("Review delivery").click();
  await expect(confirmDelivery).toBeVisible();
  await confirmDelivery.click();
  await expect(questionInspector).toContainText("Delivered");
  await expect(questionInspector).toContainText(
    "private answer file was created",
  );
  await expect(questionInspector).toContainText("Reconciliation evidence");
  await expect(questionInspector).toContainText("Transport artifact present");
  await expect(questionInspector).toContainText(
    "proves transport output only, not acknowledgement or application",
  );
  await expect(questionInspector).toContainText("Awaiting human evidence");
  const deliveredAnswerText = await readFile(answerPath, "utf8");
  const answerDocument = JSON.parse(deliveredAnswerText) as {
    format: string;
    decision: {
      kind: string;
      payload: { answer?: string };
    };
  };
  expect(answerDocument).toMatchObject({
    format: "pacium_decision_v1",
    decision: {
      kind: "question_answer",
      payload: { answer: "Do not grant blanket approval." },
    },
  });
  expect(await readFile(decisionStatePath, "utf8")).toContain(
    '"status": "delivered"',
  );
  await expect(
    questionInspector.getByRole("button", { name: "Confirm delivery" }),
  ).toHaveCount(0);

  await questionInspector
    .getByRole("button", { name: "Mark acknowledged" })
    .click();
  const confirmLabel = questionInspector.getByRole("button", {
    name: "Confirm label",
  });
  await expect(confirmLabel).toBeVisible();
  await expect(questionInspector).toContainText(
    "Pacium cannot infer this from terminal or artifact evidence",
  );
  await questionInspector.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmLabel).toBeHidden();
  await questionInspector
    .getByRole("button", { name: "Mark acknowledged" })
    .click();
  await questionInspector
    .getByRole("textbox", { name: /Evidence note/ })
    .fill("Verified acknowledgement outside Pacium.");
  await confirmLabel.click();
  await expect(questionInspector).toContainText(
    "Acknowledged · human-labelled",
  );
  await expect(readFile(answerPath, "utf8")).resolves.toBe(deliveredAnswerText);

  await questionInspector.getByRole("button", { name: "Mark applied" }).click();
  await expect(questionInspector).toContainText(
    "does not execute the requested action",
  );
  await questionInspector
    .getByRole("button", { name: "Confirm label" })
    .click();
  await expect(questionInspector).toContainText("Applied · human-labelled");
  await expect(questionInspector).toContainText("Human-labelled history");
  await expect(readFile(queuePath, "utf8")).resolves.toBe(
    "Can you approve everything?\n",
  );
  await expect(status).toContainText("Queue observer terminal");

  await questionInspector.getByRole("button", { name: "← Back" }).click();
  await expect(question).toBeFocused();
  await page.reload();
  await expect(status).toContainText("Queue observer terminal");
  const restoredGroup = page.getByRole("region", {
    name: "Pacium queue",
  });
  const restoredQuestion = restoredGroup.getByRole("button", {
    name: /Question from Needs Felix, Meta, medium confidence/,
  });
  await restoredQuestion.click();
  const restoredInspector = page.getByRole("complementary", {
    name: "Queue item inspector",
  });
  await expect(restoredInspector).toContainText("Immutable local decision");
  await expect(restoredInspector).toContainText(
    "Do not grant blanket approval.",
  );
  await expect(restoredInspector).toContainText("Delivered");
  await expect(restoredInspector).toContainText("Applied · human-labelled");
  await expect(restoredInspector).toContainText("Transport artifact present");

  await writeFile(queuePath, "Approval request: Run exact migration\n", {
    mode: 0o600,
  });
  await restoredGroup.getByRole("button", { name: "Refresh" }).click();
  await expect(restoredInspector).toContainText("no longer current");
  await expect(
    restoredInspector.getByTestId("queue-original-text"),
  ).toHaveCount(0);
  await expect(
    restoredInspector.getByText("Can you approve everything?"),
  ).toHaveCount(0);
  await restoredInspector.getByRole("button", { name: "← Back" }).click();

  const approval = restoredGroup.getByRole("button", {
    name: /Approval from Needs Felix, Meta, high confidence/,
  });
  await expect(approval).toBeFocused();
  await expect(approval).toContainText("Approval from Needs Felix");
  await expect(approval).toContainText("Meta · high confidence");
  await expect(approval).toContainText(
    "Conflict · Source changed after decision",
  );
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
    approvalInspector.getByRole("button", { name: "Approve" }),
  ).toBeVisible();
  await expect(
    approvalInspector.getByRole("button", { name: "Deny" }),
  ).toBeVisible();
  await expect(
    approvalInspector.getByRole("button", { name: "Record answer" }),
  ).toHaveCount(0);
  await approvalInspector.getByRole("button", { name: "Approve" }).click();
  await expect(
    approvalInspector.getByRole("button", { name: "Confirm approval" }),
  ).toBeVisible();
  await approvalInspector.getByRole("button", { name: "Cancel" }).click();
  await expect(
    approvalInspector.getByRole("button", { name: "Approve" }),
  ).toBeVisible();
  await approvalInspector.getByRole("button", { name: "Approve" }).click();
  await approvalInspector
    .getByRole("button", { name: "Confirm approval" })
    .click();
  await expect(approvalInspector).toContainText("Immutable local decision");
  await expect(approvalInspector).toContainText("Approved");
  await expect(
    approvalInspector.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await expect(status).toContainText("Queue observer terminal");
  await expect(readFile(queuePath, "utf8")).resolves.toBe(
    "Approval request: Run exact migration\n",
  );
  const recordedApprovalState = await readFile(decisionStatePath, "utf8");
  expect(recordedApprovalState).toContain('"outcome": "approved"');
  expect(recordedApprovalState).not.toContain(
    "Approval request: Run exact migration",
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

async function configureQueueWorkspace(
  page: Page,
  path: string,
  deliveryPath: string,
) {
  await page.evaluate(
    async ({ answerFilePath, queueSourcePath }) => {
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
              deliveryMethodId: "answers",
            },
          ],
          deliveryMethods: [
            {
              id: "answers",
              label: "Pacium answers",
              type: "answer_file",
              path: answerFilePath,
            },
          ],
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
    { answerFilePath: deliveryPath, queueSourcePath: path },
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
