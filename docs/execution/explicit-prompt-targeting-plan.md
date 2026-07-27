# Implementation plan: Explicit Pacium prompt targeting

- Issue: [PC-043](explicit-prompt-targeting-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/explicit-prompt-targeting`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `953997ba408bc841cf48822e508ee107d5af3ea8`
- Target milestone: Milestone 3
- Status: Complete

## Objective

Add one restrained Pacium-only composer that makes the terminal input target
explicit, bounded, and short-lived. Reuse exact configured bindings and the
existing PTY input operation without introducing provider claims, multiline
shell injection, prompt persistence, queue delivery, or another protocol.

## Existing behavior

- PC-042 resolves Meta and Orchestrator session bindings by immutable ID and
  exposes honest unavailable states.
- Protocol-10 workspace config already contains worker labels and bindings.
- `PaciumTransport.input` generates a request ID internally and sends a bounded
  `terminal.input`; the server responds with `command.result` or typed error.
- The App ignores generic command results because current terminal typing does
  not need an acknowledgement UI.
- Browser mode, session, layout, inspector, and keyboard ownership are already
  distinct.

## Proposed behavior

1. Derive stable Meta, Orchestrator, and worker targets from accepted config and
   current exact session summaries.
2. Render all configured identities with honest state; enable only live exact
   session bindings.
3. Require explicit ephemeral target selection and a valid control-free
   single-line prompt.
4. Send trimmed text plus one carriage return through existing terminal input.
5. Correlate the exact request result, lock duplicate send, and distinguish
   accepted, failed, and unknown outcomes.
6. Reset scope after accepted send, disconnect, target drift, refresh, and mode
   exit according to the issue contract.

## Architecture and boundaries

### Modules touched

- `apps/web/src/pacium-prompt-target-model.ts`: target identity/state/order and
  exact live-session resolution.
- `apps/web/src/pacium-prompt-model.ts`: draft validation, exact terminal input,
  pending/result transitions, and scope reset.
- `apps/web/src/pacium-prompt-composer.tsx`: semantic target selector, prompt
  field, evidence, count, boundary copy, and deliberate Send.
- `apps/web/src/transport.ts`: return the already-generated terminal-input
  request ID; no wire change.
- `apps/web/src/app.tsx`: ephemeral prompt state, target drift/mode reset,
  request/result/error/disconnect correlation, and notices.
- `apps/web/src/styles.css`: terminal-primary compact composer and responsive,
  zoom, focus, reduced-motion, and forced-color behavior.
- Focused unit, semantic, transport, and Playwright tests.

### Data/state changes

- Entity/schema changes: none.
- Browser-only ephemeral state: prompt draft, selected target ID, and optional
  pending `{requestId,targetId,sessionId}`.
- Commands/events: existing `terminal.input`, `command.result`, and `error`.
- Idempotency: input is non-idempotent; one pending request blocks another and
  unknown outcome never retries.
- Migration: none.

### Protocol changes

- Protocol remains version 10.
- `PaciumTransport.input` returns its existing generated request ID.
- Payload remains exact immutable session ID plus bounded string. The browser
  adds no target label, role, provider, command, permission, or content field.

### Authorization and privilege

- Target option values come only from accepted config/session projection.
- Only a current exact live session can reach transport input.
- Prompt validation rejects C0/C1 controls and line breaks before transport.
- One appended `\r` is the only generated terminal control.
- Sending ordinary input grants no queue approval or durable decision.

## UI behavior and states

| Evidence                                   | Selector/composer state                         |
| ------------------------------------------ | ----------------------------------------------- |
| General mode                               | Composer absent; scope/draft empty              |
| Config loading/unconfigured/error          | Empty/disabled with exact explanation           |
| Config ready, role/worker null or preset   | Identity visible but disabled                   |
| Exact session missing/ended/failed/closing | Identity visible with honest disabled state     |
| Exact session live, connected              | Selectable target                               |
| Selected live target, blank/invalid draft  | Send disabled; inline reason                    |
| Selected live target, valid draft          | Send enabled; target evidence visible           |
| Input request pending                      | Selector/field locked; “Sending…”               |
| Matching command result                    | Draft/target cleared; bounded notice            |
| Matching error                             | Draft/target retained; explicit no retry        |
| Disconnect pending                         | Draft retained; target cleared; outcome unknown |
| Target binding/process drift               | Draft retained; target cleared                  |

Target selection never changes the terminal on screen. The composer sits above
`WorkspaceStatus`, so the terminal remains the largest and strongest surface.

## PTY/process lifecycle

- Composer creates, attaches, interrupts, resizes, closes, or relaunches no PTY.
- Input goes to the foreground process of one exact current live session.
- Browser refresh creates no replay because draft, target, and pending intent
  are not persisted.
- Process exit immediately invalidates selection without sending.
- A local-server restart ends direct PTYs and makes all direct role/worker
  targets unavailable until explicitly rebound.

## Reconnect and failure behavior

- Idle disconnect retains draft, clears target, and disables send.
- Pending disconnect marks outcome unknown, retains draft, clears target, and
  requires terminal inspection.
- Matching server error retains draft/target when still valid and allows only
  explicit later action.
- Unrelated command result/error cannot clear or mutate prompt state.
- Accepted result means only that the server handed bytes to the PTY input
  operation, not that an agent read, processed, or completed the prompt.

## Sequence

1. Commit issue and plan separately.
2. Implement target projection and full state-matrix tests.
3. Implement prompt validation/input/result reducer and tests.
4. Build semantic composer and hostile-text tests.
5. Return terminal-input request IDs and test exact existing payload.
6. Wire App target/draft/pending state and response correlation.
7. Wire mode exit, target drift, disconnect, and focus behavior.
8. Add compact responsive/forced-color styling.
9. Add real browser explicit-target/send/reset/accessibility evidence.
10. Synchronize README, status, backlog, issue, plan, and changelog.
11. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect exact history,
    fast-forward into `dev`, and push.

## Failure model

| Failure point                  | Expected state                              | Recovery                           |
| ------------------------------ | ------------------------------------------- | ---------------------------------- |
| No config/live target          | No send; terminal workspace unchanged       | Configure/rebind target            |
| Invalid prompt/control/newline | No send; inline error                       | Edit draft                         |
| Target exits before send       | Selection cleared; draft retained           | Inspect and explicitly reselect    |
| Input rejected                 | Draft/valid target retained; no retry       | Inspect reason and choose action   |
| Disconnect before result       | Outcome unknown; draft kept; target cleared | Inspect terminal after reconnect   |
| Unrelated result/error         | Pending state unchanged                     | Wait for exact correlated response |
| Browser refresh                | Draft/target/pending discarded; no replay   | Compose again explicitly           |
| Switch to General              | Draft/target discarded; no send             | Re-enter Pacium unscoped           |
| Server restart                 | Direct targets unavailable/ended            | Explicit rebind/relaunch           |

## Compatibility

- Supported versions: protocol 10, schema 1, direct PTY targets.
- Fallback: General mode and ordinary terminal typing are unchanged; Pacium
  composer disables when exact evidence is insufficient.
- Rollback: remove composer/model/correlation. No state migration or process
  cleanup is required.

## Test plan

- Unit: stable target ordering/IDs/labels, exact binding resolution, every
  process/config/connection state, worker options, scope invalidation,
  Unicode/control bounds, exact appended carriage return, and request reducer.
- Property/fault: arbitrary labels/order, stale target IDs, 4,000/4,001
  Unicode boundaries, C0/C1 set, mismatched results, repeated send, and
  disconnect timing.
- Contract: existing terminal input bound/strictness stays green.
- Integration: App request correlation for result/error/disconnect/mode/target
  drift.
- Browser: explicit target differs from selected terminal, real PTY input,
  success reset, invalid paste, keyboard send, no General carryover, refresh,
  narrow/zoom/forced colors/reduced motion/focus.
- Security: no multiline/control injection, no arbitrary session ID, no
  persistence/logging/queue approval/provider claim.
- Performance: bounded option/draft lists, no polling, watcher, parser, history,
  provider adapter, or new persistence.

## Documentation changes

- Update README current-slice and Pacium behavior.
- Mark PC-043 complete and PC-044 next in status/backlog/issue/plan.
- Add changelog evidence/limitations.
- Do not describe provider delivery, queue delivery, worker UI, or semantic
  acknowledgement as implemented.

## Rollout

- Development: use Shell fixtures to observe exact bytes without provider
  semantics, then configured Meta/Orchestrator/worker fixtures.
- Integration: unit, semantic, transport, PTY, and full browser regressions.
- Canary: localhost development only with disposable sessions/state.
- Production: none; project remains pre-release.

## Open questions

- Multiline/provider-native prompts wait for capability-aware Milestone 4
  adapters.
- PC-048 may reuse explicit role identity for configured compatibility
  delivery, but not the browser composer's ephemeral acknowledgement.

## Completion evidence

- Target, prompt-state, semantic composer, and transport tests passed 41 focused
  assertions before the full gate.
- `pnpm verify` passed formatting, lint, all workspace type checks, 75 test
  files and 410 tests, the 794.93 kB web build, and the 166.07 kB local-server
  build.
- `pnpm test:e2e` passed all nine Chromium workflows.
- The PC-043 workflow sent a marker to a bound Meta shell while an ordinary
  terminal stayed selected, observed the marker only after opening Meta, and
  proved success, invalid multiline input, mode-exit reset, and refresh reset.
- Accessibility workflows proved labelled fields, visible focus, 320 CSS px,
  200% zoom, forced colors, and reduced motion.
- No protocol, schema, server operation, durable prompt file, queue read/write,
  provider adapter, or process-lifecycle behavior changed.

## Approval

- Product: provides the simplest visible communication path without hiding the
  terminal or target.
- Architecture: config owns identity, PTY owns process/input truth, browser owns
  ephemeral intent, and provider semantics remain absent.
- Security: one bounded control-free line, one visible exact target, and one
  deliberate existing input operation add no generic command authority.
