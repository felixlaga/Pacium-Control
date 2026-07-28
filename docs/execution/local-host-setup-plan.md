# Implementation plan: Local host setup

- Issue: [PC-080](local-host-setup-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `dev`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `9072034d810ab49fdec14772b92c0ae904f321bc`
- Target milestone: Owner-directed post-roadmap usability slice
- Status: Implemented; rendered and real-host canaries pending

## Objective

Replace PC-079's deployment commands with one local-only identity-based setup
dialog while preserving loopback binding and fixed Tailscale/tmux authority.

## Existing behavior

Startup environment supplies the tmux socket/session and Tailscale origin/login.
Tmux attachment and request enforcement are strict, but Pacium cannot discover
the default socket, persist setup, or apply Serve.

## Proposed behavior

A protected local setup read discovers the default tmux target and signed-in
Tailscale identity. Apply accepts one published session ID, refuses unknown
Serve state, runs one fixed command, writes private state, updates the live
request boundary, and attaches Meta. Consent returns only a verified URL.

## Architecture and boundaries

### Modules touched

- Shared setup schemas, startup precedence/default tmux discovery, setup
  service/store, local HTTP routes, transport, preferences UI, tests, docs.

### Data/state changes

- Entity/schema: private `host-setup.json`, version 1.
- Commands/events: protected HTTP inspect/apply only.
- Idempotency: matching configured setup avoids mutation.
- Migration: environment stays higher priority; absent file is unchanged.

### Protocol changes

- WebSocket stays 25. Strict HTTP schemas publish only capability, choices,
  bounded recovery, derived identity/Origin, and consent URL.

### Authorization and privilege

- Exact local authority plus token; published session ID only; server-owned
  executable/argv; no sudo, shell, SSH, Funnel, grants, install, or login.

## Sequence

1. Accept ADR-0018 and PC-080 issue/plan.
2. Add schemas and private atomic state.
3. Add default tmux and Tailscale inspection.
4. Add guarded Serve apply and live activation.
5. Add local-only HTTP routes and transport.
6. Add compact settings workflow.
7. Synchronize tests/docs and verify.

## Failure model

| Failure point         | Expected state           | Recovery                   |
| --------------------- | ------------------------ | -------------------------- |
| tmux missing          | Setup unavailable        | Start the intended session |
| Tailscale unavailable | No mutation              | Restore Tailscale          |
| consent required      | Verified approval action | Approve and retry          |
| existing Serve state  | Refuse without mutation  | Review it deliberately     |
| Serve failure         | No setup saved           | Repair and retry           |
| state write failure   | Fixed rollback           | Repair storage and retry   |
| rollback unknown      | Explicit unknown result  | Inspect Tailscale          |
| target drift          | No claimed Meta          | Refresh choices            |

## Compatibility

- Existing platform/runtime contract and contemporary Tailscale Serve CLI.
- Environment configuration remains available and has priority.
- Rollback removes setup state and disables the exact mapping.

## Test plan

- Unit: schemas, projection, URL, commands, storage, precedence.
- Fault: hostile fields, output bounds, drift, timeout, rollback.
- Integration: fake executable, real isolated tmux, HTTP authorization.
- Browser: pointer/keyboard consent/ready/error and Meta focus.
- Security: remote denial, fixed argv, no output leakage.
- Performance: on-demand only; no polling.

## Documentation changes

- Make buttons the primary setup path; retain commands only for recovery.

## Rollout

- Development: fake Tailscale/tmux.
- Integration: isolated real tmux.
- Canary: local setup on `felix-harness`, then tailnet browser.
- Production: no release claim.

## Open questions

- None.

## Approval

- Product: explicitly requested by Felix.
- Architecture: ADR-0018 accepted in this request.
- Security: bounded local-only selection and fixed mutation.
