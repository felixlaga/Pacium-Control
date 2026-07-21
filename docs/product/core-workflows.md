# Core workflows

## 1. Discover and classify existing sessions

1. The broker discovers tmux servers, sessions, windows, and panes.
2. Pacium matches known immutable IDs from tmux metadata.
3. Unknown sessions appear in an unclassified list.
4. An authorized user assigns workspace, repository, role, provider, run, and display name.
5. Metadata is recorded centrally and mirrored into tmux user options where supported.
6. The session becomes available through the correct navigation surfaces.

Success means an operator can understand the fleet without decoding ad hoc tmux names.

## 2. Send a structured steering prompt

1. User opens a run, agent, or command palette.
2. User chooses target level: meta, orchestrator, run, task, or worker.
3. UI previews the target session and current state.
4. User submits a prompt.
5. State coordinator creates an idempotent `Prompt` command.
6. Broker serializes delivery to the target pane or provider adapter.
7. Delivery state becomes queued, delivered, observed, acknowledged, or failed.
8. Browser reconnect cannot duplicate delivery.

The interface should make it difficult to send a run-level instruction to one worker accidentally.

## 3. Answer a question

1. Agent emits a structured question.
2. Meta may enrich it with clearer options and a recommendation.
3. The Inbox assigns it to a user or role.
4. The card shows why the question exists, whether work is blocked, and relevant evidence.
5. User selects an option or adds a comment.
6. An immutable decision is recorded.
7. Decision is delivered exactly once to the requesting workflow.
8. Orchestrator acknowledges receipt.
9. Later, the decision is marked applied, superseded, or unable to apply.

The UI should show every lifecycle transition.

## 4. Approve a privileged action

1. Agent or provider emits an approval request with concrete action details.
2. Pacium classifies risk and checks existing run-scoped policy.
3. If no policy resolves it, the request appears in the assigned approver’s Inbox.
4. Approver sees command/tool, host, repository, worktree, reason, side effects, and alternatives.
5. Approver chooses deny, allow once, allow for run under narrow conditions, edit and allow, or request another method.
6. The decision is delivered to the requesting adapter.
7. Execution result is linked to the approval.

Question and approval workflows must never be conflated.

## 5. Review work

1. Worker declares task ready for review.
2. Pacium builds a deterministic evidence bundle.
3. Bundle includes objective, acceptance criteria, decisions, commits, diff, checks, artifacts, known failures, and open questions.
4. An agent-generated narrative may summarize the evidence but cannot replace it.
5. Reviewer approves, requests revision, rejects, or records a conditional waiver.
6. Integration task merges or rebases through a controlled workflow.
7. Post-integration checks update the bundle.

## 6. Resume after absence

1. User opens a run or workspace.
2. Pacium compares current event revision with the user’s last-seen cursor.
3. Deterministic facts are grouped into completed work, changes, decisions, failures, new questions, and capacity changes.
4. Meta may generate a concise narrative from those facts.
5. Every narrative statement links to evidence.
6. User marks the summary read or drills into details.

## 7. Recover a stale agent

1. Freshness rules detect no meaningful event within the expected interval.
2. Pacium distinguishes terminal output, provider heartbeat, process existence, prompt wait, and host connectivity.
3. Agent becomes `stale` with an explanation and confidence.
4. Operator can ping, request status, open terminal, interrupt, restart from manifest, reassign task, or mark intentionally idle.
5. Every intervention is audited.

## 8. Add another host

1. Infrastructure owner installs a host agent and creates a one-time enrollment grant.
2. Host establishes an outbound authenticated connection.
3. Central control records host identity, capabilities, versions, roots, and health.
4. Repositories and tmux servers are discovered under allowlisted roots/users.
5. Access policies determine who can observe or operate host resources.
6. Disconnect and reconciliation behavior is tested before production use.

## 9. Emergency pause

1. Authorized owner triggers workspace pause.
2. New run starts, prompt deliveries, integrations, and policy-derived approvals stop.
3. Existing sessions remain alive unless a separate stop action is chosen.
4. Inbox and terminal observation remain available.
5. Resume requires explicit authorized action and records the reason.

Emergency pause is a coordination brake, not a host kill switch.
