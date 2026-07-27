import type { PaciumConfigObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_PACIUM_CONFIG,
  beginPaciumConfigRequest,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import { buildPaciumModeSummary } from "./pacium-mode-summary-model.js";

describe("Pacium mode configuration summary", () => {
  it("keeps loading and disconnected states honest about terminal survival", () => {
    expect(
      buildPaciumModeSummary(IDLE_PACIUM_CONFIG, "connected"),
    ).toMatchObject({
      status: "loading",
      title: "Loading Pacium workspace",
      canRetry: true,
    });
    expect(
      buildPaciumModeSummary(
        beginPaciumConfigRequest(IDLE_PACIUM_CONFIG, "request-1", "get"),
        "reconnecting",
      ),
    ).toMatchObject({
      status: "loading",
      canRetry: false,
      freshness: "Last accepted definition · disconnected",
    });
  });

  it("distinguishes unconfigured and bounded error evidence", () => {
    expect(
      buildPaciumModeSummary(
        loaded({
          status: "unconfigured",
          revision: null,
          workspace: null,
          error: null,
        }),
        "connected",
      ),
    ).toMatchObject({
      status: "unconfigured",
      title: "Pacium setup needed",
    });

    expect(
      buildPaciumModeSummary(
        loaded({
          status: "error",
          revision: null,
          workspace: null,
          error: {
            code: "invalid_file",
            message: "<script>repair me</script>",
          },
        }),
        "connected",
      ),
    ).toMatchObject({
      status: "error",
      detail: "<script>repair me</script>",
    });
  });

  it("counts configured references without claiming live work", () => {
    const summary = buildPaciumModeSummary(
      loaded({
        status: "ready",
        revision: 2,
        workspace: {
          id: "primary",
          label: "Agent oversight",
          repositories: [
            {
              id: "pacium",
              label: "Pacium",
              root: "/work/pacium",
              verificationPresetIds: [],
            },
          ],
          roles: {
            meta: {
              type: "launch_preset",
              launchPreset: "codex",
              repositoryId: "pacium",
            },
            orchestrator: null,
          },
          workers: [
            {
              id: "worker-1",
              label: "Worker",
              binding: {
                type: "launch_preset",
                launchPreset: "codex",
                repositoryId: "pacium",
              },
            },
          ],
          queueSources: [
            {
              id: "queue",
              label: "Queue",
              path: "/work/queue",
              format: "plain_text",
              requestingRole: "unknown",
              deliveryMethodId: null,
            },
          ],
          deliveryMethods: [],
          context: { objective: null, plan: null },
        },
        error: null,
      }),
      "connected",
    );

    expect(summary).toMatchObject({
      status: "ready",
      title: "Agent oversight",
      detail: expect.stringContaining("Configured references only"),
      stats: [
        { label: "Roles", value: "1/2" },
        { label: "Workers", value: "1" },
        { label: "Repos", value: "1" },
        { label: "Queues", value: "1" },
      ],
    });
  });
});

function loaded(observation: PaciumConfigObservation): PaciumConfigViewState {
  return {
    status: "loaded",
    requestId: "request-1",
    observation,
  };
}
