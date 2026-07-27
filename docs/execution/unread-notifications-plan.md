# Implementation plan: Unread attention and quiet notifications

- Issue: [PC-032](unread-notifications-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/unread-notifications`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `53d7cb4`
- Target milestone: Milestone 2
- Status: In progress

## Objective

Add a quiet personal attention cursor and duplicate-safe browser delivery around
the existing reducer without creating server state, process authority, or
notification noise.

## Proposed behavior

A strict version-1 local record stores at most 200 session entries containing
seen evidence key, notified evidence key, and mute. Only needs-input, failed,
and finished results create meaningful event keys. Selecting a session records
the current key as seen. Muting affects delivery only.

Delivery is eligible only when the notification preference is enabled,
permission is granted, the page is hidden, evidence is important and unread,
the session is unmuted, and its key was not delivered before. Successful
construction records the notified key atomically in the local record. Settings
contains a separate explicit permission button.

## Modules

- `apps/web/src/attention-inbox-model.ts`: schema, storage, cursor, mute, event
  key, and delivery predicate.
- `apps/web/src/attention-inbox-model.test.ts`: deterministic/fault cases.
- App effects and sidebar/inspector consumers.
- Preferences permission control and rendered tests.
- Compact unread/mute styles.

## Sequence

1. Commit issue and plan.
2. Add strict local state and policy with tests.
3. Integrate unread acknowledgement and per-session mute.
4. Add duplicate-safe browser delivery.
5. Add explicit settings permission control.
6. Synchronize docs and run full gates.
7. Merge and push to `dev`.

## Failure behavior

| Failure             | Behavior                                       |
| ------------------- | ---------------------------------------------- |
| Invalid local JSON  | Empty safe record                              |
| Storage write fails | In-memory UI continues; notice explains risk   |
| Permission default  | No delivery; explicit request remains          |
| Permission denied   | No retries or repeated prompts                 |
| Constructor throws  | Evidence stays unread; no delivered key stored |
| Session muted       | Attention stays visible; delivery suppressed   |
| Browser refresh     | Seen/notified/mute metadata restores           |

## Boundaries

- PTY/process lifecycle and reconnect are unchanged.
- No terminal bytes, cwd, prompts, or provider payload enter notification copy.
- Notification click selects/focuses only and is not an approval.

## Verification

- Focused model and component tests.
- Full `pnpm verify`.
- Existing Chromium keyboard/responsive suite.

## Approval

- Product: quiet by default and optimized for oversight.
- Architecture: browser-local personal metadata only.
- Security: explicit permission and no privileged notification action.
