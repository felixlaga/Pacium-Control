# Success metrics

## Measurement philosophy

Metrics should reflect operator leverage, system trust, and verified outcomes. Activity volume alone is not success.

## North-star metric

### Verified work completed per hour of human operator attention

This combines three goals:

- more useful work;
- less human interruption;
- strong verification.

Because exact measurement is imperfect, it should be estimated through run evidence, active attention windows, and operator feedback rather than presented as false precision.

## Product metrics

### Decision efficiency

- Median time to answer a blocking question.
- 90th percentile time to answer.
- Percentage answered from Inbox without terminal access.
- Percentage containing a recommendation.
- Percentage acknowledged by requester.
- Percentage marked applied with evidence.
- Duplicate or conflicting decision rate.

### Operational clarity

- Time to identify why an agent is not progressing.
- Percentage of agent states with native or hooked confidence.
- Percentage of stale detections confirmed useful.
- Time to understand changes since last visit.
- Operator confidence score after reviewing a run.

### Work quality

- Percentage of completed tasks with required checks.
- Percentage of review bundles with all required fields.
- Revision rate after “ready for review.”
- Escaped defects attributable to missing verification.
- Worktree collision incidents.
- Integration conflict rate and recovery time.

### Reliability

- Duplicate prompt deliveries.
- Lost decision deliveries.
- State corruption incidents.
- Recovery time after API, broker, or host restart.
- Successful backup restore drills.
- Session survival rate across control-plane restarts.

### Security

- Unauthorized access attempts.
- Overbroad approval policy findings.
- Terminal lease violations.
- Actions missing actor or execution identity.
- Secret material detected in state or logs.
- Time to revoke a user or execution identity.

### Capacity

- Agent-hours per operator.
- Provider quota surprise incidents.
- Tasks rerouted because of capacity.
- Context exhaustion rate.
- Average context usage at handoff.

## Guardrails

Optimization must not increase:

- unreviewed destructive actions;
- notification volume per completed task;
- false completion states;
- shared credential usage;
- average privilege scope;
- hidden or inferred status presented as fact;
- mean time to recover from system failures.

## Baseline plan

Before advanced analytics, capture a manual baseline for two weeks:

- number of active agents;
- questions asked;
- answer latency;
- terminal interventions;
- runs completed;
- checks performed;
- failures and recovery time;
- subjective operator confidence.

Use that baseline to evaluate the first controlled pilot. Do not manufacture benchmark claims without real operating data.
