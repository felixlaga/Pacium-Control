# Architecture Decision Records

ADRs record durable decisions and their consequences. They are not implementation status.

| ADR | Decision | Status |
|---|---|---|
| [0001](ADR-0001-filesystem-not-database.md) | Filesystem state, no application database | Accepted |
| [0002](ADR-0002-tmux-runtime.md) | tmux remains the session runtime | Accepted |
| [0003](ADR-0003-cli-only-providers.md) | Claude Code and Codex are CLI-only | Accepted |
| [0004](ADR-0004-privileged-broker.md) | Separate privileged broker boundary | Accepted |
| [0005](ADR-0005-one-worktree-per-worker.md) | One branch and worktree per coding worker | Accepted |
| [0006](ADR-0006-tailnet-only.md) | Tailnet-only default ingress and Tailscale identity | Accepted |
| [0007](ADR-0007-generic-core-pacium-module.md) | Generic control core plus Pacium workflow module | Accepted |
| [0008](ADR-0008-events-and-current-state.md) | Separate current entities from append-only events | Accepted |
| [0009](ADR-0009-terminal-secondary.md) | Terminal is a secondary escape hatch | Accepted |
| [0010](ADR-0010-provider-neutral-core.md) | Provider-neutral core with rich adapters | Accepted |
| [0011](ADR-0011-single-authoritative-writer.md) | One authoritative central state writer | Accepted |
| [0012](ADR-0012-questions-not-approvals.md) | Questions and approvals are separate objects | Accepted |

## Status meanings

- **Proposed** — under review.
- **Accepted** — canonical decision.
- **Rejected** — considered and not chosen.
- **Superseded** — replaced by a later ADR.
- **Deprecated** — retained for history but no longer recommended.

Use [the ADR template](../templates/architecture-decision.md) for new decisions.
