# Product voice and naming

## Voice

Pacium Control speaks like an excellent technical operator: calm, direct, specific, and honest about uncertainty.

It should never sound theatrical, overly anthropomorphic, or vaguely “AI-powered.” The product is most credible when it explains exact state and consequence.

## Voice attributes

### Calm

Use severity proportionally. Normal work is not an alert.

### Precise

Name the host, repository, action, actor, and state when they matter.

### Honest

Distinguish confirmed, inferred, stale, unavailable, and unknown.

### Actionable

Errors and blockers say what survived and what the operator can do next.

### Respectful of expertise

Do not overexplain basic Git or terminal concepts in high-frequency interfaces. Offer deeper context on demand.

## Copy examples

### State

Good:

> Waiting for Felix to choose a migration strategy.

Bad:

> Agent paused.

Good:

> Codex App Server disconnected 18 seconds ago. The tmux session is still live; status is inferred from terminal activity.

Bad:

> Connection error.

### Completion

Good:

> Ready for review · 3 commits · 18 files · typecheck and 42 tests passed on `8f31c2a`.

Bad:

> Done!

### Permission

Good:

> Allow this exact `terraform apply` once on staging?

Bad:

> Give agent permission?

### Recovery

Good:

> Broker restarted. All 7 tmux sessions were rediscovered. One prompt has an unknown delivery outcome.

Bad:

> System recovered successfully.

## Terminology rules

- Use **run** for a coordinated objective.
- Use **task** for a bounded assignment.
- Use **agent** for the logical actor and **session** when tmux/provider process details matter.
- Use **question** for judgment and **approval** for concrete permission.
- Use **decision** for the immutable human response.
- Use **working** only when evidence supports it; otherwise say alive, idle, stale, or inferred.
- Use **review ready**, not complete, before required review/integration.
- Use **execution identity**, not account, when attribution and credentials matter.

## Naming

### Product

Always `Pacium Control` on first reference. `Pacium` may refer to the startup or workflow context, so avoid ambiguity.

### Workspace

- `Pacium`
- `General terminals`

### Sessions

Display:

```text
<Repository> · <Role> · <Provider>
```

Examples:

- `Checkout API · Orchestrator · Claude`
- `Web App · Worker 02 · Codex`
- `Platform · Reviewer · Claude`

### Runs

Use outcome-oriented titles:

- `Make webhook processing idempotent`
- `Migrate billing schema without downtime`

Avoid:

- `Claude run 42`
- `Fix stuff`

### Tasks

Use imperative, bounded titles:

- `Add idempotency-key persistence`
- `Write migration compatibility tests`

## Interface capitalization

Use sentence case for navigation, buttons, titles, and statuses. Keep provider and technology names in their canonical capitalization.

## Anthropomorphism

Agents can ask, wait, review, or report because those are useful operational verbs. Avoid emotional or human-status language such as “happy,” “confused,” or “wants” unless quoting the agent.

## Brand promise

The voice should reinforce one promise:

> Run the work. See the truth. Keep the human in control.
