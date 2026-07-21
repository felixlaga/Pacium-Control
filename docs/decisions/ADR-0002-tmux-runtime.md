# ADR-0002: Keep tmux as the session runtime

- Status: Accepted
- Date: 2026-07-20

## Context

The existing workflow already runs Claude Code and Codex CLI sessions in tmux. tmux survives terminal disconnects, supports multiple observers, exposes control mode, and remains directly operable from a shell.

Replacing it would turn Pacium Control into a process/session runtime before the product has solved the actual user problem.

## Decision

Use tmux as the durable process and terminal-session substrate.

Pacium Control:

- discovers and observes tmux sessions;
- assigns stable Pacium metadata;
- controls tmux through a broker;
- attaches PTYs for browser terminal access;
- launches approved provider profiles inside tmux;
- retains direct shell attach as a fallback.

Pacium does not invent a proprietary terminal runtime.

## Consequences

### Positive

- Existing workflows continue.
- Sessions survive browser/API/broker disconnects.
- Operators retain a trusted low-level escape hatch.
- tmux control mode provides machine-oriented integration.
- Migration risk is lower.

### Negative

- tmux socket access is highly privileged.
- Version behavior must be tested.
- Host reboot still ends sessions.
- Semantic provider state cannot come from tmux alone.
- Terminal input arbitration requires care.

## Alternatives considered

- Custom PTY/session daemon: too much scope and risk.
- Containers per agent as runtime: may be useful later for isolation, but does not replace terminal/session control needs.
- Provider-managed cloud sessions: violates private CLI-first architecture and tool independence.

## Security implication

Treat tmux socket access as full control over the corresponding tmux server. Keep it behind a dedicated broker and, where practical, a dedicated Unix identity/server.

## Validation

Support a defined tmux version matrix, restart broker without killing sessions, and test discovery/input/resize behavior using real tmux.
