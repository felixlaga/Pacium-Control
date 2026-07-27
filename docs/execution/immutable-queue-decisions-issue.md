# PC-047: Record immutable local queue decisions

## Problem

Pacium can show the exact current text of one configured queue candidate, but
the inspector is deliberately read-only. The operator still has to leave
Pacium and edit another surface to answer a question or decide an approval.
Adding a generic text response would be unsafe: an ordinary answer could be
mistaken for permission, a browser retry could create a second decision, and a
restart could forget that an item was already decided.

## Outcome

From the exact current item inspector, the local operator can answer a
question, approve one explicit approval request, or deny it. Pacium records one
attributable, hash-verified, immutable decision for that exact source identity
in minimal private local state. Reload and local-server restart recover the
decision without reapplying or delivering it. Questions and approvals use
different protocol payloads, controls, and confirmation behavior.

## Scope

- Add strict, separate question-answer and approval-decision schemas.
- Bind every request to the exact current workspace, source, observation,
  content hash, boundary, item ID, and classified item type.
- Record server-owned actor label, timestamp, optional bounded note, and a
  SHA-256 decision hash.
- Add a versioned, bounded `queue-state.json` file containing immutable
  decisions and no queue source text.
- Validate ownership, mode, file type, schema, decision hashes, uniqueness, and
  bounds before accepting existing state.
- Serialize writes and atomically replace the complete file through a private
  same-directory temporary file, file sync, rename, and directory sync.
- Recover the current item's existing decision during exact inspection.
- Add question answer UI and a separate two-step approve/deny confirmation UI.
- Disable decisions when item evidence is stale or decision state is
  unavailable.
- Preserve queue sources, terminals, configuration, and delivery targets.

## Non-scope

- Writing answer files, sending prompts, terminal input, provider callbacks, or
  any other delivery side effect.
- Acknowledgement, applied state, automatic retry, superseding decisions, or
  full conflict resolution.
- Parsing an approval action, command, target, risk, or expiry from free text.
- Decisions for failure, review, or unknown classifications.
- Editable identity claims, accounts, multi-user authorization, or a database.
- Bulk recent-decision history, activity timelines, notifications, or queue
  prioritization.
- Persisting original queue text, terminal output, provider data, or secrets.

## Acceptance criteria

- [ ] A current `question` accepts only the question-answer request schema and
      records a nonblank bounded answer.
- [ ] A current `approval` accepts only the approval-decision request schema
      and records exactly `approved` or `denied`.
- [ ] A question answer cannot produce approval permission, and an approval
      endpoint cannot decide a question.
- [ ] Approve and Deny are labelled separately and require a deliberate second
      confirmation while the exact request remains visible.
- [ ] The server revalidates the complete current item identity and type
      immediately before persistence.
- [ ] Each record includes exact source identity, server-owned
      `Local operator` attribution, server timestamp, optional bounded note,
      and a recomputable SHA-256 decision hash.
- [ ] `queue-state.json` is private, bounded, versioned, schema-validated,
      hash-validated, and replaced atomically without modifying prior records.
- [ ] Repeating the same exact payload returns the existing record without a
      second write; a different decision for the same item is rejected and
      preserves the first record.
- [ ] Reload and local-server restart expose the existing decision and no
      longer offer active decision controls for that item.
- [ ] Missing decision state starts safely; corrupt, unsafe, unsupported, full,
      or durability-unknown state is visible and never overwritten blindly.
- [ ] Source rewrites, config drift, disconnects, late responses, or
      classification mismatch cannot create a decision.
- [ ] No queue source, answer target, terminal, provider, Git repository, or
      `pacium.json` content is changed.
- [ ] Focused, contract, integration, browser, security, full verification, and
      production-build evidence pass.

## User experience

A ready question inspector adds an **Answer** section below the exact original
text. It contains a bounded plain-text answer field, an optional note field,
and a labelled **Record answer** button. The copy states that recording does
not deliver the answer. Enter inserts a newline; the operator activates the
button explicitly. Terminal shortcuts remain suspended only while the text
field owns focus.

A ready approval inspector instead shows **Approval decision** with separate
**Approve** and **Deny** controls. Selecting either opens an inline
confirmation naming the exact outcome and source. The original request stays
visible. **Confirm approval** or **Confirm denial** records the decision;
**Cancel** returns without mutation. An ordinary question never renders these
controls.

While a decision request is pending, inputs and actions are disabled and copy
says no delivery is occurring. On success, the form is replaced by a compact
immutable record: outcome, actor label, decision time, full decision hash,
source identity, answer or approval result, optional note, and “Not delivered
yet.” Reopening after refresh or restart shows the same record.

If the item changed, decision state is unsafe, or persistence outcome is
unknown, the inspector explains what happened, confirms which files and
processes survived, and offers only a deliberate refresh/reopen path. It never
silently retries.

