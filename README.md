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

The current slice can launch available Shell, Codex, and Claude Code presets; browse host directories through a compact repository-aware picker; group sessions by repository; and arrange up to four live terminals in tabs and nested splits. A contextual command palette searches sessions, workspace commands, split controls, and session actions. Browser-local settings control system/dark/light appearance, workspace density, live terminal typography and scrollback, launch default, and quiet attention notifications. Important failure and completion evidence becomes unread until selected; explicit-permission browser alerts can notify once while Pacium is hidden, and each session can be muted without hiding its in-app state. The session sidebar and inspector can collapse into responsive drawers without changing terminal state, while the status bar always identifies connection, selection, and keyboard ownership. The inspector labels launch classification and attention evidence with source, confidence, and time, and shows refreshable Git-derived repository, branch or detached/unborn HEAD, commit, and main/linked worktree evidence. Its Changes view lazily reads bounded Git status and one freshly revalidated file patch without changing the PTY or exposing generic Git arguments. History reads the newest 50 commits reachable from local HEAD without accepting revisions or contacting a remote. Checks reads an explicit external server-owned preset catalog, displays exact argv, runs with bounded concurrency/time/output, supports cancellation, survives browser refresh, and shows pass/fail/timeout/cancel/error evidence with fresh start/end HEAD observations. Activity combines current attention, direct-PTY lifecycle, changed-file totals, three recent local commits, and the latest check into a seven-fact maximum with explicit observed/occurred labels; it does not parse terminal text or add agent narration. Protocol 17 provides private, versioned, atomic server-owned Pacium workspace and queue decision/delivery/lifecycle state, content-free queue observation/classification/conflicts, exact on-demand item and answer-artifact reads, identity-only explicit delivery/lifecycle requests, and one identity-free read-only Control-context request. A functional browser-owned General/Pacium switch changes navigation emphasis without remounting terminals and preserves selection/layout/session-inspector context. Pacium mode pins Meta and Orchestrator above ordinary sessions, resolves only exact accepted session IDs, opens the real PTY, and can assign an eligible live terminal or launch a fixed preset before binding its exact created session. Its compact composer sends one bounded control-free line only to an explicitly selected exact live role or worker PTY; transport acceptance does not claim provider delivery, processing, approval, or completion. Configured workers now appear once in accepted order with exact process, command classification, repository, attention, and already-loaded selected-session change evidence; preset-only workers remain explicitly not started and no worker is inferred or launched. `Open context` reads only the accepted objective and plan files through bounded stable no-follow regular-file reads and renders their current UTF-8 bytes as inert text. The same inspector shows at most twelve newest immutable decisions with recording, latest transport attempt, and human-labelled lifecycle evidence kept separate. It never claims that a decision caused terminal, Git, provider, or completion activity. A compact Pacium queue observes accepted files with stable bounded reads. Each nonblank stable source becomes at most one deterministic question, explicit approval, failure, review, or unknown item. The content-free list shows source, requesting role, confidence, process-local waiting evidence, and bounded rewrite/degradation/exact-hash duplicate conflicts; opening a row fetches exact current text only for the published workspace/source/revision/hash/item identity and renders it as inert text in the right inspector. Rewrite, degradation, config drift, disconnect, mode exit, and late responses clear inspected text. Conversational permission wording never becomes approval. A current question accepts a bounded answer and optional note; a current approval exposes distinct approve/deny controls with explicit confirmation. The server revalidates exact source identity and type, then stores one hash-verified immutable local decision that survives browser reload and local-server restart. Recording alone does not deliver, acknowledge, apply, execute, or send that decision. A decided item separately previews only its accepted answer-file or live role-PTY target and requires Review/Cancel/Confirm before a durable attempt. Answer files are private and never overwrite an existing target; role prompts are one JSON-escaped comment line, and PTY acceptance does not confirm agent handling. Exact answer-file bytes are reported only as transport-artifact evidence. Acknowledged, applied, unable-to-apply, confirmed-not-delivered, and superseded states require explicit human-labelled Review/Cancel/Confirm and remain separate from provider-native evidence. A failed or unknown first attempt can be retried once only after it is explicitly confirmed not delivered; no automatic or third attempt is possible. Multi-item queue boundaries and provider-native acknowledgement/activity remain later slices. Until provider observers exist, live processes remain “Unknown”; clean and failed exits are process-derived facts, not proof of task completion. A shared session menu supports rename, duplicate, ended-session relaunch, directory copy, host repository reveal, interrupt, view closure, and confirmed termination. Tabs and panes are browser-owned views: closing either does not stop the underlying PTY. Sessions survive browser refresh but not local-server restart.

