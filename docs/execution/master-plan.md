# Implementation master plan

## Objective

Build a polished localhost terminal workspace that makes multiple coding agents easy to launch, organize, supervise, and inspect. Add Pacium mode as the focused Meta/Orchestrator/queue workflow inside that workspace.

## Product sequence

```text
Local app foundation
→ one excellent real terminal
→ multiple terminal management
→ agent attention and Git visibility
→ Pacium mode
→ native provider enrichment
→ optional tmux durability and packaging
```

Each stage must improve the application the operator can use. Infrastructure without a real consumer does not count as a completed slice.

## Stage 0 — Establish the substrate

### Outcomes

- pinned Node.js and package-manager versions;
- React web app and Node local-server packages;
- shared typed WebSocket contracts;
- deterministic fake PTY, process, repository, and queue fixtures;
- one `dev`, `test`, `build`, and `verify` path;
- loopback-only development startup;
- CI and repository hygiene.

### Gate

A clean clone builds and verifies. The browser and server exchange a versioned welcome message. No terminal capability is claimed yet.

## Stage 1 — Prove one real terminal

### Outcomes

- create a PTY in a chosen working directory;
- render through xterm;
- send input and receive output;
- resize;
- send interrupt;
- observe process exit;
- refresh the browser and reconnect without terminating the PTY;
- close safely.

### Gate

The vertical slice passes PTY, WebSocket, and browser tests on the initial supported platform.

## Stage 2 — Become a terminal workspace

### Outcomes

- multiple sessions;
- workspace and repository grouping;
- tabs and splits;
- rename, pin, duplicate, relaunch, and close;
- session presets for shell, Claude Code, and Codex;
- focus-safe keyboard navigation;
- contextual menus and command palette;
- bounded terminal restoration;
- clear connection and process states.

### Gate

The operator can use Pacium instead of juggling ordinary terminal windows for a representative coding session.

## Stage 3 — Make agents observable

### Outcomes

- agent classification;
- process, terminal, hook, and native status sources;
- attention states and unread markers;
- quiet notifications;
- repository, branch, and working-directory context;
- changed files and diff;
- commits and configured verification;
- concise recent-activity summaries.

### Gate

The operator can identify which agent needs attention and inspect its work without reading every terminal.

## Stage 4 — Add Pacium mode

### Outcomes

- workspace toggle;
- pinned Meta and Orchestrator;
- explicit target selector;
- conservative queue watchers;
- separate question and approval cards;
- answer delivery, acknowledgement, conflict, and provenance;
- worker summary;
- objective, plan context, recent decisions, and resulting activity.

### Gate

The existing Pacium workflow can be operated from one screen without silently changing queue truth.

## Stage 5 — Enrich with provider-native events

### Outcomes

- Claude hooks/status;
- Codex native events where supported;
- clean tool, plan, usage, approval, and completion cards;
- capability and version detection;
- fallback to terminal/process state;
- provider diagnostics and relaunch manifests.

### Gate

Native integration improves presentation but its failure cannot break terminal operation or produce false state.

## Stage 6 — Package and harden

### Outcomes

- optional tmux attach/keep-alive;
- leak and soak testing;
- startup recovery;
- bounded diagnostic export;
- accessibility review;
- performance budgets;
- macOS packaging and clean-install verification;
- Linux support according to the platform decision.

## Parallel work

Parallel work is safe only after shared contracts exist.

Useful early parallel work:

- UI shell and design tokens against fixtures;
- PTY lifecycle spike;
- headless terminal restoration spike;
- WebSocket framing and backpressure tests;
- Git fixture and diff viewer;
- Claude/Codex event fixture collection;
- queue-format inventory.

Do not parallelize separate inventions of:

- session state;
- terminal transport;
- attention status vocabulary;
- Pacium queue lifecycle;
- keyboard behavior.

## Product gates

### Gate A — Terminal truth

One real terminal behaves correctly under input, resize, refresh, disconnect, interrupt, and exit.

### Gate B — Daily workspace

Several sessions remain understandable and keyboard-manageable without visual clutter or focus bugs.

### Gate C — Agent attention

Status and notifications reduce checking without overstating inferred state.

### Gate D — Pacium workflow

Meta, Orchestrator, and queue decisions work end to end with provenance and conflict handling.

### Gate E — Sustained use

The app survives long-running sessions, repeated reconnects, large output, and clean installation.

## Delivery contract

Every pull request provides:

- linked issue and plan;
- one coherent user outcome;
- screenshots or recording for UI work;
- exact test commands and results;
- failure and security behavior;
- limitations;
- synchronized documentation.

## Anti-plan

Do not begin with:

- remote access;
- authentication and team roles;
- multi-host coordination;
- a generalized workflow engine;
- a comprehensive event-sourcing platform;
- automatic pull-request orchestration;
- provider quota analytics;
- decorative dashboards;
- custom desktop wrappers;
- mandatory tmux.
