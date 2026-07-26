# Glossary

## Attention state

The operator-facing assessment of whether a session is working, waiting, needs input, finished, failed, stale, or unknown. It always has a source and freshness.

## Direct PTY

A pseudoterminal created and owned by the Pacium local server. It survives browser disconnect but not local-server exit.

## Inspector

The contextual right panel showing session overview, Git changes, activity, or Pacium queue details.

## Launch preset

A typed local definition for starting a shell, Claude Code, Codex, or another configured command.

## Local access token

An unguessable token used with Origin validation to protect the localhost browser-to-shell boundary. It is not a remote authentication system.

## Meta

The Pacium role focused on human-facing synthesis, clarification, and steering.

## Orchestrator

The Pacium role coordinating the existing workflow, workers, queue items, and completion evidence.

## Pacium mode

The specialized workspace presentation that pins Meta and Orchestrator and adds queue, worker, objective, decision, and evidence context.

## PTY

A pseudoterminal connecting the local server to an interactive shell or CLI application.

## Queue item

A question, approval, failure, review request, or unknown item observed from a configured Pacium source.

## Runtime kind

The terminal process substrate: direct PTY initially, or optional tmux-backed session.

## Session

A local terminal with immutable Pacium identity, working directory, process lifecycle, attention state, and optional repository and agent classification.

## Source confidence

Metadata explaining whether status came from provider-native events, hooks, process observation, terminal inference, or human classification.

## Terminal capture

The focus state in which keyboard input goes to the selected terminal rather than Pacium application shortcuts.

## tmux-backed session

An optional terminal attached to or launched under tmux so it may survive local-server restart.

## Verification preset

An explicit configured command for checking a repository, with bounded output and observed Git context.

## Worker

A coding-agent terminal classified as a worker in Pacium mode.

## Workspace

A local organizational container for repositories, terminal sessions, preferences, and optional Pacium configuration.

## Worktree

A Git checkout associated with a branch. Concurrent coding workers must not share one mutable worktree.
