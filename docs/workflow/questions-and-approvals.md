# Questions and approvals

Questions and approvals are separate because they have different consequences.

## Question

A question asks for judgment, clarification, or direction.

Presentation may include:

- source session;
- original text;
- reason;
- blocking state;
- recommendation;
- options and consequences;
- related terminal or Git evidence.

Answering a question cannot authorize a privileged or destructive action.

## Approval

An approval requests permission for one concrete action.

Presentation must include where available:

- exact action or command;
- target session and repository;
- reason;
- expected side effects;
- risk;
- alternatives;
- expiry or content identity.

If the action changes, the old approval does not apply.

## Decision

Local decision metadata includes:

- queue-item identity and source hash;
- response;
- operator label;
- timestamp;
- optional note;
- payload hash;
- delivery state;
- acknowledgement/application evidence when observable.

Decisions are immutable. A later correction creates a superseding decision or explicit conflict.

## Lifecycle

```text
observed
→ ready or invalid/conflicted
→ decided
→ delivering
→ delivered | unknown | failed
→ acknowledged | applied | superseded | unable_to_apply
```

Not every legacy workflow can expose every later state. Missing evidence remains unavailable rather than guessed.

## Keyboard safety

- Numeric shortcuts apply only when a question inspector owns focus.
- Approval choices require labelled controls and confirmation.
- No queue shortcut runs while terminal capture or a text input is active.

## Failure rules

- Parse failure leaves source untouched.
- Delivery uncertainty does not trigger blind retry.
- Duplicate source content resolves through provenance and stable identity.
- Competing answers create a visible conflict.
- Original source text remains inspectable.
