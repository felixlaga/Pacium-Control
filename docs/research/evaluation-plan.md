# Evaluation plan

## Purpose

Pacium Control should be evaluated against real operator outcomes and failure behavior, not only feature completeness.

## Evaluation phases

### Phase 1 — Prototype validation

Validate highest-risk technical assumptions:

- filesystem crash recovery;
- tmux control mode;
- PTY fidelity;
- terminal grants and leases;
- Tailscale ingress identity;
- provider event payloads;
- Git worktree behavior.

Output: short prototype reports with evidence and decisions.

### Phase 2 — Controlled dogfood

One operator, one host, one or two repositories.

Measure:

- time to identify session state;
- question answer latency;
- terminal usage frequency;
- duplicate/unknown delivery;
- state recovery;
- missing context;
- subjective trust.

### Phase 3 — Team pilot

Several team members with different roles.

Evaluate:

- role clarity;
- repository scoping;
- shared observation;
- control-lease experience;
- decision conflicts;
- mobile Inbox;
- review handoff;
- onboarding time.

### Phase 4 — Multi-provider sustained use

Claude and Codex executing simultaneously over several weeks.

Evaluate:

- provider adapter reliability;
- handoff quality;
- worktree isolation;
- quota/context warning usefulness;
- integration conflicts;
- evidence-backed completion;
- operator attention per completed task.

### Phase 5 — Multi-host and resilience

Add another server or local machine.

Evaluate:

- enrollment and revocation;
- disconnect/reconnect;
- event and command deduplication;
- session reconciliation;
- host-scoped authorization;
- backup and full restore;
- VPS reboot recovery.

## Core evaluation scenarios

1. Blocking multiple-choice question.
2. High-risk approval denied.
3. Approval allowed once and linked to execution.
4. Browser disconnect during answer submission.
5. API crash during state mutation.
6. Broker restart with active sessions.
7. Human lease takeover.
8. Claude adapter degradation.
9. Codex App Server disconnect.
10. Two agents working in isolated worktrees.
11. Intentional merge conflict.
12. Cross-provider handoff near context limit.
13. Host disconnect during command.
14. User revoked during terminal observation/control.
15. Restore state on a clean machine.

## Usability prompts

Ask operators:

- What do you believe is happening?
- What evidence supports that belief?
- What needs you now?
- What would you do next?
- How certain are you?
- Did you need the terminal?
- Was any state or consequence surprising?

Compare their answers with system truth.

## Success thresholds

Thresholds should be established after baseline measurement. Candidate goals:

- most blocking questions answered without terminal access;
- no duplicate decisions or prompts in pilot;
- clear acknowledgement for nearly all answered questions;
- materially lower time to resume context;
- zero worktree collision incidents;
- successful recovery from planned restarts;
- high operator confidence with low false-completion rate.

## Evidence repository

Store evaluation reports with:

- version/commit;
- environment;
- scenario;
- expected result;
- observed result;
- logs/artifacts safe for retention;
- user feedback;
- issues created;
- decision.
