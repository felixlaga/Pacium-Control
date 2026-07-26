# Documentation map

This directory specifies the local-first Pacium Control product.

## Canonical product

- [Product definition](product/product-definition.md)
- [Information architecture](product/information-architecture.md)
- [Core workflows](product/core-workflows.md)
- [Non-goals](product/non-goals.md)

## Canonical design

- [Design language](design/design-language.md)
- [Screen specifications](design/screen-specifications.md)
- [Terminal experience](design/terminal-experience.md)
- [Keyboard and command model](design/keyboard-and-command-model.md)
- [Accessibility](design/accessibility.md)

## Canonical architecture

- [Architecture index](architecture/README.md)
- [System overview](architecture/system-overview.md)
- [Local filesystem state](architecture/filesystem-state.md)
- [Local terminal runtime and optional tmux](architecture/broker-and-tmux.md)
- [Provider adapters](architecture/provider-adapters.md)
- [Git inspection](architecture/git-and-worktrees.md)
- [Local identity and transport security](architecture/identity-and-authorization.md)
- [Reliability and recovery](architecture/reliability-and-recovery.md)
- [Observability](architecture/observability.md)
- [Local deployment](architecture/deployment-topology.md)

## Pacium workflow

- [Meta and Orchestrator](workflow/meta-and-orchestrator.md)
- [Questions and approvals](workflow/questions-and-approvals.md)
- [Legacy queue migration](workflow/legacy-queue-migration.md)

## Execution

- [Master plan](execution/master-plan.md)
- [First 30 days](execution/first-30-days.md)
- [Workstream map](execution/workstream-map.md)
- [Implementation backlog](execution/implementation-backlog.md)
- [First build issue](execution/first-build-issue.md)
- [First build plan](execution/first-build-plan.md)
- [Initial toolchain and platform](execution/toolchain-and-platform.md)
- [Milestone 0 — Foundation](execution/milestone-0-foundations.md)
- [Milestone 1 — Terminal workspace](execution/milestone-1-terminal-workspace.md)
- [Milestone 2 — Agent visibility](execution/milestone-2-agent-visibility.md)
- [Milestone 3 — Pacium mode](execution/milestone-3-pacium-mode.md)
- [Milestone 4 — Agent integrations](execution/milestone-4-agent-integrations.md)
- [Milestone 5 — Polish](execution/milestone-5-polish.md)
- [Testing strategy](execution/testing-strategy.md)
- [Definition of done](execution/definition-of-done.md)
- [Risk register](execution/risk-register.md)

## Decisions

See the [ADR index](decisions/README.md). ADR-0013 through ADR-0015 record the local-first reset and supersede the old mandatory-tmux, tailnet/broker, and generalized-state architecture.

## Templates

See [templates](templates/README.md).

## Retained historical and deferred documents

Some research, operations, multi-host, and generalized workflow documents remain for historical context. They are not implementation authority when they conflict with [STATUS.md](../STATUS.md), the root architecture, or accepted ADR-0013 through ADR-0015. Remote access, multi-user operation, multi-host coordination, and the old control-plane deployment require future product approval and new ADRs.
