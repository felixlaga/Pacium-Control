import type { PaciumConfigObservation } from "@pacium/contracts";
import { describe, expect, it } from "vitest";

import {
  IDLE_PACIUM_CONFIG,
  acceptPaciumConfigResponse,
  beginPaciumConfigRequest,
  interruptPaciumConfigRequest,
  visiblePaciumConfig,
} from "./pacium-config-model.js";

const unconfigured: PaciumConfigObservation = {
  status: "unconfigured",
  revision: null,
  workspace: null,
  error: null,
};

describe("Pacium config request state", () => {
  it("accepts only the matching get response", () => {
    const loading = beginPaciumConfigRequest(
      IDLE_PACIUM_CONFIG,
      "request-1",
      "get",
    );
    expect(loading.status).toBe("loading");
    expect(
      acceptPaciumConfigResponse(loading, "stale-request", unconfigured),
    ).toBe(loading);
    expect(
      acceptPaciumConfigResponse(loading, "request-1", unconfigured),
    ).toEqual({
      status: "loaded",
      requestId: "request-1",
      observation: unconfigured,
    });
  });

  it("retains accepted server evidence while replacing", () => {
    const loaded = acceptPaciumConfigResponse(
      beginPaciumConfigRequest(IDLE_PACIUM_CONFIG, "request-1", "get"),
      "request-1",
      unconfigured,
    );
    const replacing = beginPaciumConfigRequest(loaded, "request-2", "replace");
    expect(replacing.status).toBe("replacing");
    expect(visiblePaciumConfig(replacing)).toBe(unconfigured);
  });

  it("drops pending intent on disconnect without inventing success", () => {
    const initial = beginPaciumConfigRequest(
      IDLE_PACIUM_CONFIG,
      "request-1",
      "get",
    );
    expect(interruptPaciumConfigRequest(initial)).toBe(IDLE_PACIUM_CONFIG);

    const loaded = acceptPaciumConfigResponse(
      initial,
      "request-1",
      unconfigured,
    );
    const replacing = beginPaciumConfigRequest(loaded, "request-2", "replace");
    expect(interruptPaciumConfigRequest(replacing, "unrelated-request")).toBe(
      replacing,
    );
    expect(interruptPaciumConfigRequest(replacing, "request-2")).toEqual({
      status: "loaded",
      requestId: "request-2",
      observation: unconfigured,
    });
  });
});
