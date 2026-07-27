# Send one bounded prompt to an explicit Pacium target

**Status:** Complete

## Problem

PC-042 makes Meta and Orchestrator visible and actionable, but communicating
with them still requires selecting the terminal and typing manually. Pacium
has no visible prompt target, no worker target choice, and no safe distinction
between the terminal currently on screen and the session that should receive a
message.

A hidden or sticky target would make it easy to send a prompt to the wrong
agent. A generic multiline composer could also turn pasted line breaks or
control bytes into unintended shell input.

## Outcome

Pacium mode adds one compact prompt composer above the workspace status. The
operator explicitly chooses Meta, Orchestrator, or a configured worker whose
exact session binding is currently live, enters one bounded control-free
single-line prompt, reviews the visible target, and deliberately sends it
through the existing authenticated `terminal.input` operation. Accepted
transport acknowledgement clears the draft and target; failure or unknown
outcome never retries automatically and never claims the agent processed the
prompt.

## Scope

- Project configured Meta, Orchestrator, and worker bindings into explicit
  target options using exact session IDs and current process evidence.
- Show unavailable preset, missing, starting, ending, ended, failed, and
  disconnected targets without allowing send.
- Render a compact Pacium-only target selector, prompt field, target evidence,
  boundary copy, character count, and Send action above workspace status.
- Limit prompts to 4,000 Unicode characters with no C0/C1 controls or line
  breaks; append exactly one carriage return only after deliberate send.
- Correlate the existing `terminal.input` request ID with
  `command.result`/`error`.
- Clear prompt and target only after accepted command result.
- On error retain the draft and target for correction; on disconnect retain the
  draft but clear the target and require inspection before explicit reselection.
- Clear draft and target when leaving Pacium mode.
- Support pointer, keyboard, `Cmd/Ctrl+Enter`, narrow, zoomed, forced-color,
  focus, and reduced-motion use.

## Non-scope

- Provider-native prompts, conversations, turns, delivery receipts, semantic
  acknowledgement, completion, usage, or message history.
- Queue answers, decisions, approvals, delivery methods, or role-prompt queue
  delivery.
- Multiline prompts, pasted terminal control sequences, files, images,
  attachments, slash-command interpretation, or template expansion.
- Persisting prompt drafts, selected targets, prompt history, terminal input,
  provider content, or acknowledgement state.
- Launching or rebinding a target from the composer.
- Inferring targets from display name, selected terminal, repository, preset,
  process command, terminal output, or provider text.
- Sending to launch-preset bindings, missing/ended sessions, or workers without
  an exact current live session binding.
- Granting approval or execution authority through an ordinary prompt.
- Protocol/schema expansion, generic command endpoints, queue reads/writes,
  worker UI, or provider adapters.

## Acceptance criteria

- [x] The composer exists only in Pacium mode and never displaces, remounts, or
      changes the selected terminal, split layout, inspector, or keyboard
      capture without explicit focus.
- [x] Targets are derived only from the accepted workspace and exact current
      session IDs; Meta, Orchestrator, then workers use stable labels and
      explicit availability text.
- [x] No target is selected by default, on refresh, after leaving/re-entering
      Pacium, after successful send, or after a disconnected unknown outcome.
- [x] Only an exact live session binding can send. Preset, missing, creating,
      closing, ended, failed, invalid-config, loading, replacing, and
      disconnected states remain visible but disabled.
- [x] The prompt is at most 4,000 Unicode characters, non-empty after trimming,
      and contains no C0/C1 controls or line breaks.
- [x] Send transmits exactly the trimmed prompt plus one `\r` to the chosen
      immutable session ID through the existing `terminal.input` message.
- [x] The UI disables duplicate send while its exact request is pending and
      ignores unrelated `command.result` or error responses.
- [x] Accepted command result clears draft/target and says only that terminal
      input was accepted; it does not claim delivery to or processing by an
      agent.
- [x] A rejected input retains draft/target and explains no automatic retry. A
      disconnect retains the draft, clears target, labels outcome unknown, and
      requires terminal inspection before reselection.
- [x] Leaving Pacium mode clears draft/target without sending; returning to
      Pacium starts unscoped.
- [x] Ordinary prompts remain distinct from queue questions and approvals and
      grant no new permission or durable decision.
- [x] Pointer, labelled controls, visible focus, and `Cmd/Ctrl+Enter` work at
      desktop, 320 CSS px, 200% zoom, forced colors, and reduced motion without
      leaking shortcuts into terminal capture.
- [x] No protocol version, server operation, durable file, content read,
      provider state, or queue behavior is added.
