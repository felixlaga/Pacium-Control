# Pacium Control

> **The private operating console for human-directed coding systems.**

Pacium Control is a tailnet-only web application for supervising, steering, reviewing, and recovering teams of coding agents that run as CLI processes inside tmux on one or more hosts.

It is designed around a real operating model:

- a **meta session** translates between the human operator and the system;
- an **orchestrator session** plans and coordinates work;
- Claude Code and Codex workers execute bounded tasks in isolated Git worktrees;
- questions and permission requests are elevated into a first-class Inbox;
- tmux keeps processes alive;
- Git records code history;
- a filesystem event model records coordination state;
- Pacium Control turns all of that into a calm, legible control surface.

The terminal remains available, but it is not the product. The product is understanding what is happening, deciding what should happen next, and intervening safely when necessary.

---

## Repository status

**This repository is intentionally documentation-only. It contains no application code.**

It is the product, architecture, design, security, and execution blueprint from which implementation agents should build Pacium Control. The goal is to eliminate ambiguity before large-scale parallel implementation begins.

| Area | Status |
|---|---|
| Product vision and positioning | Defined |
| Product principles and non-goals | Defined |
| Core UX and screen model | Defined |
| Domain model | Defined |
| Filesystem persistence model | Defined |
| tmux and broker boundary | Defined |
| Claude Code CLI integration | Defined |
| Codex CLI/App Server integration | Defined |
| Identity and authorization model | Defined |
| Multi-host model | Defined |
| Milestones and implementation backlog | Defined |
| Product code | Not started by design |
| Production validation | Not started |

Read [STATUS.md](STATUS.md) before making implementation claims.

See [BLUEPRINT_MANIFEST.md](BLUEPRINT_MANIFEST.md) for the packaged scope and verification record.

---

## North-star experience

Felix opens Pacium Control from any device on the tailnet and immediately sees:

```text
3 items need me
5 agents working across 2 repositories
1 run ready for review
Claude: 72% of current window used
Codex: 43% of current window used
```

He opens a question, reads the context and recommendation, presses `2`, and sees:

```text
Answered by Felix
Acknowledged by Checkout Orchestrator
Implementation resumed
```

He opens the run and sees the plan, live agents, branches, worktrees, recent commands, changed files, tests, decisions, usage, and blockers. He asks the meta session to summarize what changed since his last visit. Every claim links to evidence. The terminal is one keystroke away, but he never needs to open it.

That is the bar.

---

## The product thesis

Most coding-agent interfaces optimize for a single conversation. Pacium Control optimizes for **operating a system of work**.

The core thesis is:

1. Coding agents become far more useful when their work is observable, interruptible, reviewable, and recoverable.
2. Existing CLI agents are already capable; the missing layer is operational clarity.
3. A team does not need another autonomous agent framework. It needs a trusted control plane around the tools it already uses.
4. Human attention is the scarce resource. The product must route only consequential questions and approvals to the right person, with enough context to answer quickly.
5. Durable truth should remain in inspectable systems: tmux, Git, files, and append-only events.

---

## Hard constraints

These decisions are not suggestions. Changing one requires an Architecture Decision Record and explicit owner approval.

- **CLI only.** Claude Code and Codex run as command-line processes. No desktop applications.
- **No application database.** Durable coordination state is stored as JSON entities plus append-only JSONL events on disk.
- **tmux is the runtime substrate.** Pacium observes and controls tmux; it does not replace process supervision with an invented agent runtime.
- **Tailnet-only by default.** The web/API surface is not publicly exposed.
- **Tailscale identity, not IP identity.** Users are authorized by verified identity and application roles.
- **Terminal as escape hatch.** Structured workflows are primary; raw terminal access is secondary and separately permissioned.
- **One worker, one branch, one worktree.** Parallel coding agents never share a mutable checkout.
- **Provider-neutral domain model.** Claude and Codex are adapters to the same run, task, question, approval, event, and review concepts.
- **Evidence over narration.** “Done” means backed by diffs, commits, checks, artifacts, and explicit completion criteria.
- **No shared personal credentials as a product assumption.** Operator identity and provider execution identity are separate concepts.

---

## Start here

Read these documents in order:

1. [Executive brief](docs/00-executive-brief.md)
2. [Vision](VISION.md)
3. [Philosophy](PHILOSOPHY.md)
4. [Product strategy](PRODUCT_STRATEGY.md)
5. [Architecture](ARCHITECTURE.md)
6. [Roadmap](ROADMAP.md)
7. [Agent operating contract](AGENTS.md)
8. [Security](SECURITY.md)
9. [Implementation master plan](docs/execution/master-plan.md)
10. [Implementation backlog](docs/execution/implementation-backlog.md)

For a narrower question, use the [documentation map](docs/README.md).

---

## Repository map

```text
.
├── README.md                    Entry point and canonical summary
├── STATUS.md                    What exists and what does not
├── VISION.md                    Long-term product vision
├── PHILOSOPHY.md                Product and engineering worldview
├── PRINCIPLES.md                Decision tests and invariants
├── PRODUCT_STRATEGY.md          Users, wedge, positioning, metrics
├── ARCHITECTURE.md              System architecture overview
├── ROADMAP.md                   Milestones and release sequence
├── AGENTS.md                    Mandatory instructions for all agents
├── CLAUDE.md                    Claude-specific operating notes
├── CODEX.md                     Codex-specific operating notes
├── SECURITY.md                  Threat model and security invariants
├── CONTRIBUTING.md              Contribution and review process
├── GOVERNANCE.md                Decision rights and change control
├── GLOSSARY.md                  Canonical vocabulary
├── PUBLISHING.md                GitHub setup and repository policy
├── docs/
│   ├── product/                 Product definition and workflows
│   ├── design/                  Interaction and visual design
│   ├── architecture/            Detailed technical design
│   ├── workflow/                Meta/orchestrator/worker protocols
│   ├── execution/               Plans, backlog, risks, quality gates
│   ├── operations/              Deployment and operating playbooks
│   ├── decisions/               Architecture Decision Records
│   ├── research/                Assumptions and open questions
│   └── templates/               Reusable planning and review templates
└── .github/                     Issue and pull-request templates
```

---

## How implementation should begin

Do not start with a beautiful dashboard and fake data. Build the narrowest vertical slice that proves the operating model:

1. Filesystem state coordinator.
2. tmux discovery through a privileged broker.
3. Tailscale-authenticated API.
4. Read-only session list and live terminal.
5. Exclusive terminal control lease.
6. Structured prompt delivery.
7. Question creation and one-click answer.
8. Acknowledgement from orchestrator.
9. Run page with evidence from Git and tmux.

Only after that slice works end to end should the team widen into provider-native events, usage, multi-host support, and advanced review workflows.

---

## What excellence looks like

Pacium Control should feel like software from an exceptional infrastructure and product team:

- fast enough that the UI feels directly attached to the machines;
- visually calm under high activity;
- explicit about uncertainty and degraded data;
- secure by construction rather than by warning text;
- operable without a manual for routine work;
- inspectable and recoverable when something fails;
- opinionated about workflow without becoming an agent framework;
- polished in the small details: names, timestamps, keyboard flow, state transitions, empty states, and error recovery.

The project is not successful when the terminal appears in a browser. It is successful when a human can safely operate more parallel work with less cognitive load and more confidence.