## Configure verification checks

Verification is off by default. Point Pacium at an absolute versioned JSON file
outside the repositories it configures:

```bash
PACIUM_VERIFICATION_CONFIG=/Users/operator/.config/pacium/verification.json pnpm dev
```

The browser can select only configured preset IDs; it cannot supply command
text, arguments, cwd, environment, timeouts, or signals. Configured executables
still run with your local user authority and are not sandboxed. See the
[verification configuration contract](docs/execution/verification-configuration.md)
for the schema, limits, security boundary, and restart behavior.

## Configure Pacium workspace state

Pacium workspace state is unconfigured by default and a read does not create
files. The server uses this macOS-first data directory:

```text
<canonical home>/Library/Application Support/Pacium Control/pacium.json
```

An operator can select another dedicated absolute directory before startup:

```bash
PACIUM_DATA_DIR=/Users/operator/.local/state/pacium-control pnpm dev
```

The browser protocol can get or completely replace the versioned workspace.
The current UI exposes a role-scoped Meta/Orchestrator binding editor and an
ephemeral prompt target selector for exact live role or worker bindings. It
does not edit workspace identity, repositories, workers, queue sources,
delivery methods, or context sources. Configured objective and plan paths
remain metadata until the operator explicitly opens or refreshes Control
context; the server then reads only those accepted paths with a 32 KiB
per-source ceiling and never writes them. Accepted queue-source paths receive bounded
no-follow stable reads and canonical-parent watches. Bulk messages remain
content-free; opening one current list item requests its exact retained UTF-8
text through the authenticated identity-bound inspector protocol. The browser
keeps at most one decoded item and renders it only as inert text. For a current
question or explicit approval, the inspector can record one bounded immutable
local decision in private `queue-state.json`; recording never changes the queue
source or delivers the result. A decided item can separately deliver once
through its exact accepted answer-file or live role-prompt method after
explicit confirmation. Pacium never executes queue contents, and
classification, inspection, local recording, or compatible delivery grants no
execution authority.
Browser prompts do not use those paths; they send bounded input directly to one
explicitly selected live PTY. See the
[Pacium workspace configuration contract](docs/execution/pacium-workspace-configuration.md)
for the schema, bounds, atomic replacement, security boundary, and recovery.

Session actions are available from the workspace header, each terminal pane, and a session or tab context menu. “Reveal repository” always opens Finder or the Linux file manager on the Pacium host, including when the browser connects through Tailscale Serve.

Current keyboard shortcuts:

- `Cmd/Ctrl+K`: open the contextual command palette.
- `Cmd/Ctrl+,`: open workspace settings.
- `Cmd/Ctrl+B`: show or hide the session sidebar.
- `Cmd/Ctrl+Shift+B`: show or hide the inspector.
- `?`: open the searchable shortcut reference when the application owns keyboard focus.
- `Cmd/Ctrl+Shift+T`: open the new-terminal dialog.
- `Cmd/Ctrl+1` through `Cmd/Ctrl+9`: select an open terminal tab.
- `Cmd/Ctrl+Shift+[` and `Cmd/Ctrl+Shift+]`: select the previous or next tab.
- `Alt+Shift+Left/Right`: reorder a focused tab within its pin group.
- `Cmd/Ctrl+\`: split the focused pane to the right.
- `Cmd/Ctrl+Shift+\`: split the focused pane downward.
- `Alt+[` and `Alt+]`: focus the previous or next pane when the terminal is not capturing input.
- `Ctrl+Shift+.`: leave terminal keyboard capture without stopping the PTY.
- `G` then `P`: switch between General and Pacium presentation while the
  application owns keyboard focus.
- `Cmd/Ctrl+Enter`: send a valid Pacium prompt while its prompt field owns
  focus; plain Enter cannot add terminal input.

Application shortcuts pause while a terminal or text input owns the keyboard. Use `Ctrl+Shift+.` to leave terminal capture before opening the palette. Press `Tab` from the browser chrome to reveal the skip link and move directly to the terminal workspace.

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
- recent decisions with separate transport and human-labelled lifecycle
  evidence; no causal Git or terminal attribution.

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
