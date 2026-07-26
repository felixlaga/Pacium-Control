# Agent operating contract

This file is mandatory reading for every implementation agent working in this repository.

## Current truth

This repository contains the first executable local-terminal slice. It is not a finished product or release artifact.

Read [STATUS.md](STATUS.md) before making implementation claims.

## Mission

Build Pacium Control into a lightweight localhost workspace for managing terminal sessions and CLI coding agents.

The primary goal is to make many local terminals and agents easy to launch, organize, supervise, and inspect through a clean, Linear-inspired interface.

The secondary goal is Pacium mode: a specialized workspace for Meta, Orchestrator, workers, and the existing queue.

## Required read order

Before implementation, read:

1. [STATUS.md](STATUS.md)
2. [README.md](README.md)
3. [PRINCIPLES.md](PRINCIPLES.md)
4. [ARCHITECTURE.md](ARCHITECTURE.md)
5. [SECURITY.md](SECURITY.md)
6. [ROADMAP.md](ROADMAP.md)
7. The relevant specification under `docs/`
8. The applicable accepted ADRs
9. The issue and implementation plan

Do not infer architecture from filenames. Several retained documents describe superseded decisions and are labelled accordingly.

## Non-negotiable constraints

1. **Localhost first.** Bind to `127.0.0.1`; remote access is out of initial scope.
2. **Terminal first.** A polished terminal workspace is the primary product experience.
3. **Direct PTY default.** Pacium launches and owns local PTYs; tmux is optional.
4. **Browser lifecycle is not process lifecycle.** Refreshing or closing the browser must not terminate running PTYs.
5. **CLI providers.** Integrate Claude Code and Codex through CLI/runtime interfaces, not desktop applications.
6. **No application database.** Use minimal versioned JSON/JSONL state.
7. **Minimal duplication.** PTYs own live process truth; Git owns code truth; providers own native events; queue files own legacy queue input.
8. **Honest status.** Native, hooked, process-observed, terminal-inferred, and human-labelled states are distinct.
9. **Safe browser-to-shell boundary.** Validate Origin, local tokens, paths, message sizes, and terminal content.
10. **Pacium is a mode.** Do not build a parallel enterprise application shell.
11. **Meta and Orchestrator first.** Do not generalize Pacium mode before its two-session and queue workflow works.
12. **Questions and approvals are distinct.** An answer is not permission.
13. **Evidence-backed completion.** Prose is not proof.
14. **Linear-inspired discipline.** Calm hierarchy, compact density, predictable actions, keyboard speed, and restrained color.
15. **One worktree per coding worker.** Concurrent writers never share a mutable checkout.

A change to these constraints requires an ADR and explicit owner approval.

## Product scope

### General workspace

- local terminal creation and management;
- workspaces and repository grouping;
- tabs and splits;
- session status and attention indicators;
- Git changes, diffs, commits, and verification;
- optional provider-aware activity;
- command palette and keyboard navigation.

### Pacium mode

- pinned Meta and Orchestrator;
- explicit target selection;
- queue observation and decisions;
- compact worker status;
- objective, plan context, decisions, and resulting evidence.

### Deferred

- remote access and Tailscale;
- multi-user authorization;
- multi-host control;
- public deployment;
- full runs/tasks/workflow engine;
- broad provider marketplace;
- automated PR and integration platform;
- organization-grade audit and backup systems.

## Start from an issue

Every implementation change needs:

- problem and user outcome;
- scope and non-scope;
- acceptance criteria;
- failure and security behavior;
- test plan;
- dependencies;
- exact evidence required.

Use [docs/templates/issue.md](docs/templates/issue.md).

## Write an implementation plan

Before nontrivial code, use [docs/templates/implementation-plan.md](docs/templates/implementation-plan.md).

Plans must cover:

- UI behavior and states;
- modules and contracts;
- PTY/process lifecycle;
- reconnect and failure behavior;
- security boundary;
- tests;
- documentation changes.

## Build vertical slices

Preferred first slice:

```text
Open app → create terminal → launch PTY → render output
→ send input → resize → refresh browser → reconnect → close safely
```

