# Pin configured Meta and Orchestrator roles

## Problem

PC-041 can enter Pacium mode and show that Meta and Orchestrator bindings are
configured, but the operator still has to find the corresponding terminal in
the ordinary repository groups. A preset binding cannot be launched from the
role surface, an ended or restart-lost direct-session binding has no honest
recovery action, and an unconfigured workspace has no narrow browser path to
assign the first roles.

The current count card therefore proves configuration exists without making
the two primary Pacium sessions easier to supervise.

## Outcome

Pacium mode shows stable Meta and Orchestrator role cards before ordinary
terminal groups. Each card derives its state from the accepted workspace
binding, current PTY registry, connection, and fixed launch capabilities. The
operator can open a resolved session, launch a configured preset and bind the
created PTY explicitly, or change one role binding through a bounded editor.
Missing, ended, unavailable, saving, conflict, and disconnected states remain
honest and leave all terminal processes available.

## Scope

- Resolve accepted Meta and Orchestrator session or launch-preset bindings
  against current session summaries and launch capabilities.
- Render two stable role cards only in Pacium mode, before ordinary session
  groups.
- Open a resolved role session in the current focused terminal pane.
- Launch a configured fixed preset in its configured repository root or the
  server default working directory.
- After a successful role launch, replace only that role binding with the
  exact created session ID while preserving all other accepted workspace
  fields.
- Provide one role-scoped binding dialog for live Pacium sessions or fixed
  launch presets, with optional configured repository selection.
- Create the minimal version-1 workspace when assigning the first role from
  the unconfigured state.
- Show source, process evidence, preset/repository context, and direct-PTY
  restart limitations.
- Cover compact, narrow, zoomed, forced-color, focus, keyboard, reconnect, and
  failure states.

## Non-scope

- Prompt composition or targeting; PC-043 owns that interaction.
- Worker role rows or worker launching; PC-050 owns compact worker context.
- Queue, context, objective, plan, answer, delivery, decision, acknowledgement,
  verification, Git mutation, provider, tmux, or remote-access behavior.
- Editing repositories, workspace identity, workers, queue sources, delivery
  methods, context sources, or verification references.
- Adopting arbitrary Terminal.app, iTerm, shell, tmux, or provider processes.
- Inferring a role from a display name, launch preset, repository, terminal
  output, or process command.
- Making browser state or role-card presence a source of live-process truth.
- Automatically terminating an unbound PTY after a partial launch failure.
- Adding commands, arguments, environment variables, shell text, generic
  write targets, or another durable state file.

## Acceptance criteria

- [x] Pacium mode always presents Meta then Orchestrator with stable accessible
      labels; General mode presents neither role card.
- [x] A session binding resolves only by its immutable session ID. A current
      live session is labelled Connected, an ended session is labelled Ended,
      and an absent session is labelled Missing without name-based inference.
- [x] Opening a resolved role uses the existing tab, split, selection, attach,
      snapshot, and terminal-input path; it does not create or duplicate a PTY.
- [x] A launch-preset binding shows its exact fixed preset and configured
      repository or server-default directory. Unavailable presets and
      disconnected transport cannot be launched.
- [x] A successful preset launch creates one direct PTY through
      `session.create`, then replaces only that role binding with the exact
      created session ID at the accepted config revision.
- [x] If PTY launch fails, config is unchanged. If the PTY starts but role
      replacement fails, the new ordinary terminal survives visibly and the
      role remains unchanged until a fresh config read and explicit retry.
- [x] The binding editor lists only current live sessions not already assigned
      to another role/worker slot, plus server-owned available fixed presets.
- [x] Saving one role preserves workspace ID/label, repositories, the other
      role, workers, queue sources, delivery methods, and context byte-for-byte
      at the browser contract level.
- [x] First setup creates only the minimal strict workspace and the selected
      role; it reads or creates no queue/context/delivery path.
- [x] Config replacement uses the accepted revision, disables duplicate
      submission, never blindly retries a conflict/lost response, and performs
      an explicit fresh get for recovery.
- [x] Config loading, unconfigured, invalid/error, replacing, disconnected,
      unavailable-preset, ended, and missing states say what is known and which
      terminals survived.
- [x] Role actions are available by mouse and keyboard, use visible focus, and
      remain usable at 320 CSS px, 200% zoom, forced colors, and reduced motion.
- [x] No protocol/schema expansion or terminal-byte parsing is introduced.
- [x] Focused tests, `pnpm verify`, and `pnpm test:e2e` pass with synchronized
      issue, plan, status, backlog, README, and changelog evidence.

## User experience

In Pacium mode, two compact cards sit below the workspace definition and above
the ordinary session groups:

```text
Primary roles
┌ Meta ────────────────┐ ┌ Orchestrator ─────────┐
│ Connected · Codex    │ │ Ready to launch       │
│ pacium-control       │ │ Claude · default cwd  │
│ [Open] [Change]      │ │ [Launch] [Change]     │
└──────────────────────┘ └────────────────────────┘
```

Role state and primary action:

| Evidence                                    | Visible state         | Primary action |
| ------------------------------------------- | --------------------- | -------------- |
| Accepted live session binding               | Connected             | Open           |
| Accepted ended session binding              | Ended                 | Change         |
| Accepted session ID absent from registry    | Missing after restart | Change         |
| Accepted available launch-preset binding    | Ready to launch       | Launch         |
| Accepted unavailable launch-preset binding  | Preset unavailable    | Change         |
| Null role in a ready workspace              | Not assigned          | Assign         |
| Unconfigured workspace                      | Setup needed          | Assign         |
| Loading/replacing/disconnected/config error | Exact bounded state   | Retry or wait  |

