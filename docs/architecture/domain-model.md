# Local domain model

The initial model is deliberately small.

## Workspace

- `id`
- `schemaVersion`
- `name`
- `repositoryIds`
- `sessionPresetIds`
- `paciumConfigId?`
- preferences

## Repository

- `id`
- `schemaVersion`
- `displayName`
- canonical root
- verification presets
- last observed branch/commit cache

## TerminalSession

- `id`
- `displayName`
- `workspaceId?`
- `repositoryId?`
- `cwd`
- `launchPresetId?`
- runtime kind: `pty | tmux`
- process identity and lifecycle
- dimensions
- connection epoch
- attention state
- agent classification
- relaunch manifest reference

## LaunchPreset

- `id`
- display name
- command and typed arguments
- default cwd behavior
- environment allowlist
- optional agent/provider classification
- optional tmux keep-alive capability

## AttentionState

- state: `working | waiting | needs_input | finished | failed | stale | unknown`
- source: `native | hook | process | terminal | human`
- confidence
- observedAt
- staleAfter
- reason

## PaciumConfig

- Meta session or launch-preset reference
- Orchestrator session or launch-preset reference
- queue sources
- answer delivery methods
- worker classification rules
- objective/plan sources

## QueueItem

- local ID
- type: `question | approval | failure | review | unknown`
- source provenance and content hash
- requesting context
- original text
- parsed presentation
- confidence
- lifecycle

## Decision

- local ID
- queue item identity
- type-specific response
- actor label
- timestamp
- payload hash
- delivery state
- acknowledgement/application evidence

## ActivityEntry

A bounded application-owned fact such as session lifecycle, attention change, Git observation, verification result, queue decision, or provider event summary.

## Non-entities

The first model does not include generalized users, memberships, hosts, runs, tasks, plans, policies, handoffs, or review bundles.