- [x] Focused tests, `pnpm verify`, and `pnpm test:e2e` pass with synchronized
      issue, plan, README, status, backlog, and changelog evidence.

## User experience

The composer sits below the terminal canvas and above the existing connection
status:

```text
Prompt target  [ Select target ▾ ]  No target selected
┌ Message the selected terminal…                         0 / 4000 ┐
└─────────────────────────────────────────────────────────────────┘
Raw terminal input · one line · agent handling is not confirmed
                                                     [ Send prompt ]
```

The target selector lists configured identities in stable order:

- `Meta — Connected`, when its exact session is live;
- `Orchestrator — Missing`, `Ready to launch`, or another honest disabled
  state;
- configured workers in workspace order, with their explicit labels and
  session state.

Selecting a target never changes the visible terminal. The chosen target name,
session command, and compact cwd remain visible beside the field. Send requires
a button click or `Cmd/Ctrl+Enter` while the prompt field owns focus. Plain
Enter cannot add a terminal newline; pasted line breaks or control characters
make the draft invalid until removed.

Success copy is “Terminal input accepted for Meta. Agent handling is not
confirmed.” Error and disconnect copy states that no automatic retry occurs.

## Architecture

- Systems and modules touched: pure target projection and prompt validation,
  semantic composer, App ephemeral state and request correlation, transport
  request-ID return, styles, unit/semantic/E2E tests, and docs.
- Systems of record: accepted config owns target identity; PTY registry owns
  live process state; existing terminal input path owns transport acceptance;
  browser owns only ephemeral draft/selection/pending intent.
- State transitions: unscoped -> selected valid target -> valid draft -> send
  pending -> accepted/failed/unknown; mode exit -> unscoped empty; target drift
  -> unscoped with draft retained.
- Protocol/schema impact: none; reuse protocol 10 `terminal.input`,
  `command.result`, and typed error.
- Relevant ADRs: ADR-0007, ADR-0010, ADR-0012, ADR-0013, ADR-0014, and
  ADR-0015.

## Security and privacy

- Authorization: reuse existing exact Origin/token-protected WebSocket input.
- Privilege: input reaches the foreground process with the invoking user's
  existing authority; UI discloses the raw-terminal boundary.
- Secrets/logging: prompt text is ephemeral, not logged, persisted, notified,
  or copied into activity/config.
- Abuse/failure scenario: controls/newlines are rejected, target identity is a
  typed option rather than user text, hostile labels render as text, and no
  queue/repository content becomes executable input.

## Reliability

- Idempotency: prompt input is not idempotent. One pending request locks send;
  failure/unknown outcome never retries automatically.
- Timeouts/retries: no timer or polling; reconnect requires explicit target
  reselection.
- Restart behavior: draft and target are browser-ephemeral; direct PTYs end
  with server restart and become untargetable.
- Unknown outcome: retain draft, clear target, inspect terminal, then decide
  whether to send again.
- Migration/rollback: no schema or persisted state. Removing the composer
  restores PC-042 unchanged.

## Test plan

- Unit: stable target ordering, exact-ID resolution, worker bindings, all
  process/config/connection states, target invalidation, Unicode bounds,
  control/newline rejection, exact `prompt + \r`, and response correlation.
- Contract: existing `terminal.input` bound and strict message tests remain
  green; no protocol diff.
- Integration: matching/nonmatching command result, typed error, disconnect,
  mode exit, target drift, and no duplicate send.
- Browser: choose Meta and worker targets, visible target differs from selected
  terminal, send to a real PTY, acknowledgement copy, reset, General/Pacium
  reset, keyboard send, invalid paste, focus, narrow/zoom/forced colors.
- Failure/recovery: missing/ended target, unavailable preset, config error,
  disconnect pending/idle, server rejection, and unrelated response.
- Security: hostile labels, C0/C1/control input, no queue/provider/persistence,
  and ordinary prompt cannot become approval.

## Dependencies

- Blocked by: PC-040 through PC-042.
- Blocks: PC-048 role-prompt compatibility delivery and PC-050 worker context.

## Evidence required

- Small coherent commits for issue, plan, target model, prompt model, composer,
  transport correlation, App orchestration, styling, browser coverage, and docs.
- Exact unit/semantic evidence for target and prompt boundaries.
- Real browser evidence that prompt input reaches only the explicit target PTY,
  acknowledges only transport acceptance, and resets scope safely.
- `pnpm verify`, `pnpm test:e2e`, clean exact-head history, and synchronized
  docs.

## Open questions

- Provider-native structured prompting remains Milestone 4 and must not reuse a
  terminal-input acknowledgement as semantic delivery evidence.
