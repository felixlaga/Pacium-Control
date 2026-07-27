# Architecture Decision Records

ADRs record durable decisions and their consequences. They are not implementation status.

| ADR                                             | Decision                                            | Status                 |
| ----------------------------------------------- | --------------------------------------------------- | ---------------------- |
| [0001](ADR-0001-filesystem-not-database.md)     | Filesystem state, no application database           | Accepted               |
| [0002](ADR-0002-tmux-runtime.md)                | tmux remains the session runtime                    | Superseded by ADR-0013 |
| [0003](ADR-0003-cli-only-providers.md)          | Claude Code and Codex are CLI-only                  | Accepted               |
| [0004](ADR-0004-privileged-broker.md)           | Separate privileged broker boundary                 | Superseded by ADR-0014 |
| [0005](ADR-0005-one-worktree-per-worker.md)     | One branch and worktree per coding worker           | Accepted               |
| [0006](ADR-0006-tailnet-only.md)                | Tailnet-only default ingress and Tailscale identity | Superseded by ADR-0014 |
| [0007](ADR-0007-generic-core-pacium-module.md)  | Generic control core plus Pacium workflow module    | Accepted               |
| [0008](ADR-0008-events-and-current-state.md)    | Separate current entities from append-only events   | Superseded by ADR-0015 |
| [0009](ADR-0009-terminal-secondary.md)          | Terminal is a secondary escape hatch                | Superseded by ADR-0013 |
| [0010](ADR-0010-provider-neutral-core.md)       | Provider-neutral core with rich adapters            | Accepted               |
| [0011](ADR-0011-single-authoritative-writer.md) | One authoritative central state writer              | Superseded by ADR-0015 |
| [0012](ADR-0012-questions-not-approvals.md)     | Questions and approvals are separate objects        | Accepted               |
| [0013](ADR-0013-local-pty-runtime.md)           | Local PTYs are the primary terminal runtime         | Accepted               |
| [0014](ADR-0014-localhost-single-process.md)    | Localhost-only single-user application              | Accepted               |
| [0015](ADR-0015-minimal-local-state.md)         | Minimal local filesystem state                      | Accepted               |
| [0016](ADR-0016-tailscale-serve-access.md)      | Optional Tailscale Serve access to loopback Pacium  | Accepted               |

## Status meanings

- **Proposed** — under review.
- **Accepted** — canonical decision.
- **Rejected** — considered and not chosen.
- **Superseded** — replaced by a later ADR.
- **Deprecated** — retained for history but no longer recommended.

Use [the ADR template](../templates/architecture-decision.md) for new decisions.
