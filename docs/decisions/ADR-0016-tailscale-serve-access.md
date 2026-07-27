# ADR-0016: Add optional Tailscale Serve access without widening the Pacium server bind

- Status: Accepted
- Date: 2026-07-27
- Owner approval: Explicit product direction in the 2026-07-27 implementation session
- Amends: [ADR-0014](ADR-0014-localhost-single-process.md)

## Context

Pacium Control remains a personal terminal and agent workspace, but the Meta and Orchestrator sessions are reachable only through Tailscale in the owner's real workflow. A strict localhost-only product cannot operate that workflow remotely.

Binding the Pacium server directly to a tailnet or LAN address would widen the shell-control attack surface and require Pacium to terminate remote TLS itself. Reintroducing the original multi-user control-plane, membership, and broker architecture would add substantial complexity that the product does not need.

Tailscale Serve can proxy a tailnet-only HTTPS endpoint to a service listening on localhost. Serve removes spoofed incoming Tailscale identity headers before adding verified identity context to proxied requests. Tailscale access-control grants still govern which tailnet identities can reach the endpoint.

## Decision

Pacium gains an optional remote-access mode with these boundaries:

- The Pacium HTTP/WebSocket server continues to bind only to `127.0.0.1`.
- Tailscale Serve is the only supported initial remote ingress.
- Tailscale Funnel and public exposure are prohibited.
- Pacium runs on the same host as the PTYs, Meta, Orchestrator, queue files, and optional tmux sessions it controls.
- The operator configures one exact HTTPS tailnet origin and an explicit allowlist of Tailscale user logins.
- Remote bootstrap and WebSocket upgrades require trusted Tailscale Serve identity headers plus the existing ephemeral Pacium token.
- Direct localhost use continues to use the existing local Origin and token flow without requiring Tailscale.
- Tailnet IP addresses are never treated as permanent human identity.
- Tagged devices do not receive interactive terminal control through user identity headers.
- Tailscale grants provide the network allowlist; Pacium's identity allowlist provides a second application-boundary check.
- Remote mode exposes the same single-operator workspace. It does not add teams, roles, shared input ownership, or cross-host aggregation.
- The application surfaces whether the current connection is local or Tailscale-proxied and which verified identity is active.

## Consequences

### Positive

- Meta and Orchestrator can be supervised from another tailnet device.
- Pacium keeps its loopback-only server and simple single-process architecture.
- HTTPS, device connectivity, and tailnet reachability remain Tailscale responsibilities.
- Public internet authentication and account management remain unnecessary.

### Negative

- Tailscale installation, HTTPS enablement, Serve configuration, and grants become release dependencies for remote mode.
- A trusted local process on the Pacium host can still reach the loopback service with the invoking user's authority.
- Identity-header assumptions require explicit tests and must not be generalized to arbitrary reverse proxies.
- The initial mode does not combine sessions from several Pacium hosts into one UI.

## Security requirements

- Reject remote Origins unless they exactly match the configured HTTPS tailnet origin.
- Trust Serve identity headers only on requests received through the configured remote mode while the backend remains loopback-bound.
- Require a non-empty exact-login allowlist before remote mode starts.
- Reject missing, malformed, tagged-device-only, or unlisted identity.
- Strip identity values from logs except for bounded operator-facing diagnostics.
- Keep the access token ephemeral and out of URLs, logs, and durable storage.
- Test spoofed headers on untrusted Origin and Host combinations.
- Provide a documented `tailscale serve` disable command and fail closed if remote configuration is incomplete.

## Validation

- Local browser access continues to work with Tailscale disabled.
- `tailscale serve` proxies HTTPS and WebSockets to the loopback Pacium port.
- An allowed Tailscale user can bootstrap, connect, and operate a canary terminal.
- Missing or unlisted identity is denied.
- A hostile Origin and direct tailnet or LAN request cannot obtain a token or upgrade a WebSocket.
- Tailscale grants deny an unauthorized user before the application.
- Funnel is disabled and public reachability checks fail closed.
- Revoking the user or Serve configuration removes access without restarting PTYs.

## Rollback

Disable Tailscale Serve and remove the remote-mode configuration. Pacium immediately returns to local-only access without migrating session or application state.
