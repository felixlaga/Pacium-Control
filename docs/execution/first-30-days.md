# First 30 days

Calendar estimates may change. Dependency order and evidence gates should not.

## Days 1–3 — Foundation

- Choose and pin supported Node.js and package-manager versions.
- Establish the web, local-server, contracts, terminal-ui, and test-utils packages.
- Add `dev`, `test`, `build`, and `verify`.
- Add CI, formatting, linting, strict typing, and clean-install checks.
- Define session and WebSocket contracts.
- Add deterministic fake PTY and repository fixtures.

Demonstration: the browser connects to the local server, receives capabilities, and renders the application shell.

## Days 4–8 — One real terminal

- Launch a PTY in an explicit working directory.
- Stream bytes over a bounded WebSocket channel.
- Render with xterm.
- Support input, resize, interrupt, exit, and close.
- Validate loopback, Origin, and local token behavior.
- Add PTY integration tests.

Demonstration: use a real interactive shell from the browser.

Stop if process groups, resize, or byte ordering are ambiguous.

## Days 9–12 — Reconnect and terminal quality

- Keep PTYs independent of browser connections.
- Retain bounded headless terminal state.
- Reconnect after refresh.
- Add connection states and errors.
- Exercise Unicode, alternate screen, mouse, paste, large output, and terminal escape safety.

Demonstration: run an interactive full-screen terminal application, refresh, and continue without process loss or duplicate input.

## Days 13–17 — Multi-session workspace

- Add workspace/repository grouping.
- Create, rename, pin, duplicate, relaunch, and close sessions.
- Add tabs and splits.
- Add shell, Claude Code, and Codex presets.
- Add session focus, selection, and unread state.
- Add command palette and keyboard shortcuts.

Demonstration: manage at least three simultaneous sessions without another terminal window.

## Days 18–22 — Agent attention and Git

- Detect process and agent type.
- Add working, waiting, needs-input, finished, failed, and stale states.
- Show source, confidence, and freshness.
- Add quiet notifications.
- Add repository, branch, changed files, diff, commits, and verification output.

Demonstration: identify which agent needs attention and inspect what it changed without reading every terminal.

## Days 23–27 — Pacium mode

- Add General/Pacium toggle.
- Configure and pin Meta and Orchestrator.
- Add explicit target selection.
- Observe configured queue files without modifying them.
- Display questions, approvals, failures, and review items.
- Add compact workers and objective context.

Demonstration: enter Pacium mode and understand both primary sessions and the queue from one screen.

## Days 28–30 — Queue decision loop

- Answer questions and approvals separately.
- Record provenance and deduplication identity.
- Deliver through the configured compatibility mechanism.
- Show delivered, acknowledged, applied, failed, and conflicted states where observable.
- Add browser and restart tests.
- Record pilot findings and limitations.

Day-30 demonstration: Meta or Orchestrator creates a real queue item; the operator answers in Pacium; the answer is delivered once and linked to resulting terminal or Git activity.

## Deferred beyond day 30

- Claude/Codex native activity cards beyond minimum status hooks;
- optional tmux attachment;
- packaged desktop wrapper;
- remote access;
- multi-user and multi-host operation;
- advanced Git mutation and pull requests;
- generalized run/task system.
