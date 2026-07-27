# Roadmap

The roadmap is ordered around daily user value. Every milestone must leave a real, demonstrable application rather than an isolated infrastructure layer.

## Milestone 0 — Local application foundation

**Goal:** establish a clean monorepo, shared contracts, deterministic test harness, and one-command local startup.

Deliverables:

- pinned toolchain and package manager;
- React web application and Node local-server boundaries;
- shared transport contracts;
- formatting, linting, strict typing, tests, build, and verification commands;
- fake PTY and repository fixtures;
- loopback and local-token configuration;
- CI and generated-artifact policy.

Exit criteria:

- a clean clone installs and verifies;
- `pacium` development startup opens the local app;
- package boundaries match [ARCHITECTURE.md](ARCHITECTURE.md);
- no application database or machine-specific path is introduced.

See [Milestone 0](docs/execution/milestone-0-foundations.md).

## Milestone 1 — Terminal workspace

**Goal:** make Pacium useful as a polished local terminal manager.

Deliverables:

- real PTY launch and lifecycle;
- xterm-based browser terminal;
- input, resize, interrupt, exit, and close;
- multiple sessions grouped by workspace and repository;
- tabs, splits, rename, pin, duplicate, and relaunch;
- browser reconnect with bounded screen restoration;
- keyboard navigation and contextual command palette;
- clear process and connection states.

Exit criteria:

- shell, Claude Code, and Codex can run simultaneously;
- browser refresh does not terminate them;
- terminal behavior passes PTY integration tests;
- the operator can manage routine sessions without another terminal manager.

See [Milestone 1](docs/execution/milestone-1-terminal-workspace.md).

## Milestone 2 — Agent visibility and work inspection

**Goal:** make several coding agents easy to supervise without reading every terminal.

Deliverables:

- agent and command detection;
- working, waiting, needs-input, finished, failed, and stale attention states;
- source, confidence, freshness, and unread indicators;
- repository, branch, and working-directory context;
- changed files, diff, commits, and configured verification;
- relevant notifications and activity summaries.

Exit criteria:

- the operator can find which session needs attention in seconds;
- Git evidence is derived from the repository;
- inferred agent states are never presented as native confirmation;
- notifications remain quiet when no decision is needed.

See [Milestone 2](docs/execution/milestone-2-agent-visibility.md).

## Milestone 3 — Pacium mode

**Goal:** operate Meta, Orchestrator, workers, and the queue from the same terminal workspace.

Deliverables:

- General/Pacium toggle;
- pinned Meta and Orchestrator sessions;
- explicit prompt target selection;
- conservative queue-file observation;
- separate question and approval presentation;
- answer delivery, acknowledgement, conflict, and provenance;
- worker summary, current objective, recent decisions, and resulting activity.

Exit criteria:

- the existing Pacium workflow can be operated from one screen;
- source files remain safe during import and conflict;
- answers cannot be duplicated by refresh or file rewrite;
- an ordinary answer cannot authorize an approval.

See [Milestone 3](docs/execution/milestone-3-pacium-mode.md).

## Milestone 4 — Native agent enrichment

**Goal:** make the workspace cleaner and more informative using supported Claude and Codex runtime events.

Deliverables:

- Claude hook and status integration;
- Codex native event integration where supported;
- tool, plan, usage, approval, and completion cards;
- capability and version detection;
- explicit degradation to terminal/process inference;
- relaunch manifests and provider diagnostics.

Exit criteria:

- provider-native loss never breaks terminal operation;
- unsupported versions fail clearly;
- the UI preserves provider-specific semantics;
- clean activity views link back to raw terminal and Git evidence.

See [Milestone 4](docs/execution/milestone-4-agent-integrations.md).

## Milestone 5 — Durability, packaging, and polish

**Goal:** make Pacium comfortable for sustained personal use.

Deliverables:

- optional tmux attachment and keep-alive mode;
- optional Tailscale Serve access with verified operator identity;
- startup recovery and honest ended-session handling;
- bounded diagnostic export;
- macOS packaging first, with Linux according to the supported-platform decision;
- performance budgets and soak tests;
- accessibility and interaction polish;
- release verification.

Exit criteria:

- repeated daily use does not leak processes or unbounded memory;
- a packaged clean install reproduces the core workflow;
- optional tmux sessions reconnect after server restart;
- allowed tailnet devices can reach Pacium without exposing its server beyond loopback;
- all limitations are documented.

See [Milestone 5](docs/execution/milestone-5-polish.md).

## Explicitly deferred

- multi-user memberships and roles;
- multi-host control;
- public hosting;
- application database;
- generalized run/task/workflow platform;
- provider marketplace;
- automatic Git integration and pull-request orchestration;
- organization-wide audit, backup, and incident systems.
