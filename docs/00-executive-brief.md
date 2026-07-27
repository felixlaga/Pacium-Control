# Executive brief

## One sentence

Pacium Control is a clean localhost workspace for managing terminal sessions and CLI coding agents, with a specialized Pacium mode for Meta, Orchestrator, workers, and the queue.

## Problem

Running several coding agents means juggling terminal windows, repositories, prompts, diffs, and mental state. It is difficult to tell:

- which sessions are alive;
- which need input;
- what each agent changed;
- which repository and branch it belongs to;
- what finished or failed;
- where Meta and Orchestrator are;
- what is waiting in the queue.

## Solution

Pacium provides:

- real local PTY terminals in the browser;
- sessions grouped by workspace and repository;
- tabs, splits, keyboard navigation, and command palette;
- working/waiting/needs-input/finished/failed attention states;
- Git changes and diff beside the terminal;
- Pacium mode with Meta, Orchestrator, workers, and queue decisions;
- optional tmux attachment for selected durable sessions.

## Architecture

```text
React browser app
        ↕ localhost WebSocket
Node local server
        ├── PTY terminal manager
        ├── session and attention model
        ├── Git inspector
        ├── provider observers
        └── Pacium queue adapter
```

The application is loopback-bound and single-user. Optional Tailscale Serve access proxies tailnet-only HTTPS to the same host without adding a database, separate broker, membership model, or multi-host protocol.

## Design direction

The interface is inspired by Linear’s hierarchy, density, consistency, restrained color, contextual actions, and keyboard speed. It does not copy Linear’s brand.

## First useful release

The first release succeeds when the operator can:

1. launch Claude Code, Codex, and shell sessions;
2. manage them from one clean workspace;
3. refresh the browser without losing live PTYs;
4. find which agent needs attention;
5. inspect changed files and diff;
6. enter Pacium mode;
7. see Meta, Orchestrator, workers, and queue;
8. answer a queue item once with visible result.

## Current status

The repository contains the working direct-PTY foundation, fixed CLI launch presets, repository grouping, and terminal tabs. Agent oversight, Pacium mode, Tailscale operation, and release hardening remain in progress.
