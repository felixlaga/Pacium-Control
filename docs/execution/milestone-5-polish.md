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

## Demo

Install the packaged application on a clean account, run a sustained multi-session workflow, restart the browser and local server, reconnect optional tmux-backed sessions, operate Pacium mode, and remove the application without deleting repositories or provider credentials.
