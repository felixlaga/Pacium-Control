# ADR-0012: Model questions and approvals as separate objects

- Status: Accepted
- Date: 2026-07-20

## Context

The current workflow contains both requests for human judgment and requests for permission to perform exceptional actions. Treating them as one queue item makes the UI vague and risks granting authority through an ordinary answer.

## Decision

Use separate schemas, state machines, UI, authorization, and provider callbacks for:

- `Question` — seeks direction or judgment;
- `ApprovalRequest` — seeks permission for a concrete action.

Both may produce immutable `Decision` records, but the decision payload and consequences differ.

## Consequences

### Positive

- Clear human mental model.
- Safer permission handling.
- Better multiple-choice question UX.
- Narrow approval policies.
- Accurate audit and provider callback behavior.

### Negative

- More domain and UI components.
- Legacy queue migration must classify ambiguous items.
- Some provider prompts need interpretation.

## Validation

Tests must prove a question answer cannot authorize a privileged or destructive local action, and an approval cannot be applied to a changed or expired action.
