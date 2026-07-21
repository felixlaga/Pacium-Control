# Mobile and notifications

## Mobile purpose

Mobile Pacium is a decision surface, not a pocket terminal workstation.

Primary mobile jobs:

- answer a question;
- approve or deny a narrow action;
- read a “since last checked” summary;
- inspect run and agent state;
- acknowledge an incident;
- pause coordination in an emergency;
- send a short steering instruction.

Raw terminal may be viewable but is not a primary mobile workflow.

## Mobile navigation

Bottom navigation may include:

```text
Inbox · Active · Search · Activity · Me
```

Repository and run drill-down remain available through content and search.

## Mobile question card

The card should present:

- title and blocking state;
- repository and run;
- requester;
- recommendation;
- expandable context;
- large option targets;
- consequences;
- note field;
- confirm state.

The entire decision should be possible with one thumb without horizontal scrolling.

## Mobile approval card

High-risk details must not be collapsed away. Show command, host, repository, worktree, risk, and scope before approval controls.

Biometric or device-level confirmation may be considered later for high-risk approvals, but must not replace server authorization.

## Notifications

### Notification policy

Notify only for:

- assigned blocking question;
- approval request;
- failure requiring intervention;
- review explicitly assigned;
- host or system incident above configured severity;
- provider capacity threshold chosen by the user.

Do not notify for normal agent progress.

### Delivery channels

Initial priority:

1. in-app Inbox;
2. browser notification;
3. optional email or team messaging integration later.

Every external notification deep-links to the exact item but reveals minimal sensitive content on lock screens.

### Digesting

Non-urgent updates should be summarized:

- completed tasks;
- new evidence;
- plan changes;
- non-blocking questions;
- usage changes.

Users can configure quiet hours and escalation rules for blocking work.

## Offline and reconnect behavior

Mobile actions require server confirmation. Optimistic UI may show “submitting,” but a decision is not complete until the state coordinator accepts it.

On reconnect:

- refresh item state;
- prevent duplicate answers with idempotency;
- explain if another user answered first;
- preserve unsent notes locally only when safe;
- never cache terminal secrets broadly.
