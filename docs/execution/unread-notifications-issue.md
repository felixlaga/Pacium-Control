# PC-032: Unread attention and quiet notifications

## Problem

Attention evidence is visible only while the operator is looking at the
workspace. Pacium has no durable browser-local acknowledgement cursor,
per-session mute, or duplicate-safe notification policy. Naive delivery would
turn normal progress and refreshes into noise.

## Outcome

Important attention transitions become unread until the operator selects the
session. Optional browser notifications fire only for needs-input, failed, or
finished evidence while the page is hidden, the saved preference is enabled,
permission is already granted, and the session is not muted. Delivery identity
survives refresh and permission requests require an explicit settings button.

## Scope

- Strict versioned browser-local attention cursor state with bounded entries.
- Stable event keys for important attention evidence.
- Unread derivation and selection-based acknowledgement.
- Per-session mute in the inspector.
- Duplicate-safe notification policy and minimal lock-screen-safe copy.
- Explicit notification-permission request control in settings.
- Sidebar unread marker and inspector mute/acknowledgement state.
- Unit, storage-failure, policy, and rendered semantic tests.

## Non-scope

- Notifications for normal working, waiting, stale, or unknown states.
- Email, mobile push, team messaging, quiet hours, or escalation.
- Durable server event history or synchronization across browser profiles.
- Inferring needs-input before provider/queue observers exist.
- Notification actions that approve, answer, interrupt, or mutate a process.

## Acceptance criteria

- [ ] Only needs-input, failed, and finished evidence can become unread.
- [ ] Selecting a session advances its browser-local seen cursor.
- [ ] Per-session mute suppresses delivery without hiding attention truth.
- [ ] The same evidence is not notified twice across refresh.
- [ ] Delivery requires enabled preference, granted permission, hidden page,
      actionable evidence, and an unmuted session.
- [ ] Permission is requested only from an explicit operator action.
- [ ] Notification content excludes cwd, terminal bytes, prompts, and secrets.
- [ ] Invalid, oversized, unknown-version, or excess stored state fails safely.
- [ ] Storage or Notification API failure leaves terminals and attention UI
      operational with honest feedback.
- [ ] Full verification and browser regressions pass.

## Architecture and safety

- Browser-local JSON owns personal seen/notified/mute metadata only.
- Attention evidence remains derived from labelled upstream truth.
- No server, PTY, protocol, filesystem, or provider credential change.
- Notification tags use session ID plus evidence identity for de-duplication.
- Clicking a notification may focus/select its session but cannot authorize an
  action.

## Test plan

- Unit: strict parsing, bounds, event identity, unread, acknowledge, mute, and
  delivery predicate.
- Fault: storage unavailable/corrupt/oversized and Notification constructor
  failure.
- Rendering: unread marker, mute state, permission copy.
- Browser: existing keyboard/responsive regression suite.

## Dependencies

- Blocked by: PC-027 preference and PC-031 attention reducer.
- Blocks: provider needs-input delivery, activity summaries, and Pacium queue
  notifications.

## Evidence required

- Focused state/policy/rendering tests.
- Full `pnpm verify` and `pnpm test:e2e`.
- Synchronized status, backlog, issue, plan, and changelog.
