# ADR-0004: Use a separate privileged control broker

- Status: Superseded by [ADR-0014](ADR-0014-localhost-single-process.md)
- Date: 2026-07-20

## Context

The web/API needs to request terminal, tmux, Git, and provider operations. Direct tmux socket access gives broad control over sessions, and generic shell execution would make a web compromise catastrophic.

## Decision

Create a separate non-root broker process with:

- access to designated tmux sockets and repository/worktree roots;
- a versioned, typed, allowlisted protocol;
- local Unix-socket transport on the primary host;
- independent validation of targets and paths;
- operation deadlines and IDs;
- audit correlation;
- no generic arbitrary shell endpoint.

The web/API process does not access tmux sockets or provider credentials.

## Consequences

### Positive

- Stronger privilege separation.
- Smaller high-risk code surface.
- Clear place for tmux/PTY/version compatibility.
- Easier security review and least privilege.
- Multi-host evolution through host-local brokers.

### Negative

- Additional process and protocol.
- Need to reconcile broker restarts and unknown outcomes.
- Some operations require careful capability negotiation.
- Unix ownership may be complex around Git and tmux.

## Alternatives considered

- Put everything in one web process: rejected because web vulnerabilities would directly expose sessions.
- Run broker as root: rejected; root should not be required for normal operation.
- Generic SSH command execution: rejected as too broad and difficult to audit safely.

## Validation

Security tests must prove the web user cannot open the tmux socket, escape allowed roots, or invoke unlisted operations. Broker restart must not kill sessions.
