import { z } from "zod";

import { TmuxSessionIdSchema } from "./tmux.js";

export const HOST_SETUP_SCHEMA_VERSION = 1;
export const MAX_HOST_SETUP_BYTES = 16 * 1024;

const HostSetupOriginSchema = z
  .string()
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.port === "" &&
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === "" &&
        url.username === "" &&
        url.password === "" &&
        url.hostname.endsWith(".ts.net")
      );
    } catch {
      return false;
    }
  }, "Host setup origin must be canonical tailnet HTTPS.");

const HostSetupLoginSchema = z
  .string()
  .min(1)
  .max(254)
  .regex(/^[\x21-\x2b\x2d-\x7e]+$/);

export const HostSetupDocumentSchema = z
  .object({
    schemaVersion: z.literal(HOST_SETUP_SCHEMA_VERSION),
    loopbackPort: z.literal(4174),
    tmuxSocket: z.string().min(1).max(4_096),
    metaTmuxSessionName: z.string().min(1).max(200),
    tailscaleOrigin: HostSetupOriginSchema,
    tailscaleOperatorLogin: HostSetupLoginSchema,
  })
  .strict();
export type HostSetupDocument = z.infer<typeof HostSetupDocumentSchema>;

export const HostSetupTmuxChoiceSchema = z
  .object({
    id: TmuxSessionIdSchema,
    name: z.string().min(1).max(200),
  })
  .strict();

export const HostSetupSnapshotSchema = z
  .object({
    status: z.enum(["ready", "configured", "unavailable", "error"]),
    tmuxSessions: z.array(HostSetupTmuxChoiceSchema).max(64),
    selectedTmuxSessionId: TmuxSessionIdSchema.nullable(),
    tailscale: z
      .object({
        state: z.enum([
          "ready",
          "not_installed",
          "signed_out",
          "unavailable",
          "existing_serve",
        ]),
        origin: HostSetupOriginSchema.nullable(),
        login: HostSetupLoginSchema.nullable(),
      })
      .strict(),
    remoteUrl: HostSetupOriginSchema.nullable(),
    canApply: z.boolean(),
    detail: z.string().min(1).max(300),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const hasIdentity =
      snapshot.tailscale.origin !== null && snapshot.tailscale.login !== null;
    if ((snapshot.tailscale.state === "ready") !== hasIdentity) {
      context.addIssue({
        code: "custom",
        message: "Ready Tailscale setup requires exact identity.",
      });
    }
    if ((snapshot.status === "configured") !== (snapshot.remoteUrl !== null)) {
      context.addIssue({
        code: "custom",
        message: "Configured setup requires one remote URL.",
      });
    }
  });
export type HostSetupSnapshot = z.infer<typeof HostSetupSnapshotSchema>;

export const HostSetupApplyRequestSchema = z
  .object({
    tmuxSessionId: TmuxSessionIdSchema,
  })
  .strict();
export type HostSetupApplyRequest = z.infer<typeof HostSetupApplyRequestSchema>;

export const HostSetupApplyResultSchema = z
  .object({
    outcome: z.enum([
      "configured",
      "approval_required",
      "refused",
      "failed",
      "unknown",
    ]),
    snapshot: HostSetupSnapshotSchema,
    approvalUrl: z
      .string()
      .url()
      .max(2_048)
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          url.hostname === "login.tailscale.com" &&
          url.username === "" &&
          url.password === ""
        );
      })
      .nullable(),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      (result.outcome === "approval_required") !==
      (result.approvalUrl !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only approval-required results include an approval URL.",
      });
    }
  });
export type HostSetupApplyResult = z.infer<typeof HostSetupApplyResultSchema>;
