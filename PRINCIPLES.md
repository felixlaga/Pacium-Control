# Product and engineering principles

Each principle includes a decision test. Use these tests in design reviews and pull requests.

## 1. Structured first, terminal always

Routine work should use typed actions and structured views. The terminal remains available for precision and recovery.

**Decision test:** Could an operator complete the common task without parsing terminal output? If not, the structured workflow is incomplete.

## 2. The human sees only consequential work

Do not turn every event into an Inbox item.

**Decision test:** Does this item require judgment, permission, or review from this specific person? If not, keep it in activity or telemetry.

## 3. One source of truth per concern

- tmux for live process/session reality;
- Git for code history;
- filesystem entities and events for coordination;
- provider APIs/hooks for provider-native telemetry.

**Decision test:** Are we duplicating mutable truth that another system already owns? If yes, store a reference or projection instead.

## 4. No hidden database

Pacium Control does not introduce SQLite, PostgreSQL, Redis, an embedded key-value store, or a hosted database behind the filesystem abstraction.

**Decision test:** Can an operator understand and back up durable state with ordinary filesystem tools?

## 5. One authoritative writer

All central state mutations are serialized through one state coordinator. Remote hosts emit commands and events; they do not write central state directly.

**Decision test:** Can two processes race to update the same entity? If yes, the write path violates the architecture.

## 6. Every action is attributable

Prompts, answers, approvals, control leases, session operations, policy changes, and destructive actions have an actor and execution identity.

**Decision test:** Can the audit view explain who requested, authorized, and executed this action?

## 7. Every worker has an isolated checkout

Parallel coding work requires one branch and one worktree per worker.

**Decision test:** Can two agents modify the same filesystem checkout? If yes, stop and redesign the assignment.

## 8. Uncertainty is a state, not a styling problem

Status must indicate whether it is native, hooked, inferred, stale, or unavailable.

**Decision test:** Could the interface be presenting an inference as a provider-confirmed fact?

## 9. Restart without regret

Web, API, and broker processes may restart without killing work or duplicating commands.

**Decision test:** What happens if this process exits immediately after accepting the request but before replying?

## 10. Privilege is narrow and temporary

Terminal control, command approval, and host access are separately scoped. Leases expire.

**Decision test:** Does this permission grant more authority, duration, repositories, or hosts than the action requires?

## 11. Provider capabilities enrich the core

Normalize shared concepts but preserve rich provider-native events.

**Decision test:** Are we throwing away useful Claude or Codex semantics merely to make adapters identical?

## 12. Evidence-backed completion

A run is not complete until its acceptance criteria and required verification are satisfied or explicitly waived by an authorized human.

**Decision test:** What exact evidence allows the UI to display “complete”?

## 13. Mobile is for decisions, desktop is for operations

The mobile experience prioritizes Inbox, approvals, summaries, and emergency controls. It does not attempt to reproduce the full desktop workspace.

**Decision test:** Is this mobile interaction optimized for a quick, safe decision rather than squeezed desktop UI?

## 14. Names are infrastructure

Session, run, agent, branch, and worktree names must be stable, predictable, and human-readable.

**Decision test:** Can a human identify role, repository, provider, and run without decoding an ad hoc string?

## 15. Build product behavior before decorative breadth

A reliable question loop is more valuable than ten shallow dashboards.

**Decision test:** Does this work strengthen a core operational loop, or merely make the product appear broader?

## 16. No environment mythology

Documentation and UI must distinguish designed behavior, implemented behavior, validated behavior, and production-proven behavior.

**Decision test:** Can this claim be demonstrated in the repository or a recorded verification artifact?

## 17. Defaults should be safe and reversible

The default action should preserve work, preserve evidence, and minimize privilege.

**Decision test:** If the operator clicks through quickly, is the result safe and undoable where practical?

## 18. The product should get quieter as it gets smarter

Improved automation should reduce noise and escalations, not create more dashboards and alerts.

**Decision test:** Does this feature reduce operator attention per unit of completed work?
