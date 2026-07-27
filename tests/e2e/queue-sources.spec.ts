import { readFile, writeFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const queuePath = process.env.PACIUM_E2E_QUEUE_PATH;

test("observes a real queue source without exposing content or changing the terminal", async ({
  page,
}) => {
  if (queuePath === undefined) {
    throw new Error("The disposable queue fixture path is unavailable.");
  }
  await writeFile(queuePath, "Initial private queue\n", { mode: 0o600 });
  await page.goto("/");
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
  await expect(source).toContainText("22 B");
  await expect(page.getByText("Initial private queue")).toHaveCount(0);

  const firstEvidence = await source.locator("small").textContent();
  await writeFile(queuePath, "Updated private queue with more\n", {
    mode: 0o600,
  });
  await group.getByRole("button", { name: "Refresh" }).click();
  await expect(source).toContainText("32 B");
  await expect(source.locator("small")).not.toHaveText(firstEvidence ?? "");
  await expect(page.getByText("Updated private queue with more")).toHaveCount(
    0,
  );
  await expect(status).toContainText("Queue observer terminal");
  await expect(readFile(queuePath, "utf8")).resolves.toBe(
    "Updated private queue with more\n",
  );

  await page.getByRole("button", { name: "General" }).click();
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
