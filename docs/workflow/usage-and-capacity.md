# Usage and capacity

> Deferred blueprint: provider capacity analytics are not part of the initial roadmap.

## Principle

Claude and Codex have different context, quota, and reset semantics. Pacium should display them side by side without pretending they are one fungible percentage.

## Four separate concepts

### Context usage

How much of the current session or thread context is consumed.

### Provider quota

Subscription or account capacity in provider-defined windows.

### Run budget

A Pacium policy or planning allocation, which may be approximate.

### Plan progress

How much work is complete. This is not a usage measure.

The UI must not combine these concepts into one progress bar.

## Claude view

When available, show:

- model;
- provider session ID;
- context usage;
- input/output token values;
- duration;
- lines added/removed;
- provider quota windows;
- reset times;
- source and freshness.

Missing provider fields are displayed as unavailable, not zero.

## Codex view

When available, show:

- model/account label;
- thread/turn state;
- context usage;
- token totals;
- primary/secondary rate windows;
- used percentage;
- reset times;
- source and freshness.

## Agent card

A compact card may show:

```text
Context 61% · Provider window 78% used · Task 4/7 · last update 12s
```

Each value has its own label and tooltip.

## Alerts

User-configurable thresholds might include:

- context at 70/85/95%;
- provider quota at 70/90%;
- reset approaching while many tasks wait;
- unavailable usage data beyond a freshness threshold;
- run budget exceeded.

Alerts should recommend an action:

- summarize/compact or hand off;
- route new tasks to another provider;
- pause low-priority work;
- reauthenticate;
- wait for reset;
- split task.

## Routing suggestions

Pacium may suggest:

- Claude for planning/review;
- Codex for implementation;
- alternate provider due to capacity;
- a fresh session due to context pressure;
- handoff before exhaustion.

Suggestions must explain the evidence and remain advisory unless an explicit policy authorizes automatic routing.

## Historical capacity

Later, retain enough usage snapshots to understand:

- provider consumption by repository/run;
- context exhaustion patterns;
- tasks likely to need handoff;
- human interruption versus usage;
- capacity-related failures.

Do not equate token volume with value or productivity.

## Privacy and account identity

Usage belongs to an execution identity. The UI must distinguish personal and organization-approved identities and should not encourage a whole team to operate one person’s private account.
