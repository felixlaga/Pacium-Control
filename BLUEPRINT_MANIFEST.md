# Blueprint manifest

- Blueprint version: `0.2.0-local-first`
- Reset accepted: 2026-07-26
- Application code: None
- Product status: Build-ready documentation

## Canonical scope

- localhost terminal workspace;
- direct PTY runtime;
- browser reconnect;
- multi-session organization;
- Linear-inspired UI/UX;
- agent attention and Git inspection;
- Pacium Meta/Orchestrator/queue mode;
- native provider enrichment;
- optional tmux durability;
- minimal filesystem state.

## Superseded scope

The original mandatory-tmux, tailnet-hosted, separate-broker, multi-user control-plane, generalized state engine, and multi-host roadmap is superseded by ADR-0013 through ADR-0015.

Retained historical documents are not implementation authority when they conflict with:

1. accepted ADRs;
2. [STATUS.md](STATUS.md);
3. [ARCHITECTURE.md](ARCHITECTURE.md);
4. [ROADMAP.md](ROADMAP.md);
5. [AGENTS.md](AGENTS.md).

## Build starting points

1. [Status](STATUS.md)
2. [Architecture](ARCHITECTURE.md)
3. [Design language](docs/design/design-language.md)
4. [Roadmap](ROADMAP.md)
5. [Master plan](docs/execution/master-plan.md)
6. [Backlog](docs/execution/implementation-backlog.md)
7. [First build issue](docs/execution/first-build-issue.md)
8. [First build plan](docs/execution/first-build-plan.md)
9. [Initial toolchain and platform](docs/execution/toolchain-and-platform.md)

## Verification required

Before handoff, verify:

- relative Markdown links;
- one top-level heading per Markdown file;
- no stale milestone links;
- no active canonical statement that tmux, Tailscale, broker, remote access, or generalized state are initial requirements;
- no application source, dependencies, local state, terminal captures, credentials, or generated build output.
