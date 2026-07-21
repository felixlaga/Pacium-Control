# Blueprint manifest

- Blueprint version: `0.1.0`
- Prepared: 2026-07-20
- Scope: Product, design, architecture, security, execution, operations, and agent-working documentation
- Application code: None by design
- Application database: None by design

## Contents

The blueprint includes:

- root product and engineering constitution;
- detailed product and design specifications;
- detailed architecture for filesystem state, tmux, broker, providers, Git, identity, multi-host, reliability, observability, and deployment;
- workflow contracts for meta, orchestrator, workers, reviewers, questions, approvals, decisions, handoffs, and usage;
- accepted Architecture Decision Records;
- milestone plans and a dependency-ordered implementation backlog;
- continuous-agent execution and first-30-day plans;
- production, backup, restore, incident, release, and operator playbooks;
- reusable issue, implementation, ADR, run, question, approval, handoff, review, incident, release, and research templates;
- GitHub issue and pull-request templates.

## Verification performed

- Every Markdown file has one top-level heading.
- Every relative Markdown link resolves inside the repository.
- Git whitespace validation passes.
- No application source code, build output, dependency cache, runtime state, backup, or credential file is included.
- No build-environment-specific path or sandbox reference is included.

## Canonical starting points

1. [README](README.md)
2. [Status](STATUS.md)
3. [Vision](VISION.md)
4. [Architecture](ARCHITECTURE.md)
5. [Roadmap](ROADMAP.md)
6. [Agent operating contract](AGENTS.md)
7. [Implementation backlog](docs/execution/implementation-backlog.md)
8. [First 30 days](docs/execution/first-30-days.md)