## Architecture

- Systems and modules touched: shared queue-decision and protocol contracts;
  local decision-state store and service; queue/WebSocket integration; browser
  transport, reducer, forms, inspector, and styles; tests and active docs.
- Systems of record: configured queue files own source text; accepted
  `pacium.json` owns workspace/source definitions; the queue observer owns
  current exact runtime evidence; `queue-state.json` owns Pacium's immutable
  local decisions; the browser owns only drafts, confirmation, request
  correlation, and focus.
- State transitions: open current item -> draft -> submitting -> decided;
  repeated same payload -> existing decided record; different second payload
  -> rejected/already decided; stale/config drift/disconnect -> no decision;
  store failure -> unavailable/unknown with no automatic retry.
- Protocol/schema impact: protocol 14 adds strict question-answer and
  approval-decision requests, a bounded decision result, and decision-state
  detail on exact item inspection. Pacium config schema remains version 1.
- Relevant ADRs: ADR-0001, ADR-0012, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: existing authenticated WebSocket, Host/Origin, and local-token
  checks remain required. The server, not the browser, assigns the current
  `Local operator` actor label.
- Privilege: recording application-owned metadata only. A decision grants no
  command, filesystem-delivery, terminal-input, provider-callback, or
  repository-write authority.
- Secrets/logging: queue source text, answer/note bodies, state-file content,
  terminal bytes, environments, and tokens never enter logs or safe error
  messages. Answer and note fields are bounded but may still contain sensitive
  operator text, so the file remains mode `0600`.
- Abuse/failure scenario: forged item IDs, type confusion, hostile Unicode,
  oversized input, duplicate requests, symlink replacement, unsafe ownership,
  hash tampering, partial writes, config/source drift, and disconnected clients
  fail closed without changing source files or terminals.

## Reliability

- Idempotency: one immutable record per exact queue-item identity. An identical
  replay returns the record; a differing replay is rejected.
- Timeouts/retries: no automatic retry. After disconnect or
  durability-unknown failure, inspect durable state before another deliberate
  submission.
- Restart behavior: validate and reload `queue-state.json`; re-observe queue
  sources; join only an exact current item to its stored record.
- Unknown outcome: a directory-sync failure after rename reports unknown
  durability. The browser clears pending state on disconnect and does not
  infer success or failure.
- Migration/rollback: missing file means no decisions. Protocol rollback can
  ignore a valid `queue-state.json`; it must not delete or rewrite it.

## Test plan

- Unit: decision schemas, canonical hash, unique identity, identical replay,
  differing replay, store bounds, private paths, atomic replacement, and
  browser reducer/form state.
- Contract: separate messages, item/type constraints, fixed actor, timestamps,
  hashes, forbidden extras, bounds, and protocol 14 fixtures.
- Integration: authenticated real-file answer/approve/deny, exact revalidation,
  restart recovery, duplicate replay, differing replay, stale rewrite, config
  drift, corrupt/unsafe state, injected atomic failures, and unchanged external
  bytes/processes.
- Browser: question answer, approval confirm/cancel/deny, immutable result,
  reload, stale/disconnected/error states, focus, terminal ownership, 320 CSS
  px, 200% zoom, forced colors, and reduced motion.
- Failure/recovery: missing/full/corrupt/unsupported/unsafe decision state,
  write failure before rename, unknown durability after rename, late response,
  and concurrent requests.
- Security: question/approval type confusion, forged actor/identity/hash,
  hostile input rendered inertly, no logs, no delivery, no terminal input, and
  source/config byte preservation.

## Dependencies

- Blocked by: PC-044 queue observation, PC-045 classification, and PC-046 exact
  item inspection.
- Blocks: PC-048 compatible decision delivery, PC-049 acknowledgement and
  conflict handling, and PC-050 recent decisions/activity.

## Evidence required

- Focused contract/store/server/browser tests proving separation, immutability,
  idempotency, restart recovery, and atomic failure behavior.
- Authenticated integration evidence with exact before/after queue,
  `pacium.json`, delivery target, and live PTY evidence.
- Playwright evidence for answer and explicit approval confirmation, reload
  recovery, keyboard/focus safety, and responsive/accessibility states.
- A file inspection proving private modes and no raw queue source text.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes recorded.
- Small coherent commit history, clean branch, fast-forward merge into `dev`,
  and pushed exact `origin/dev` head.

## Open questions

- PC-049 will define visible superseding/conflict records. PC-047 preserves and
  rejects a differing second decision instead of creating one.
- PC-048 will own delivery identity and state. PC-047 records “not delivered”
  and performs no compatibility action.
- Future verified Tailscale identity may replace the fixed local actor label
  through a separate authenticated transport decision; the browser cannot
  claim an actor in this slice.
