# Changelog

All notable changes to the Pacium Control blueprint are recorded here.

## 0.11.0 — responsive accessibility baseline — 2026-07-27

### Added

- Stable names for the session navigation, terminal workspace, inspector,
  terminal panes, status, and all current modal surfaces.
- Keyboard-visible skip navigation plus a compact live status line for
  connection, selected session, and terminal/application keyboard ownership.
- Browser-local version-1 sidebar and inspector visibility with visible
  controls, `Cmd/Ctrl B`, `Cmd/Ctrl Shift B`, and command-palette actions.
- Responsive sidebar and inspector drawers that preserve PTYs, tabs, splits,
  selection, and reconnect state.
- One tested Escape and Tab-containment contract across create, directory,
  session-action, rename, settings, and command dialogs, with invoking-focus
  restoration.
- Reduced-motion and forced-colors behavior plus a documented 320 CSS px
  minimum.
- Deterministic panel, shortcut, focus, status, and server-rendered semantic
  tests plus four Playwright accessibility workflows.

### Verified

- `pnpm verify` passes formatting, lint, type checking, 27 test files and
  106 tests, and both production bundles.
- `pnpm test:e2e` passes skip navigation, panel shortcuts, nested modal focus
  return, 320 CSS px drawers, 200% zoom, forced colors, and reduced motion in
  Chromium.
- The browser suite caught and now guards a compact-layout selector that had
  made the drawer’s New terminal action unreachable.

### Known limitations

- Manual screen-reader, visual contrast, and international keyboard-layout
  checks remain release evidence rather than automated certification.
- The full rendered create/type/refresh/reconnect/close terminal lifecycle is
  not yet a browser test.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js
  24.18.x runtime remains to be verified.
- The web bundle is 689 kB before gzip and still emits the tracked chunk-size
  warning.

## 0.10.0 — local workspace preferences — 2026-07-27

### Added

- A strict version-1 browser-local preference record with bounded parsing, deterministic serialization, and safe defaults.
- System, dark, and light application and xterm themes plus compact and comfortable workspace density.
- Three controlled terminal font stacks, 11–18 px sizing, 1.1–1.6 line height, and 500–10,000 ephemeral scrollback lines.
- In-place terminal option updates and refitting without PTY recreation, input replay, or reconnect-cursor changes.
- Available-provider default launch selection with honest fallback when a saved CLI is unavailable.
- A stored off/important-attention notification level whose delivery remains explicitly deferred to PC-032.
- One settings surface available from the top bar, `Cmd/Ctrl ,`, and command palette, with Cancel, Restore defaults, Apply, Escape, and focus containment.
- Deterministic preference, storage-failure, theme/preset resolution, terminal-option, shortcut, command, and server-rendered settings tests.
- A scoped PC-027 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 94 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Malformed, oversized, unknown-version, extra-key, out-of-range, and unavailable-storage states fail safely in deterministic tests.

### Known limitations

- Rendered light/system theme, density, live terminal update, keyboard, focus, responsive, and refresh validation remains pending because no browser backend was available.
- Preferences are intentionally local to one browser profile and do not synchronize across clients.
- Notification delivery begins with PC-032; the current preference is stored but does not request browser permission or emit notifications.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 684 kB before gzip and still emits the tracked chunk-size warning.

## 0.9.0 — contextual command palette — 2026-07-27

### Added

- A compact `Cmd/Ctrl K` command palette that ranks selected-terminal context before general workspace commands.
- Bounded case-insensitive token search across session name, repository, preset, cwd, state, and action context.
- Typed dispatch for terminal creation, session switching, split creation/focus/maximize, and existing session actions.
- Consequence-labelled disabled results and confirmation routing for destructive process or record removal.
- A searchable `?` reference for every currently implemented application shortcut.
- Arrow, Enter, Escape, pointer, modal-focus, invoking-focus restoration, no-match, and responsive states.
- Deterministic catalog, ranking, query/result bound, keyboard-routing, and server-rendered component tests.
- A scoped PC-026 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 82 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Terminal capture, editable controls, and open modals suppress global palette/help shortcuts in deterministic tests.

### Known limitations

- Rendered pointer, keyboard, modal-focus, responsive, and international-layout validation remains pending because no browser backend was available.
- The palette covers implemented terminal-workspace actions only; Git, provider, Pacium-mode, preferences, and verification commands arrive with their consumers.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 673 kB before gzip and still emits the tracked chunk-size warning.

## 0.8.0 — consistent session actions — 2026-07-27

