# Milestone 5 — Durability, packaging, and polish

## Goal

Make Pacium dependable and comfortable for sustained personal use.

## Scope

- optional tmux attach and keep-alive presets;
- optional Tailscale Serve ingress with verified operator identity;
- reconnect after local-server restart for tmux-backed sessions;
- explicit ended-state recovery for direct PTYs;
- process leak and long-output soak tests;
- performance budgets;
- bounded diagnostic export;
- accessibility review;
- theme and visual-polish pass;
- macOS packaging;
- Linux packaging if included by the supported-platform decision;
- clean install, upgrade, and uninstall documentation;
- release verification.

## Acceptance criteria

1. Direct PTY and tmux-backed capabilities are labelled accurately.
2. tmux is not required for ordinary use.
3. Long-running sessions do not cause unbounded memory, CPU, log, or file growth.
4. Clean installation reproduces the core terminal and Pacium workflows.
5. Upgrade preserves compatible configuration or reports migration clearly.
6. Diagnostic export is explicit and redaction-aware.
7. Keyboard and screen-reader workflows pass the supported accessibility matrix.
8. Release limitations are documented.
9. Remote mode remains tailnet-only and the Pacium server remains loopback-bound.

## Implemented remote slice

PC-077 completes the application half of criterion 9:

- Pacium still accepts only `127.0.0.1` as its listener.
- Optional remote startup requires one canonical `*.ts.net` HTTPS Origin and a
  bounded non-empty exact-login allowlist.
- Assets, health, bootstrap, protected HTTP, and WebSocket upgrades distinguish
  Local and Tailscale authority without trusting IP, display name, device, or
  browser identity claims.
- Funnel is explicitly rejected; the existing ephemeral token still protects
  control transports.
- Protocol 18 and the compact header label expose current per-socket authority
  and clear it on disconnect.
- The active operations runbook covers grants, Serve status/off, revocation,
  local-only rollback, and manual public/LAN denial checks.

Deterministic repository tests prove the loopback and proxy-shaped application
boundary. A real owner tailnet canary, supported-runtime clean install, and
public/Funnel/grant/revocation exercise remain Milestone-5 release evidence.

## Implemented tmux attachment slice

PC-070 completes the explicit attachment half of criteria 1 and 2:

- Direct PTYs remain the default and tmux remains unconfigured unless one
  absolute local Unix socket is supplied at startup.
- Protocol 23 exposes bounded capability and session observations; the browser
  sends only an exact published server/session identity and dimensions.
- The server uses fixed no-shell discovery and attach argv, revalidates the
  target, and runs the client through the existing PTY input, resize, snapshot,
  tab, split, and reconnect pipeline.
- Runtime and close copy distinguish the Pacium-owned tmux client from the
  external server session. Pacium never invokes `kill-session`.
- An isolated tmux 3.7b browser canary proves explicit attach, input, browser
  reload, view close, client disconnect, and surviving external session state.

PC-071 completes the keep-alive half of criteria 1 and 2:

- A ready configured socket adds one unchecked launch choice; direct PTY stays
  the default.
- Pacium launches only an available fixed preset under a generated target using
  direct tmux command arguments and persists the explicit policy before the
  client is claimed.
- Startup deduplicates and revalidates exact retained targets, attaches one
  fresh predecessor-linked client, and never reruns a missing command.
- Deliberate close and shutdown detach the exact Pacium client without invoking
  `kill-session`.
- Real tmux/PTY evidence covers input, client detach, manager restart, fresh
  identity, deliberate close, and target survival.

PC-072 establishes the bounded personal-load evidence for criterion 3:

- `pnpm test:soak` exercises 20 idle terminals, one long-running agent, 100
  create/close cycles, 8 MiB output, 100 reconnect snapshots, explicit RSS and
  live-heap budgets, and five real PTYs with a four-FD ceiling.
- Browser-model tests churn 2,000 split operations and 5,000 attention cursors
  while preserving the existing four-pane and 200-entry limits.
- The real-PTY canary found and fixed three macOS native descriptor closures in
  the pinned `node-pty`; supported Node 24 returned exactly to baseline.
- This is a bounded development-machine baseline, not a multi-day field-soak or
  production-monitoring claim.

PC-073 completes criterion 6:

- A strict response-only version-1 snapshot caps the full JSON at 256 KiB and
  projects only already loaded bounded health, version, process, provider,
  queue, tmux, and fixed-code metadata.
- Export-local `Terminal N` labels and structural allowlisting exclude terminal
  content, paths, commands, source identities, Git/queue/provider content,
  credentials, host/operator identity, and relaunch metadata.
- The existing protected Local/Tailscale boundary serves the no-store read.
  Exact inert preview gates a browser-local JSON download; there is no server
  file, telemetry, upload, background polling, or new shell/filesystem
  authority.
- Full supported-runtime verification and all 20 Chromium workflows passed,
  including a parsed real download and live-PTY preservation through routing
  and browser reload.

PC-074 through PC-076 still own macOS packaging, Linux validation, and final
release-readiness evidence.

## Demo

Install the packaged application on a clean account, run a sustained multi-session workflow, restart the browser and local server, reconnect optional tmux-backed sessions, operate Pacium mode, and remove the application without deleting repositories or provider credentials.
