# ADR-0013: Make local PTYs the primary terminal runtime

- Status: Accepted
- Date: 2026-07-26
- Owner approval: Explicit product direction in the 2026-07-26 planning session
- Supersedes: [ADR-0002](ADR-0002-tmux-runtime.md), [ADR-0009](ADR-0009-terminal-secondary.md)

## Context

The original blueprint treated tmux as the mandatory runtime and the terminal as a secondary escape hatch. The product owner clarified that the primary product is a lightweight, polished terminal workspace for managing local coding agents. Pacium mode is a specialized workflow layered onto that workspace.

A mandatory tmux dependency makes first use heavier and makes the product architecture serve the old remote-control concept instead of the desired local terminal experience.

## Decision

Pacium Control launches and owns local pseudoterminal sessions by default.

- The local server creates PTYs for shells, Claude Code, Codex, and configured commands.
- The browser renders terminal sessions and sends input over a local WebSocket connection.
- Browser refreshes must not terminate PTY processes.
- The local server may retain a headless terminal screen model so reconnecting clients can restore visible state.
- tmux becomes an optional adapter for attaching to or keeping selected sessions alive across local-server restarts.
- The terminal is the primary workspace. Agent-aware views, Git inspection, and Pacium mode enhance it.
- Pacium does not claim it can attach to arbitrary existing Terminal.app, iTerm, or shell panes without an explicit bridge.

## Consequences

### Positive

- Immediate value as a daily terminal and coding-agent workspace.
- Simple `pacium` launch flow.
- No tmux requirement for ordinary sessions.
- Clean alignment with the desired T3-Code-like interaction model.
- tmux durability remains available where it is useful.

### Negative

- Direct PTY sessions end if the local server process exits.
- PTY lifecycle, resize, buffering, process groups, and signal behavior require careful testing.
- Existing external terminals cannot be adopted automatically.
- Optional tmux sessions add a second runtime capability that must be labelled clearly.

## Validation

- Launch ordinary shell, Claude Code, and Codex sessions.
- Exercise input, resize, Unicode, mouse, alternate screen, interrupt, exit, and large output.
- Refresh the browser without losing processes or visible terminal state.
- Verify a local-server restart reports direct PTY sessions as ended rather than pretending they survived.
- Verify optional tmux sessions can reconnect after a local-server restart.

## Rollback

The optional tmux adapter can be made the default through configuration if direct PTY reliability is inadequate. Returning to mandatory tmux would require a new accepted ADR.
