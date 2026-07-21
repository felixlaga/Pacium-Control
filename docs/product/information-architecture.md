# Information architecture

## Navigation model

The application uses a persistent left rail, a main working area, an optional inspector, and a terminal drawer.

```text
┌──────────────────────────────────────────────────────────────┐
│ Workspace switcher · Search · Command palette · User         │
├──────────────┬───────────────────────────────┬───────────────┤
│ Left rail    │ Main list / canvas            │ Inspector     │
│              │                               │               │
│ Inbox        │ Runs, questions, agents,      │ Selected item │
│ Active       │ repository work, review       │ details       │
│ Repositories │                               │               │
│ Runs         │                               │               │
│ Agents       │                               │               │
│ Review       │                               │               │
│ Usage        │                               │               │
│ Activity     │                               │               │
├──────────────┴───────────────────────────────┴───────────────┤
│ Collapsible terminal drawer                                  │
└──────────────────────────────────────────────────────────────┘
```

## Workspace switcher

Initial workspaces:

- **Pacium** — the startup-specific meta/orchestrator workflow.
- **General terminals** — sessions not participating in Pacium runs.

Future workspaces may represent another organization, environment, or execution domain. Workspace switching must alter both navigation context and authorization scope.

## Global navigation

### Inbox

Personal, actionable work only:

- Questions.
- Approvals.
- Failures requiring intervention.
- Review requests.

Default grouping is by urgency and waiting time, then repository. The user may switch to grouping by run or assignee.

### Active

Operational pulse:

- starting;
- working;
- waiting on agent;
- waiting on human;
- verifying;
- blocked;
- review ready;
- disconnected.

### Repositories

Repository health and activity. Each repository page has:

```text
Overview · Work · Changes · Decisions · Sessions · Settings
```

### Runs

All coordinated objectives. Default views:

- My runs.
- Active.
- Waiting.
- Review ready.
- Completed recently.
- Failed.

### Agents

Fleet view with saved filters for role, provider, host, repository, state, and freshness.

### Review

Bundles waiting for review, revision requested, approved, integrated, or released.

### Usage

Separate Claude and Codex capacity views, plus per-run context and budget information.

### Activity

Searchable, attributable event history. Activity is not an Inbox; it is the audit and understanding surface.

### Terminal

A session directory and terminal-first workspace for exceptional or general-purpose use.

## Entity hierarchy

```text
Workspace
├── Repositories
│   ├── Runs
│   │   ├── Tasks
│   │   ├── Agent sessions
│   │   ├── Questions / approvals / decisions
│   │   ├── Handoffs
│   │   ├── Evidence
│   │   └── Review bundle
│   └── Generic sessions
├── Hosts
├── Members and policies
└── Activity
```

A session may exist without a run. A Pacium coding worker should not.

## Personal state

The product stores per-user:

- last-seen event cursor by workspace, run, and repository;
- saved views;
- notification preferences;
- pinned repositories and runs;
- default terminal behavior;
- command palette history where safe;
- display density and accessibility preferences.

Personal state must not alter shared operational truth.

## URL model

URLs should be stable and shareable within the tailnet:

```text
/w/:workspaceSlug/inbox
/w/:workspaceSlug/active
/w/:workspaceSlug/repos/:repoId
/w/:workspaceSlug/runs/:runId
/w/:workspaceSlug/agents/:agentId
/w/:workspaceSlug/review/:reviewId
/w/:workspaceSlug/sessions/:sessionId
```

Sensitive terminal grants must never appear as durable URL parameters.

## Selection and inspector behavior

Lists support fast selection without navigation. The right inspector shows enough detail to decide whether to open the full object. Deep work opens a stable full-page route.

Examples:

- Select a question → options, recommendation, context, evidence, answer controls.
- Select an agent → current task, freshness, worktree, recent events, quick steering.
- Select a changed file → diff summary and evidence links.

## Search

Global search should cover:

- repository, run, agent, task, and session names;
- question and decision text;
- commit hashes and branch names;
- changed files;
- event summaries;
- human and execution identities.

Terminal scrollback search is local to a session and subject to retention policy.

## Empty states

Empty states should teach the operating model rather than decorate space.

Examples:

- Empty Inbox: “Nothing needs your judgment. Five agents are working.”
- No active runs: “Start a run or attach existing sessions.”
- No provider telemetry: “Terminal is connected; native Claude events are unavailable.”
- No review evidence: “Completion cannot be verified until checks or an explicit waiver are recorded.”
