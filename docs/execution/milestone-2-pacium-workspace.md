# Milestone 2 — Pacium workspace

## Goal

Make the structured web workflow the primary way to supervise the meta/orchestrator system.

## Scope

### Domain

- repositories;
- runs;
- plans and revisions;
- tasks and dependencies;
- agent roles;
- questions;
- approvals;
- decisions;
- prompts;
- per-user unread cursors;
- evidence references.

### User experience

- Inbox;
- Active;
- Repositories;
- Runs;
- Agents;
- Activity;
- right inspector;
- keyboard navigation;
- command palette;
- mobile decision flow;
- deterministic “since last checked.”

### Workflow bridge

- `paciumctl` command contract;
- structured per-item file protocol where useful;
- legacy `FELIX-QUEUE` and `NEEDS-FELIX` import;
- compatibility views;
- question enrichment by meta;
- answer delivery and acknowledgement;
- applied/superseded lifecycle.

## Acceptance criteria

1. A run can attach existing meta and orchestrator sessions.
2. Orchestrator can emit a structured question.
3. Assigned user sees it in Inbox without refresh delay beyond target.
4. User can answer with keyboard or mobile.
5. Decision is immutable and idempotent.
6. Orchestrator receives and acknowledges the exact decision.
7. UI shows acknowledgement and later application evidence.
8. Questions and approvals have separate schemas and actions.
9. Legacy queue files can coexist without duplicate items.
10. A run page explains objective, plan, agents, blockers, decisions, and evidence.
11. “Since last checked” uses user cursor and deterministic events.
12. Meta-generated narrative links to evidence and is labeled.
13. Workspace pause stops new coordination actions without killing sessions.
14. All actions are attributable.
15. Routine operation can complete without raw terminal use.

## Pilot

Use Pacium Control on a real internal repository for at least several full runs. Record:

- question latency;
- terminal interventions;
- acknowledgement failures;
- duplicate/conflict cases;
- operator confidence;
- missing information;
- legacy adapter issues.

Milestone exit requires not only demo success but evidence from sustained use.
