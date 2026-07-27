# Pacium Control

> A clean local workspace for terminals, coding agents, and the Pacium workflow.

Pacium Control is a localhost web application for people who run several CLI coding agents and terminal sessions at once.

It turns a collection of shells, Claude Code sessions, Codex sessions, repositories, diffs, and attention signals into one calm, keyboard-first workspace. The visual direction is inspired by products such as Linear: strong hierarchy, restrained chrome, high information density, consistent interactions, and fast navigation.

Pacium mode adds a specialized view for the existing Meta, Orchestrator, and queue workflow.

## Repository status

**The first local-terminal vertical slice is implemented, but the product is not release-ready.**

Read [STATUS.md](STATUS.md) before making implementation claims.

## Run the current slice

Prerequisites are Node.js `24.18.x` and pnpm `11.17.0`.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173`. The Vite application connects to the local server on `127.0.0.1:4174`.

To exercise the production bundle:

```bash
pnpm build
pnpm start
```

Then open `http://127.0.0.1:4174`.

The current slice can launch available Shell, Codex, and Claude Code presets; browse host directories through a compact repository-aware picker; group sessions by repository; and arrange up to four live terminals in tabs and nested splits. A contextual command palette searches sessions, workspace commands, split controls, and session actions. A shared session menu supports rename, duplicate, ended-session relaunch, directory copy, host repository reveal, interrupt, view closure, and confirmed termination. Tabs and panes are browser-owned views: closing either does not stop the underlying PTY. Sessions survive browser refresh but not local-server restart.

Session actions are available from the workspace header, each terminal pane, and a session or tab context menu. “Reveal repository” always opens Finder or the Linux file manager on the Pacium host, including when the browser connects through Tailscale Serve.

Current keyboard shortcuts:

- `Cmd/Ctrl+K`: open the contextual command palette.
- `?`: open the searchable shortcut reference when the application owns keyboard focus.
- `Cmd/Ctrl+Shift+T`: open the new-terminal dialog.
- `Cmd/Ctrl+1` through `Cmd/Ctrl+9`: select an open terminal tab.
- `Cmd/Ctrl+Shift+[` and `Cmd/Ctrl+Shift+]`: select the previous or next tab.
- `Alt+Shift+Left/Right`: reorder a focused tab within its pin group.
- `Cmd/Ctrl+\`: split the focused pane to the right.
- `Cmd/Ctrl+Shift+\`: split the focused pane downward.
- `Alt+[` and `Alt+]`: focus the previous or next pane when the terminal is not capturing input.
- `Ctrl+Shift+.`: leave terminal keyboard capture without stopping the PTY.

Application shortcuts pause while a terminal or text input owns the keyboard. Use `Ctrl+Shift+.` to leave terminal capture before opening the palette.

## Primary experience

The planned packaged command:

```bash
pacium
```

will start a local server bound to `127.0.0.1` and open the application. That packaging command is not implemented yet.

The application should let the operator:

- launch a shell or coding agent in any repository;
- organize sessions by workspace and repository;
- move between sessions without hunting through terminal windows;
- use tabs and splits;
- see status and unread activity at a glance;
- inspect changed files and diffs beside the terminal;
- interrupt, restart, duplicate, rename, pin, and close sessions;
- recover the visible terminal after a browser refresh;
- keep selected sessions alive through optional tmux backing.

Pacium manages sessions it launches. It cannot silently adopt an arbitrary existing Terminal.app or iTerm pane. Existing durable sessions can be attached through the optional tmux adapter.

## Pacium mode

Pacium mode is a workspace toggle, not a separate application.

When enabled it adds:

- pinned Meta and Orchestrator sessions;
- explicit prompt targeting;
- questions, approvals, failures, and review requests from the queue;
- answer and acknowledgement state;
- a compact worker list;
- current objective and plan context;
- recent decisions and resulting Git or terminal activity.

The first Pacium implementation observes the existing queue files conservatively. Structured Pacium state can become authoritative only after the compatibility loop is proven.

## Product layout

```text
┌──────────────────────────────────────────────────────────────────┐
│ Workspace / repository                  General ○  Pacium ●      │
├──────────────────┬───────────────────────────────┬───────────────┤
│ Sessions         │ Active terminal               │ Context       │
│                  │                               │               │
│ ● Meta           │ $ codex                       │ Queue         │
│ ● Orchestrator   │                               │ Changed files │
│ ◐ Worker API     │                               │ Diff          │
│ ✓ Worker Docs    │                               │ Checks        │
│                  │                               │ Activity      │
│ + New terminal   │                               │               │
├──────────────────┴───────────────────────────────┴───────────────┤
│ Composer · target · interrupt · split · command palette          │
└──────────────────────────────────────────────────────────────────┘
```

## Architecture

```text
React browser application
        ↕ local HTTP/WebSocket
Node.js local server
        ├── PTY terminal manager
        ├── session registry
        ├── Git inspector
        ├── agent observers
        ├── Pacium queue adapter
        └── minimal filesystem state
                ↕
      shells / Claude Code / Codex
```

The core product is one loopback-bound local process. Tailscale is optional: remote operation uses Tailscale Serve to proxy tailnet-only HTTPS to Pacium on the same host as the managed sessions. There is no separate broker, application database, membership model, or multi-host protocol.

See [ARCHITECTURE.md](ARCHITECTURE.md) and the [accepted ADRs](docs/decisions/README.md).

## Build order

1. Repository foundation and contracts.
2. One real PTY-backed browser terminal.
3. Multiple sessions, grouping, tabs, splits, and keyboard control.
4. Agent attention states and Git inspection.
5. Pacium toggle, Meta, Orchestrator, and queue loop.
6. Claude and Codex native enrichment.
7. Optional tmux attachment, packaging, and release polish.

The canonical execution sequence is [ROADMAP.md](ROADMAP.md). The first implementation is specified in [docs/execution/first-build-plan.md](docs/execution/first-build-plan.md).

## Hard boundaries

- Bind to loopback by default.
- Never expose a shell endpoint to the network accidentally.
- Treat terminal output, titles, links, and escape sequences as untrusted.
- Do not persist provider credentials, environment dumps, or unlimited terminal history.
- Do not introduce a database.
- Do not claim semantic agent state when only process or terminal activity was observed.
- Keep questions and approvals separate.
- Keep public access, team roles, multi-host aggregation, and enterprise workflow out of the initial build.

## Documentation

Start with:

1. [Project status](STATUS.md)
2. [Principles](PRINCIPLES.md)
3. [Architecture](ARCHITECTURE.md)
4. [Security](SECURITY.md)
5. [Roadmap](ROADMAP.md)
6. [Agent contract](AGENTS.md)
7. [Master plan](docs/execution/master-plan.md)
8. [Implementation backlog](docs/execution/implementation-backlog.md)
