# ADR-0006: Use tailnet-only ingress and Tailscale identity

- Status: Superseded by [ADR-0014](ADR-0014-localhost-single-process.md)
- Date: 2026-07-20

## Context

Pacium exposes terminal control, source evidence, and operational decisions. It is intended for a known team using Tailscale. Public internet exposure adds unnecessary risk and authentication complexity.

A user may have several devices and Tailscale IPs, so source IP cannot represent permanent human identity.

## Decision

- Serve the web application through Tailscale Serve.
- Bind the backend to loopback in production.
- Map verified Tailscale user identity to Pacium users.
- Maintain explicit application memberships and roles.
- Do not grant access solely because a user is present in the tailnet.
- Keep broker local/host-private.
- Verify public Hetzner interfaces cannot reach Pacium services.

## Consequences

### Positive

- Small external attack surface.
- Integrated private HTTPS and identity context.
- No need for public signup/password authentication initially.
- Device changes do not break user identity.

### Negative

- Users require tailnet access.
- Tailscale configuration becomes operationally critical.
- Application must validate trusted proxy assumptions.
- Public SaaS expansion would require a separate design.

## Alternatives considered

- Public OAuth application: unnecessary initially.
- IP allowlist: does not model users and is fragile.
- Shared basic-auth password: weak identity and audit.

## Validation

External reachability tests, spoofed-header tests, unknown-tailnet-user denial, revocation, and object-level authorization are release gates.