Avoid building a generalized state engine, workflow platform, or provider abstraction without a real UI consumer.

## Terminal rules

- PTY sessions launched by Pacium have immutable IDs.
- Track process groups and distinguish interrupt from terminate.
- Input and resize messages are ordered and bounded.
- Reconnect never replays terminal input automatically.
- Scrollback is bounded and ephemeral by default.
- Terminal titles, hyperlinks, OSC sequences, clipboard operations, and output are untrusted.
- Application shortcuts are suspended while terminal input owns focus, except for a documented escape chord.
- An ended direct PTY is reported honestly after local-server restart.
- Optional tmux attachment is capability-labelled and never silently assumed.

## State rules

- Persist only application-owned metadata.
- Use versioned schemas.
- Validate before write.
- Use temporary files and atomic replacement.
- Keep caches disposable.
- Do not store provider tokens, passwords, complete environments, or unlimited transcripts.
- Queue provenance and decisions must survive restart without duplicate delivery.

## Design rules

- Main work receives the strongest visual contrast.
- Navigation and inactive chrome recede.
- Use one compact spacing and typography system.
- Pair color with text or icon.
- Put frequent actions in buttons, contextual menus, shortcuts, and the command palette consistently.
- Preserve focus and selection across terminal and inspector changes.
- Errors state what happened, which processes survived, and what the user can do.
- Empty states teach the next useful action.
- Do not mimic Linear branding; borrow its hierarchy, density, consistency, and speed.

## Security rules

- Validate loopback binding at startup.
- Reject untrusted HTTP and WebSocket origins.
- Require a local token for terminal and mutating connections.
- Self-host terminal assets.
- Canonicalize configured paths.
- Treat repository and queue content as untrusted data.
- Never execute commands parsed from queue text.
- Avoid logging terminal bytes and environment contents.
- Remote access requires a new ADR and security review.

## Testing expectations

Behavior changes need the lowest useful test plus a boundary test.

Required categories as applicable:

- unit tests for reducers, status logic, paths, and contracts;
- PTY integration tests for input, resize, process exit, signals, alternate screen, and Unicode;
- WebSocket contract tests for ordering, bounds, reconnect, and errors;
- browser tests for terminal creation, switching, splits, focus, refresh, and keyboard navigation;
- Git fixture tests;
- queue deduplication and conflict tests;
- security tests for loopback, Origin, tokens, terminal injection, and paths;
- clean-install and production-build tests.

See [docs/execution/testing-strategy.md](docs/execution/testing-strategy.md).

## Definition of done

A task is done only when:

- acceptance criteria are met;
- tests pass;
- failure and reconnect behavior are exercised;
- security implications are addressed;
- UI states and keyboard behavior are complete;
- docs are synchronized;
- limitations are recorded;
- a reviewer can reproduce the evidence;
- no secrets, runtime state, caches, or unrelated artifacts are committed.

## Git and worktree rules

- Every coding worker receives one branch and one worktree.
- Record the base commit at assignment.
- Do not modify another worker’s worktree.
- Preserve commits and evidence before cleanup.
- Integration is a separate owned task.

## Communication protocol

Use [docs/templates/agent-handoff.md](docs/templates/agent-handoff.md) for handoffs. Include objective, branch, worktree, base commit, files changed, exact tests and results, unresolved issues, assumptions, and next action.

## Prohibited behavior

- Do not claim unimplemented behavior works.
- Do not reintroduce the superseded remote control-plane plan without approval.
- Do not make tmux mandatory.
- Do not bind to all interfaces.
- Do not add a database.
- Do not add generic remote shell or command endpoints.
- Do not persist secrets or full terminal transcripts.
- Do not parse terminal output as authoritative provider state.
- Do not execute queue contents.
- Do not build decorative dashboards before the terminal workflow works.
- Do not hardcode machine-specific paths or credentials.

## When uncertain

Prefer the choice that makes the local terminal experience:

1. simpler;
2. safer;
3. faster;
4. more inspectable;
5. easier to recover;
6. more honest about status.
