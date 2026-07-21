# Project status

**Current phase:** Blueprint complete; implementation not started.

This document is intentionally blunt. It exists to prevent agents, contributors, and reviewers from mistaking design intent for working software.

## What is present

- A coherent product thesis.
- A defined information architecture and north-star user experience.
- A canonical domain model.
- A no-database filesystem persistence design.
- A tmux control and PTY boundary.
- CLI-only Claude Code and Codex integration plans.
- A Git worktree isolation model.
- A Tailscale identity and authorization model.
- A multi-host direction.
- Security invariants and a threat model.
- An implementation roadmap, workstream dependency map, risk register, and backlog.
- Reusable issue, planning, handoff, review, incident, and release templates.

## What is not present

- No frontend.
- No API.
- No broker.
- No filesystem state engine.
- No tmux integration.
- No Claude Code hooks.
- No Codex App Server integration.
- No authentication implementation.
- No deployment automation.
- No tests.
- No production environment.

Any statement that one of those items “works” is false until code is merged and the corresponding acceptance criteria are demonstrated.

## Frozen decisions

The following are frozen for the first implementation unless the owner approves an ADR that supersedes them:

1. CLI-only provider operation.
2. No application database.
3. tmux remains the process/session substrate.
4. Tailscale is the default network and identity boundary.
5. The backend binds to loopback when served through Tailscale Serve.
6. Raw terminal access is a privileged escape hatch.
7. The generic control plane and Pacium-specific workflow are separate modules.
8. Questions and approvals are different objects with different semantics.
9. Each coding worker receives an isolated branch and worktree.
10. State mutations flow through one authoritative writer.
11. Provider-native events are normalized into a provider-neutral domain model.
12. Existing `FELIX-QUEUE` and `NEEDS-FELIX` files are migration inputs or compatibility views, not the long-term source of truth.

## Open decisions

These should be resolved during Milestone 0 through time-boxed prototypes:

- Exact frontend framework and component primitives.
- Exact API framework and runtime.
- Broker implementation language, if different from the API.
- Whether API-to-browser dashboard updates use SSE, WebSockets, or a hybrid.
- Whether the first Codex integration launches App Server directly or wraps an existing tmux TUI session.
- Exact Claude status and hook payload compatibility for the installed CLI version.
- State retention periods and archive policy.
- Whether a local desktop helper is ever necessary for `pacium://` links.
- The minimum supported versions of tmux, Node, Claude Code, Codex, Git, and Tailscale.

## Next action

Create the first implementation issue from [Milestone 0](docs/execution/milestone-0-foundations.md), establish the monorepo, and merge only after the repository can run one deterministic end-to-end smoke test.
