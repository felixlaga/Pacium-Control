# PC-038: Recent activity summary

## Problem

Pacium exposes process attention, changed files, commit history, and
verification evidence in separate inspector views. Supervising several
terminals still requires opening those views one at a time and mentally
combining their facts. A generalized event journal or agent-written narrative
would duplicate existing sources of truth and could overstate what Pacium
actually observed.

## Outcome

The operator can open one compact Activity view for the selected terminal and
scan a deterministic, bounded summary of current attention, process lifecycle,
Git working-tree observations, recent local commits, and the latest
verification result. Every item identifies its source and whether its timestamp
means occurred or observed. Pacium never derives activity from terminal text or
presents agent narrative as fact.

## Scope

- A pure browser-side activity projection over existing selected-session
  evidence.
- Current attention and process-lifecycle facts.
- Fresh Git changes, recent current-branch history, and verification inspection
  through the existing authenticated requests.
- Stable source, kind, timestamp semantics, ordering, copy, and item ceilings.
- A lazy fifth Activity inspector tab with refresh, partial, empty, loading,
  and degraded states.
- Keyboard and narrow-inspector behavior consistent with the existing tabs.

## Non-scope

- A durable event log, unread activity cursors, database, JSONL journal, or
  generalized activity service.
- New WebSocket messages, protocol 10, filesystem watchers, polling, or
  automatic refresh.
- Parsing terminal output, prompts, queue text, provider prose, repository
  content, commit subjects, or verification output into inferred events.
- Claiming a live process is working, a clean exit completed an assigned task,
  or a commit was authored by the selected agent.
- Generating, accepting, or blending an agent narrative into deterministic
  facts.
- Notifications, activity filters, search, persistence, export, queue activity,
  or Pacium-mode grouping.

## Acceptance criteria

- [ ] Activity is built only from the selected session summary, its reduced
      attention result, and visible responses from existing repository changes,
      history, and verification requests.
- [ ] Opening Activity lazily requests missing Git and verification evidence;
      explicit Refresh requests all three again without sending terminal input
      or changing PTY selection or lifecycle.
- [ ] Current observations and occurred events use distinct labels and
      timestamp language.
- [ ] Process facts never promote process existence to confirmed work or a
      clean process exit to assigned-task completion.
- [ ] Git working-tree activity reports only totals and observation state;
      commit items remain labelled Git history and do not infer actor or task.
- [ ] Verification items report only the existing server-owned run state and
      result evidence; output is not interpreted or repeated in Activity.
- [ ] Items have deterministic identities and ordering, strict per-category and
      total ceilings, bounded copy, and no durable browser or server storage.
- [ ] Partial failures remain visible beside available facts and state that the
      terminal survives.
- [ ] Activity is a fifth semantic tab with complete keyboard navigation,
      focus, loading, empty, partial, refresh, reconnect, and 320 CSS px states.
- [ ] Unit, semantic UI, browser, security-boundary, production build, and full
      repository verification gates pass.

## User experience

Activity is the fifth compact inspector tab. Opening it starts bounded reads
only for evidence that has not yet been requested for the selected session.
The header shows whether the view is loading fresh facts, partially available,
or fully observed and offers one Refresh action.

The first section presents “Current evidence”: attention state, source,
confidence, freshness, and the exact bounded reason; process state is shown as
process evidence rather than task status. The second section presents “Recent
facts” newest first: session start or exit, the latest Git working-tree
observation, up to three current-branch commit records, and the current or
latest verification run. Labels such as “Observed” and “Occurred” explain the
timestamp semantics.

Unavailable sources render compact source-specific messages instead of hiding
the rest of the summary. Commit subjects and repository-derived labels are
untrusted text. There is no expandable agent narrative in this slice.

## Architecture

- Systems and modules touched: browser activity model, existing repository and
  verification view-state readers, inspector UI, styles, and browser workflow.
- Systems of record: PTY/session state owns process truth; the attention reducer
  owns the current evidence classification; Git owns repository and commit
  truth; the verification runner owns its current/latest result.
- State transitions: idle -> loading/partial -> ready or degraded; Refresh
  replaces each source only when its matching existing response is accepted.
- Protocol/schema impact: none; protocol 9 messages are reused unchanged.
- Relevant ADRs: ADR-0001, ADR-0005, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing exact Origin, local token, session ownership, and
  strict protocol validation protect every source request.
- Privilege: Activity performs no new process or filesystem operation; Refresh
  invokes the existing read-only Git inspections and verification inspect.
- Secrets/logging: terminal bytes, environment values, verification output, and
  repository file content are excluded from the projection and remain
  unlogged.
- Abuse/failure scenario: hostile commit subjects are rendered only as bounded
  React text; terminal and verification output cannot become activity copy,
  markup, links, commands, or status.

## Reliability

- Idempotency: opening and refreshing repeat read-only inspection requests;
  existing request identities reject stale and cross-session responses.
- Timeouts/retries: existing Git timeouts apply; there is no automatic retry or
  polling.
- Restart behavior: browser refresh reconstructs the projection from the live
  session list and newly inspected evidence; server restart retains no activity
  projection and direct-PTY limitations remain unchanged.
- Unknown outcome: unavailable or stale sources remain explicit and never
  become inferred success, failure, or work completion.
- Migration/rollback: no schema or durable state; removing the fifth tab and
  projection restores protocol-9 behavior.

## Test plan

- Unit: deterministic item IDs/order, source/timestamp semantics, category and
  total ceilings, invalid timestamps, process honesty, Git states, commit
  bounds, verification states, and partial evidence.
- Contract: no protocol change; regression-test that Activity refresh sends
  only the existing changes, history, and verification inspect messages.
- Integration: reuse current Git and verification server tests; no new
  server-side execution path.
- Browser: lazy load, current evidence, changed files, recent commit,
  verification result, refresh, partial error, tab keyboard navigation,
  selected terminal preservation, reconnect, and 320 CSS px layout.
- Failure/recovery: stale response, source timeout/error, session switch during
  load, disconnect/reconnect, no repository, unborn repository, and no presets.
- Security: hostile commit text remains text; terminal and verification output
  are absent; no command, terminal input, or persistence path is introduced.

## Dependencies

- Blocked by: PC-032 attention, PC-033 repository context, PC-034 changes,
  PC-036 history, and PC-037 verification presets.
- Blocks: PC-040 Pacium workspace configuration.

## Evidence required

- Pure-model tests covering all fact types, ordering, labels, bounds, and
  adversarial text.
- Semantic component tests for ready, loading, partial, degraded, and empty
  states.
- Browser evidence for lazy reads, Refresh, keyboard navigation, unchanged PTY
  selection, reconnect, and 320 CSS px layout.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized status, backlog, issue, plan, README, and changelog.

## Open questions

- Durable “since last checked” cursors and optional separately labelled agent
  narrative require an accepted local event-retention design. They remain
  deferred rather than being approximated with browser state.
