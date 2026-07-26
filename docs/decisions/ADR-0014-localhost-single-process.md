# ADR-0014: Start as a localhost-only single-user application

- Status: Accepted
- Date: 2026-07-26
- Owner approval: Explicit product direction in the 2026-07-26 planning session
- Supersedes: [ADR-0004](ADR-0004-privileged-broker.md), [ADR-0006](ADR-0006-tailnet-only.md)

## Context

The original blueprint targeted a tailnet-hosted, multi-user control plane with a separate privileged broker. The intended first product is instead a lightweight application used by one operator on the same machine as the terminals and coding agents.

The old deployment and identity design adds services, authorization concepts, and operational work that do not improve the first local experience.

## Decision

- `pacium` starts one local Node.js application containing the HTTP server, WebSocket server, terminal manager, session registry, Git inspector, agent observers, and Pacium-mode services.
- The server binds to `127.0.0.1` by default.
- It never binds to all interfaces without an explicit future design and accepted ADR.
- A local access token, strict Origin checks, and bounded WebSocket messages protect the local shell surface from unrelated browser pages and accidental exposure.
- There is no separate broker in the initial architecture.
- There are no memberships, roles, tailnet identity mapping, or multi-host protocols in the initial architecture.
- Tailscale or another remote-access mechanism may be reconsidered later as a separate product milestone.

## Consequences

### Positive

- One command and one process for local use.
- Far smaller implementation and operational surface.
- Faster development of terminal UX and agent visibility.
- No false appearance of team or production readiness.

### Negative

- The local process has the same authority as the user who launches it.
- A server compromise can control Pacium-managed PTYs and inspect configured repositories.
- Remote and multi-user use is unsupported.
- Moving beyond localhost will require a new privilege and identity architecture.

## Security requirements

- Loopback binding is validated at startup.
- Cross-origin WebSocket and HTTP mutation requests are rejected.
- Terminal-rendering assets are self-hosted.
- Browser terminal output is treated as untrusted.
- Launch commands come from typed presets or deliberate local user input; no remote caller exists.
- Logs avoid terminal contents and environment dumps by default.

## Validation

- Confirm the server is unreachable through non-loopback interfaces.
- Test malicious Origin, token handling, oversized frames, terminal escape sequences, and unsafe links.
- Confirm browser refresh and additional local tabs do not duplicate PTY input.

## Rollback

A separate broker can be introduced if the application later gains remote or multi-user access. That change requires a new trust-boundary ADR.
