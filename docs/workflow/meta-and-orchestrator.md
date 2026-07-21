# Meta and orchestrator workflow

## Purpose

The Pacium workflow separates human-facing synthesis from execution coordination.

- The **meta agent** helps the human understand, decide, and steer.
- The **orchestrator** owns the run plan, task graph, assignments, escalation, integration, and completion evidence.

These roles may use the same provider or different providers. They remain distinct in state and authority.

## Meta agent responsibilities

### Human interface

- summarize deterministic facts;
- explain what changed since the human last checked;
- translate technical questions into clear choices;
- recommend an option with reasoning and consequences;
- route human steering to the correct target;
- maintain concise context across active runs;
- identify conflicting objectives or decisions.

### What meta must not become

- the sole transport for questions and answers;
- an unreviewed source of operational truth;
- a hidden permission authority;
- a replacement for run evidence;
- a universal orchestrator for every task;
- a reason to duplicate all provider conversation state.

Pacium records the original question and immutable decision independently. Meta may enrich presentation but cannot rewrite history.

## Orchestrator responsibilities

### Planning

- interpret the objective and acceptance criteria;
- create and revise a plan;
- decompose work into bounded tasks;
- identify dependencies and integration points;
- choose worker/provider based on task and capacity;
- request human decisions when assumptions matter.

### Assignment

- assign one agent, branch, and worktree per coding task;
- record base commit and scope;
- provide constraints and evidence requirements;
- avoid overlapping ownership;
- establish handoff or review expectations.

### Supervision

- monitor task progress and freshness;
- react to worker questions and failures;
- re-plan explicitly rather than silently changing goals;
- acknowledge human decisions;
- record how decisions were applied;
- prevent blocked workers from spinning indefinitely.

### Integration and completion

- coordinate review;
- assign integration as a distinct task;
- collect post-integration checks;
- build or trigger review bundle creation;
- declare completion only when acceptance criteria and evidence policy are satisfied or waived.

## Communication layers

### Human to meta

Used for:

- high-level intent;
- prioritization;
- strategy;
- broad status questions;
- cross-run steering.

### Human to orchestrator

Used for:

- run-level changes;
- plan revisions;
- task prioritization;
- integration choices;
- execution constraints.

### Human to worker

Used for:

- precise correction;
- debugging collaboration;
- exceptional intervention.

The UI should make target scope explicit to avoid accidental local/global instructions.

## Run initialization

1. Human or template creates a draft run.
2. Objective, repositories, acceptance criteria, policy, and budget are recorded.
3. Meta and orchestrator sessions are attached or launched.
4. Orchestrator proposes initial plan.
5. Human approves, edits, or lets a configured low-risk plan start automatically.
6. Orchestrator creates tasks and assigns workers.
7. Run becomes active when at least one task starts or an explicit start event is committed.

## Plan revisions

Plans are revisioned, not overwritten.

A revision records:

- changed steps;
- reason;
- triggering event or decision;
- authoring agent;
- human approval where required;
- task impact;
- superseded assumptions.

The UI should show current plan and a concise diff from prior revisions.

## Escalation

The orchestrator creates a question when:

- requirements are ambiguous in a consequential way;
- options have materially different product or architecture outcomes;
- a task crosses defined authority;
- worker outputs conflict;
- evidence cannot satisfy acceptance criteria;
- risk exceeds policy;
- prioritization requires human judgment.

It creates an approval request when a concrete action needs permission.

## Completion protocol

Before completion, the orchestrator confirms:

- all required tasks are accepted or deliberately cancelled;
- decisions are applied or documented as superseded;
- required checks pass on the correct commit;
- work is integrated or the output state is explicit;
- known limitations are recorded;
- review bundle exists;
- no active agent is unknowingly editing obsolete work;
- cleanup policy is ready.

Meta may present the outcome, but evidence determines state.
