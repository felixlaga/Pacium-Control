# Architecture index

The architecture is designed for one team, one primary Hetzner VPS, and a path to several hosts without prematurely becoming a distributed platform.

## Canonical constraints

- CLI-only Claude Code and Codex.
- tmux as the session runtime.
- no application database.
- JSON entities plus append-only JSONL events.
- one authoritative state writer.
- a separate privileged broker.
- Tailscale identity and tailnet-only ingress.
- one branch and worktree per coding worker.
- provider-neutral core with rich adapters.
- terminal as a secondary escape hatch.

## Documents

- [System overview](system-overview.md)
- [Domain model](domain-model.md)
- [Filesystem state](filesystem-state.md)
- [Broker and tmux](broker-and-tmux.md)
- [Provider adapters](provider-adapters.md)
- [Git and worktrees](git-and-worktrees.md)
- [Events and audit](events-and-audit.md)
- [Identity and authorization](identity-and-authorization.md)
- [Multi-host model](multi-host.md)
- [Reliability and recovery](reliability-and-recovery.md)
- [Observability](observability.md)
- [Deployment topology](deployment-topology.md)

## Review rule

A change that alters a trust boundary, persistence contract, provider protocol, or system of record requires an ADR and updates to this index where relevant.
