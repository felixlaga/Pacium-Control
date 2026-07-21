# Domain model

## Modeling principles

- IDs are immutable and independent of display names.
- Current state and historical events are separate.
- Provider-neutral concepts form the core.
- Provider-specific details live in typed extensions.
- Live observations carry freshness and confidence.
- Human decisions are immutable.
- Completion depends on evidence and policy.

## Shared fields

Most durable entities include:

```text
id
schemaVersion
revision
workspaceId
createdAt
createdBy
updatedAt
updatedBy
labels
metadata
```

Fields are omitted when they do not make semantic sense. Timestamps use UTC and a canonical ISO representation.

## Workspace

A membership, policy, navigation, and state boundary.

Key fields:

- slug and display name;
- mode: `pacium` or `general`;
- status: active or paused;
- default policies;
- retention policy;
- created/updated metadata.

## User

A Pacium identity mapped to verified external identity.

Key fields:

- external identity provider and stable subject;
- login/email and display name;
- status;
- preferences reference;
- last authentication metadata.

Do not use device IP as the stable subject.

## Membership

Associates a user with a workspace and role, with optional repository/host scopes.

## Host

Represents one machine.

Key fields:

- stable host ID;
- display and network names;
- enrollment status;
- operating system and architecture;
- broker/agent versions;
- capabilities;
- allowed roots;
- last contact and health;
- trust metadata.

## Repository

Configuration around a Git repository.

Key fields:

- host and canonical root;
- remote metadata;
- default branch;
- worktree root;
- verification commands;
- branch naming policy;
- access policy;
- provider launch profiles;
- archival state.

## Run

The central coordinated objective.

Key fields:

- title and objective;
- owner;
- repository IDs;
- state and phase;
- acceptance criteria;
- meta and orchestrator session IDs;
- task and plan references;
- policy snapshot;
- start/end timestamps;
- completion evidence or waiver.

Run states:

```text
draft → starting → active ↔ paused → verifying → review_ready
      ↘ blocked             ↘ failed
review_ready → completed | revision_requested | cancelled
```

Transitions are policy-checked and evented.

## AgentSession

Key fields:

- host;
- tmux server/session/window/pane identifiers;
- role;
- provider and provider session/thread ID;
- run and repository;
- branch, worktree, base commit;
- assigned task;
- launch manifest;
- observed state;
- freshness and confidence;
- adapter health;
- execution identity reference;
- lifecycle timestamps.

The immutable Pacium ID remains stable if a tmux session is renamed.

## Task

Key fields:

- run;
- title and objective;
- acceptance criteria;
- assignee agent;
- dependencies;
- repository/branch/worktree;
- state;
- evidence requirements;
- result summary;
- handoff/review references.

Task states:

```text
planned → ready → assigned → working → verifying → review_ready
                     ↘ waiting ↘ blocked ↘ failed
review_ready → accepted | revision_requested
```

## Plan and PlanStep

Plans are revisioned. A run may have multiple plan revisions; prior versions remain inspectable.

Plan steps include:

- stable step ID across revisions where meaning persists;
- description;
- owner;
- dependencies;
- state;
- reason for change;
- linked tasks/evidence.

## Question

Key fields:

- requesting agent/run/task;
- assignee user or role;
- prompt and context;
- blocking flag;
- options;
- recommendation and reasoning;
- consequences;
- evidence references;
- lifecycle;
- expiration/supersession.

Question lifecycle:

```text
open → enriched → answered → acknowledged → applied
  ↘ expired | superseded | cancelled
```

The answer is stored in a separate immutable `Decision`.

## ApprovalRequest

Key fields:

- exact requested action;
- command/tool parameters where safe;
- host/repository/worktree;
- risk;
- reason;
- requested scope/duration;
- suggested alternative;
- applicable policy revision;
- provider callback reference;
- lifecycle.

## Decision

Immutable fields:

- source question or approval;
- answer/selected option;
- comment;
- actor;
- timestamp;
- idempotency key;
- original object revision;
- delivery and acknowledgement references.

Corrections create a new superseding decision rather than editing history.

## Prompt

Key fields:

- target level and target session;
- actor;
- normalized content or protected payload reference;
- payload hash;
- idempotency key;
- delivery state;
- attempt history;
- acknowledgement.

## TerminalLease

Key fields:

- user;
- session/pane;
- issued and expiry times;
- reason;
- lease revision/token hash;
- revocation state.

Expired leases are historical; current lease state may be projected for fast lookup.

## Handoff

Structured transfer containing:

- source and destination;
- objective;
- constraints;
- base commit;
- branch/worktree;
- completed work;
- files and commits;
- checks;
- failures;
- open questions;
- recommended next action.

## ReviewBundle

Key fields:

- run/task;
- objective and criteria;
- decisions;
- commits and diff references;
- checks and artifacts;
- risk and security notes;
- known limitations;
- reviewer assignments and decisions;
- integration/post-integration evidence.

## UsageSnapshot

Provider-specific usage with:

- session/agent;
- provider;
- capture time;
- model/account label;
- context consumed;
- token values where available;
- provider quota windows and reset times;
- source and confidence;
- unavailable-field reasons.

## Event

Append-only record with:

- event ID;
- global/workspace revision;
- type and schema version;
- actor/requester/execution identity;
- object references;
- timestamp;
- structured payload;
- trace/causation/correlation IDs;
- integrity metadata.