### Added

- One consequence-aware session menu shared by the workspace header, terminal panes, and session/tab context menus.
- Server-owned rename with strict bounded protocol validation and live summary updates.
- Duplicate and ended-session relaunch flows that reuse retained preset, canonical cwd, and terminal dimensions without changing the source.
- Clipboard-aware cwd copy, explicit `SIGINT`, view-only closure, and confirmed live-process termination.
- Repository reveal through a server-selected canonical root and fixed no-shell macOS/Linux host adapter.
- Deterministic protocol, server, WebSocket, host-adapter, action-model, and server-rendered component tests.
- A scoped PC-024 issue and implementation plan with acceptance evidence.

### Verified

- Formatting, lint, type checking, 70 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200 on loopback.
- Host-action errors are typed and bounded; browser-supplied reveal paths are rejected by the protocol.

### Known limitations

- Rendered pointer, keyboard, dialog-focus, and accessibility validation remains pending because no browser backend was available.
- Relaunch context is in memory only and does not survive a local-server restart.
- Repository reveal acts on the Pacium host, including during remote Tailscale Serve access.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 656 kB before gzip and still emits the tracked chunk-size warning.

## 0.7.0 — split-pane terminal workspace — 2026-07-27

### Added

- A bounded browser-owned binary layout for up to four nested horizontal or vertical terminal panes.
- Explicit focused-pane state, empty-pane session selection, session move/swap, maximize/restore, and view-only pane closure.
- Pointer and keyboard split creation, pane navigation, and separator resizing.
- Versioned browser-local layout, ratio, focus, and maximize restoration with stale and duplicate session reconciliation.
- Session-keyed terminal handles and reconnect cursors for simultaneous live terminal rendering.
- A multi-subscription WebSocket integration test and server-rendered split-workspace tests.
- A scoped PC-023 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 55 automated tests, and both production bundles pass.
- One WebSocket client receives independent snapshots and binary output from two subscribed PTYs.
- The development UI and direct `/api/health` endpoint returned HTTP 200.

### Known limitations

- Rendered pointer, keyboard, zoom, and accessibility validation remain pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 649 kB before gzip and still emits the tracked chunk-size warning.

## 0.6.0 — host directory picker and tailnet contract — 2026-07-27

### Added

- A token-protected, read-only `GET /api/directories` endpoint with Host, Origin, and bearer-token checks before filesystem access.
- Canonical host-directory resolution with deterministic sorting, bounded results, hidden-folder metadata, and repository markers.
- A compact host working-directory picker with breadcrumbs, Home/default/recent locations, filtering, hidden-folder control, error recovery, and typed-path fallback.
- Versioned, bounded browser-local recent-directory state.
- ADR-0016 defining optional Tailscale Serve as the sole supported remote ingress while Pacium remains loopback-bound.
- A scoped PC-029 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 45 automated tests, and both production bundles pass.
- Resolver, schema, protected HTTP boundary, browser transport, and picker-state behavior have deterministic tests.
- The development UI and direct `/api/health` endpoint returned HTTP 200.

### Known limitations

- Rendered picker interaction and accessibility validation remain pending because no browser backend was available.
- Tailscale Serve setup, identity enforcement, revocation, WebSocket, and public-reachability tests are still PC-077 work; ADR-0016 is a contract, not implementation evidence.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- The web bundle is 635 kB before gzip and still emits the tracked chunk-size warning.

## 0.5.0 — terminal tab workspace — 2026-07-27

### Added

- Browser-owned terminal tabs that open from sidebar selection without duplicating session references.
- Pinning with a stable leading pinned partition.
- Pointer drag-and-drop and `Alt+Shift+Left/Right` keyboard reordering inside pin groups.
- View-only tab closure with deterministic adjacent selection and explicit process-survival messaging.
- Versioned browser-local tab order and pin restoration with stale-session reconciliation.
- Horizontally scrollable overflow and active-tab visibility recovery.
- A scoped PC-022 issue and implementation plan.

### Verified

- Formatting, lint, type checking, 34 automated tests, and both production bundles pass.
- The development UI and direct `/api/health` endpoint returned HTTP 200.
- Tab parsing, opening, deduplication, closing, selection recovery, pinning, ordering, reconciliation, and version handling have deterministic tests.

### Known limitations

- Rendered browser workflow and accessibility validation remain pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- Split panes, richer session actions, and the command palette remain unimplemented.

## 0.4.0 — preset-aware repository sessions — 2026-07-27

