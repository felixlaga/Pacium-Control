# Glossary

Canonical vocabulary keeps product, code, and operations aligned.

## Agent

A logical actor performing work. In Pacium, an agent is represented by an `AgentSession` linked to a provider process or generic terminal session.

## Agent session

A durable Pacium identity for a live or historical session, including host, tmux target, role, provider, repository, run, branch, and worktree.

## Acknowledged

A decision or prompt has been received by the intended workflow or agent. It does not imply the instruction was applied successfully.

## Applied

A decision has been acted upon, with an explanation or evidence of the result.

## Approval request

A request for permission to perform a concrete action. It includes risk, scope, target, duration, and execution context.

## Broker

The narrow privileged service that controls tmux, PTYs, approved Git operations, and provider CLI processes. The web process does not access tmux directly.

## Command

A validated request to mutate Pacium state or perform an operation. Commands carry identity, authorization context, and an idempotency key.

## Control lease

An expiring grant allowing one human to write to a terminal pane. Observation does not require a write lease.

## Decision

An immutable human response to a question or approval request.

## Evidence

Deterministic support for a claim: diff, commit, check result, artifact, log, screenshot, or explicit waiver.

## Event

An append-only record that something happened. Events are historical facts, not mutable current state.

## Execution identity

The provider or operating-system credential context that performs work. It is distinct from the human operator who requested or approved the work.

## Freshness

How recently Pacium received a meaningful signal about an agent, session, host, or adapter.

## Generic workspace

The non-Pacium view for arbitrary tmux sessions and host operations.

## Handoff

A structured transfer of task context and evidence between agents or providers.

## Host

A machine capable of running tmux sessions, repositories, and provider CLIs.

## Inbox

A user-specific queue of questions, approvals, failures, and review requests requiring attention.

## Inferred state

A status derived from indirect signals such as terminal output or process activity rather than a provider-native event.

## Integration task

A distinct task that merges, rebases, resolves conflicts, or validates worker output against an integration branch.

## Meta agent

The human-facing synthesis and steering layer. It explains state, enriches questions, and routes instructions without becoming the sole decision transport.

## Native event

A structured event produced by a provider-supported protocol.

## Operator

A human authorized to steer work or control selected sessions.

## Orchestrator

The agent responsible for run planning, task assignment, dependency management, integration, escalation, and completion evidence.

## Pacium workspace

The opinionated workspace implementing the meta/orchestrator/worker workflow.

## Plan step

A revisioned element of a run plan. Plan progress is not the same as provider quota or context consumption.

## Projection

A rebuildable materialized view derived from authoritative entities and events.

## Prompt

A durable structured instruction targeted at an agent or workflow level, with delivery lifecycle and idempotency.

## Provider

A coding-agent system such as Claude Code or Codex.

## Provider adapter

The component translating provider-specific CLI protocols and events into Pacium operations and domain state.

## Question

A request for human judgment or direction. Unlike an approval, it does not directly authorize a concrete privileged action.

## Repository

A configured Git repository and its Pacium policy, roots, verification commands, and access scope.

## Review bundle

The evidence package presented for human or independent-agent review.

## Revision

A monotonically increasing version used for optimistic checks, event ordering, and user unread cursors.

## Run

A coordinated unit of work with an objective, participants, tasks, plan, decisions, and evidence.

## Session manifest

The durable description required to explain or recreate an agent session after process or host loss.

## State coordinator

The single authoritative writer for central Pacium entity and event state.

## Structured action

A typed product operation such as answering a question or sending a prompt, as opposed to raw terminal input.

## Tailnet

The private Tailscale network through which Pacium is normally accessed.

## Task

A bounded work assignment with one owner, acceptance criteria, dependencies, and evidence.

## Terminal drawer

The collapsible raw terminal surface available as an escape hatch within the web application.

## Worktree

A Git working directory tied to a branch. Each coding worker receives a separate worktree.

## Workspace

A navigation, policy, membership, and state boundary within Pacium Control.
