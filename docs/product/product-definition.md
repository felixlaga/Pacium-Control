# Product definition

## Definition

Pacium Control is a localhost terminal workspace for managing CLI coding agents and ordinary shells.

It brings terminal sessions, attention states, repositories, changed files, diffs, and the Pacium Meta/Orchestrator/queue workflow into one clean, fast interface.

## Product hierarchy

### Primary product: terminal workspace

- launch and manage local PTY sessions;
- organize sessions by workspace and repository;
- switch, split, rename, pin, interrupt, relaunch, and close;
- understand which coding agents need attention;
- inspect Git work beside the terminal;
- preserve running sessions across browser refresh.

### Secondary product: Pacium mode

- pin Meta and Orchestrator;
- target either session explicitly;
- surface queue items;
- answer questions and approvals;
- see workers, objective context, decisions, and resulting activity.

### Optional capability: tmux

tmux supports explicit attachment and keep-alive for selected sessions. It is not the normal first-run requirement.

## Core objects

### Workspace

A local organizational container for repositories, sessions, preferences, and optional Pacium configuration.

### Repository

A Git repository associated with sessions and explicit verification presets.

### Terminal session

A direct PTY or optional tmux-backed terminal with immutable local identity, display name, cwd, process state, dimensions, restoration capability, and attention metadata.

### Launch preset

A typed local command definition for a shell, Claude Code, Codex, or another approved command.

### Attention state

A source-labelled assessment such as working, waiting, needs input, finished, failed, stale, or unknown.

### Queue item

An observed Pacium question, approval, failure, review request, or unknown item with source provenance.

### Decision

The operator’s immutable response to a queue item, including delivery and conflict state.

## Product surfaces

### Terminal workspace

The primary canvas containing session navigation, one or more terminals, and a contextual inspector.

### Session inspector

Overview, changes, activity, process details, and session actions.

### Git inspector

Changed files, diff, commits, and configured verification.

### Pacium queue

Questions, approvals, failures, and review requests that need attention.

### Command palette

Contextual navigation and actions available consistently by keyboard and mouse.

### Settings

Workspaces, repositories, launch presets, themes, terminal preferences, notifications, Pacium configuration, and diagnostics.

## User promise

| Surface         | Promise                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Sessions        | “Show every terminal and which one needs me.”                          |
| Terminal        | “Give me a real, fast shell without losing it on refresh.”             |
| Changes         | “Show what this agent changed without making me leave the workspace.”  |
| Activity        | “Summarize meaningful work without pretending inference is certainty.” |
| Pacium queue    | “Put Meta, Orchestrator, and decisions in one focused view.”           |
| Command palette | “Let me act quickly without memorizing where every control lives.”     |

## Maturity model

1. One reliable local terminal.
2. A polished multi-session workspace.
3. Agent attention and Git visibility.
4. Pacium mode and queue decisions.
5. Native Claude and Codex enrichment.
6. Optional tmux durability and packaged release.