The Change/Assign dialog edits one role. “Running session” choices display
process, command, and compact directory evidence. “Launch preset” choices show
fixed capability availability and configured repository roots. Saving never
starts a process. Launching closes no existing terminal and selects the newly
created PTY through the existing session-created flow.

The two-step launch is disclosed honestly: process creation succeeds before
the durable binding update is attempted. If the update is rejected or its
result is unknown, the terminal remains in the ordinary list and Pacium asks
the operator to refresh configuration and bind it explicitly.

## Architecture

- Systems and modules touched: browser role-state projection, role-card
  presentation, role-binding editor/model, app transport orchestration,
  session-created correlation, command presentation, styles, unit/semantic/E2E
  tests, and documentation.
- Systems of record: accepted `pacium.config` owns binding intent; the session
  registry owns PTY existence and process state; launch capabilities own preset
  availability; configured repositories own launch cwd; browser state owns
  only dialog and in-flight correlation.
- State transitions: unconfigured/null -> configured binding; preset ready ->
  launch pending -> PTY created -> config replacing -> bound session or
  surviving unbound terminal; session live -> ended/missing based only on
  registry evidence; disconnect interrupts requests without killing PTYs.
- Protocol/schema impact: none. Reuse protocol-10 config get/replace and
  existing session create/created messages.
- Relevant ADRs: ADR-0007, ADR-0010, ADR-0013, ADR-0014, and ADR-0015.

## Security and privacy

- Authorization: role saves reuse authenticated Origin/token-protected complete
  config replacement; launches reuse the existing authenticated fixed-preset
  session-create operation.
- Privilege: no new command surface. Presets run with the invoking local
  user's existing authority.
- Secrets/logging: no terminal bytes, environments, content files, tokens, or
  provider data are stored or logged.
- Abuse/failure scenario: hostile labels and paths render as text; the editor
  constructs only strict known bindings; duplicate session assignments are
  excluded and still rejected server-side; queue/config text is never
  executed.

## Reliability

- Idempotency: selecting/opening is view-only; saving uses optimistic revision;
  launch itself is intentionally not blindly repeatable.
- Timeouts/retries: no polling. A failed or unknown launch/bind sequence
  requires fresh session/config evidence and explicit operator action.
- Restart behavior: direct PTYs end with the server. Persisted session IDs
  become Missing until explicitly changed; preset bindings remain launchable.
- Unknown outcome: after a lost config response, get current config before
  retry. After a created PTY with failed binding, preserve and disclose the
  terminal.
- Migration/rollback: no schema migration. Removing the role UI restores the
  PC-041 presentation while existing config and PTYs remain valid.

## Test plan

- Unit: role resolution matrix, exact session-ID matching, preset capability
  and repository projection, other-slot exclusion, minimal workspace creation,
  one-role immutable replacement, and launch correlation.
- Contract: prove existing strict binding and protocol-10 schemas remain
  unchanged and reject authority fields.
- Integration: create request correlation followed by exact role replacement;
  failed create; stale revision; reconnect interruption; session exit and
  restart-loss projection.
- Browser: assign from unconfigured, configure a preset, launch/bind/open,
  switch General/Pacium, preserve selected pane/inspector, ended/missing copy,
  modal focus return, narrow/zoom/forced-color/reduced-motion access.
- Failure/recovery: unavailable preset, disconnected client, duplicate role
  selection, config error, replacement conflict, response loss, and new
  unbound terminal survival.
- Security: text-only hostile labels/paths, no arbitrary cwd/command from role
  actions, bounded modal inputs, and no queue/content/terminal parsing.

## Dependencies

- Blocked by: PC-040 and PC-041.
- Blocks: PC-043 prompt targeting and PC-050 role-aware worker context.

## Evidence required

- Small coherent commits separating issue, plan, projection, editor model,
  role presentation, orchestration, accessibility, browser evidence, and docs.
- Unit and semantic evidence for every role/config/connection/process state.
- Integration evidence that a successful created session becomes the exact
  accepted role binding and partial failure leaves the PTY available.
- Browser evidence for setup, launch, open, mode preservation, responsive
  access, and focus.
- `pnpm verify`, `pnpm test:e2e`, clean worktree, exact-head commit list, and
  synchronized documentation.

## Open questions

- PC-043 decides whether its prompt target selector lives in the workspace
  footer or a dedicated composer; PC-042 exposes no prompt input.
- Optional tmux bindings require a future schema/adapter slice and are not
  represented as direct-session bindings.

## Completion evidence

- `pnpm verify` passed formatting, lint, all workspace type checks, 72 test
  files and 380 tests, plus the 787.01 kB web and 166.07 kB local-server
  production bundles.
- `pnpm test:e2e` passed all nine Chromium workflows with disposable
  server-owned Pacium state.
- Unit and semantic evidence covers exact-ID role resolution, every process and
  config state, disconnected evidence, preset/repository availability,
  occupied-slot filtering, minimal workspace construction, one-role immutable
  replacement, strict create correlation, hostile text, and dialog actions.
- Real browser evidence assigned an existing PTY to Meta, opened it without
  duplication, changed modes without context loss, assigned an Orchestrator
  fixed preset, launched one PTY, bound its exact created session ID, and
  restored both roles after refresh.
- Responsive browser evidence covers two stable cards, modal first/return
  focus, 320 CSS px, 200% zoom, forced colors, and reduced motion.
- The implementation is split across 22 coherent commits before issue, plan,
  and changelog closeout.
