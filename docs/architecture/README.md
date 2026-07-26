# Architecture index

Pacium Control begins as one localhost Node.js process and a React browser application.

## Invariants

- local PTYs are the default runtime;
- browser lifecycle does not own PTY lifecycle;
- tmux is optional;
- server binds to loopback;
- remote and multi-user operation are unsupported;
- terminal bytes and application events use separate bounded channels;
- minimal JSON/JSONL state contains no provider credentials;
- Git and provider runtimes remain systems of record;
- status source and confidence are explicit.

## Documents

- [System overview](system-overview.md)
- [Minimal local state](filesystem-state.md)
- [Local terminal runtime and optional tmux](broker-and-tmux.md)
- [Provider adapters](provider-adapters.md)
- [Git inspection](git-and-worktrees.md)
- [Local identity and transport security](identity-and-authorization.md)
- [Reliability and recovery](reliability-and-recovery.md)
- [Observability](observability.md)
- [Local deployment](deployment-topology.md)
- [Deferred multi-host direction](multi-host.md)

The prior remote broker and tailnet architecture is superseded by ADR-0013 through ADR-0015.