### Added

- Fixed server-owned Shell, Codex, and Claude Code launch presets with explicit availability.
- Protocol version 2 fields for preset capabilities, typed creation, command labels, and repository context.
- Canonical ancestor `.git` discovery for repositories and worktrees.
- Repository-grouped sidebar navigation with an other-folders fallback.
- Keyboard commands for creation, numbered selection, previous/next selection, and leaving terminal capture.
- Deterministic tests for preset resolution, repository discovery, grouping, shortcuts, transport security, and session metadata.
- A scoped issue and implementation plan for PC-020, PC-021, PC-025, and PC-026.

### Verified

- Formatting, lint, type checking, 27 automated tests, and both production bundles pass.
- Development and built-server startup served the UI and health endpoint successfully.
- The live server detected all three fixed CLI presets on this machine.

### Known limitations

- Rendered browser workflow and accessibility validation remain pending because no browser backend was available.
- The supported Node.js 24.18.x runtime remains unverified; this machine used Node.js 26.4.0.
- Durable workspaces, user-defined presets, tabs, splits, richer session actions, and the command palette are not implemented.

## 0.3.0 — first local terminal slice — 2026-07-26

### Added

- React/Vite three-panel application shell and reusable xterm terminal surface.
- Loopback HTTP/WebSocket local server with an ephemeral access token and strict Origin validation.
- Direct-PTY session lifecycle for create, list, input, resize, interrupt, exit, reconnect, and close.
- Bounded headless terminal snapshots with session epoch and output sequence tracking.
- Shared Zod protocol contracts and binary terminal-data frames.
- Deterministic fake-PTY utilities plus contract, security, real-PTY, and reconnect integration tests.

### Verified

- Type checking, lint, 17 automated tests, and both production bundles pass in the current checkout.
- The built server starts on `127.0.0.1:4174`, serves the web bundle, and rejects a hostile bootstrap Origin.

### Known limitations

- Browser-driven and accessibility validation is pending because no browser backend was available.
- The current machine ran verification on Node.js 26.4.0; the pinned Node.js 24.18.x runtime remains to be verified.
- Direct PTYs end with the local server; tmux durability is deferred.
- Pacium mode, provider awareness, Git inspection, queue integration, splits, and packaging are not implemented.
- Snapshot serialization depends on xterm headless proposed buffer APIs.

## Blueprint v0.2.0-local-first — 2026-07-26

### Changed

- Reframed Pacium Control as a localhost terminal workspace first and a Pacium Meta/Orchestrator/queue mode second.
- Made direct local PTYs the default runtime and tmux an optional durability adapter.
- Replaced the tailnet, multi-user, multi-host, and separate-broker deployment with one loopback-only local process.
- Replaced the generalized state coordinator with minimal versioned JSON/JSONL application metadata.
- Made the terminal the primary product surface.
- Added a Linear-inspired design direction centered on calm hierarchy, compact density, predictable actions, and keyboard speed.
- Replaced the roadmap, milestones, workstream map, first-30-day sequence, backlog, risk register, and test strategy.
- Added a build-ready first issue and implementation plan for one real PTY-backed browser terminal.
- Rewrote the product, design, architecture, security, workflow, and provider entry points.
- Marked retained remote-control-plane documents as historical or deferred.

### Decisions

- Accepted ADR-0013: local PTYs are the primary runtime.
- Accepted ADR-0014: localhost-only single-user application.
- Accepted ADR-0015: minimal local filesystem state.
- Superseded ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0009, and ADR-0011 where their old architecture conflicts.

### Historical limitation

At this version, the blueprint remained documentation-only. The first executable slice was added in 0.3.0.

## Blueprint v0.1.0

### Added

- Product vision, philosophy, principles, and strategy.
- Documentation-only project status and implementation honesty contract.
- High-level and detailed architecture.
- No-database filesystem state design.
- tmux broker and terminal-control design.
- CLI-only Claude Code and Codex integration strategy.
- Meta, orchestrator, worker, reviewer, question, approval, decision, handoff, and evidence models.
- Tailscale identity and authorization design.
- Git branch and worktree isolation model.
- Multi-host architecture.
- UX information architecture and screen specifications.
- Security threat model and invariants.
- Milestone roadmap, workstream map, implementation backlog, risk register, and release criteria.
- Agent-specific operating contracts.
- GitHub issue and pull-request templates.
- Product, architecture, execution, operations, and incident templates.

### Current limitation

This release contains no application code by design.
