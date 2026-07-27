# PC-049: Reconcile delivered decisions and surface queue conflicts

## Problem

Pacium can record and compatibly deliver one immutable decision, but it stops
at transport evidence. The operator cannot tell whether an answer-file
artifact still matches Pacium's payload, whether a requester acknowledged or
applied a decision, or whether a later queue rewrite conflicts with an earlier
decision. Failed and unknown attempts are deliberately terminal, so even an
operator who verifies that no side effect occurred has no bounded recovery
path.

Treating a missing answer file or rewritten queue source as acknowledgement
would be dishonest. Silently accepting a second answer, retrying an uncertain
terminal write, or choosing between duplicate sources would be unsafe.

## Outcome

The queue and exact-item inspector show content-free, evidence-labelled
conflicts for source rewrites/degradation, duplicate current items, changed
answer targets, unknown delivery, and competing decisions. A decided item
shows transport-artifact evidence separately from provider acknowledgement or
application. The operator can append a bounded human-labelled lifecycle
resolution, and can make one explicit retry only after confirming that a
failed or unknown first attempt did not deliver.

No filesystem observation is promoted to provider acknowledgement, no queue
source is modified, and no conflict is resolved silently.

## Scope

- Add strict content-free queue conflict evidence for:
  - a stable current item whose identity differs from a prior decision for the
    same accepted workspace/source;
  - a decided source that becomes empty, missing, changing, truncated,
    oversized, invalid, unsafe, unreadable, or unwatched;
  - identical current content appearing in more than one accepted source;
  - a different answer/outcome submitted for one exact immutable decision;
  - an unknown delivery attempt;
  - a delivered answer file whose current bytes or file type no longer match
    the recorded deterministic payload.
- Reinspect only the exact configured answer-file target on explicit item read
  or Refresh; do not poll and do not read arbitrary paths.
- Label an exact matching answer file as a present transport artifact, not as
  acknowledgement or application.
- Keep role-prompt acknowledgement unavailable until provider-native evidence
  exists or the operator applies an explicit human label.
- Upgrade `queue-state.json` to schema 3 with bounded, immutable,
  hash-verified lifecycle-resolution records and append-only delivery attempts.
- Support human-labelled `acknowledged`, `applied`, `unable_to_apply`,
  `confirmed_not_delivered`, and `superseded` resolutions with an optional
  bounded note.
- Require `superseded` to reference another existing immutable decision for the
  same accepted workspace/source and a different exact item identity.
- Permit at most one additional delivery attempt after a
  `confirmed_not_delivered` resolution of a failed or unknown first attempt.
  Revalidate the exact decision, source, configuration, target, and payload
  before that deliberate retry.
- Add explicit Review/Cancel/Confirm UI for every human-labelled mutation and
  for the one eligible retry.
- Preserve question/approval separation, immutable decision bytes, every
  attempt, every resolution, queue sources, configuration, repositories, and
  unrelated PTYs.

## Non-scope

- Inferring acknowledgement from a missing/consumed answer file, queue rewrite,
  process activity, terminal output, Git activity, or elapsed time.
- Provider-native acknowledgement or approval execution; those belong to
  PC-060 through PC-064.
- Automatic acknowledgement, automatic conflict resolution, or automatic
  retry.
- More than two attempts for one decision, retrying a delivered attempt, or
  retrying without an exact human `confirmed_not_delivered` record.
- Editing, truncating, reordering, deleting, or repairing queue or answer files.
- Creating a correction for unchanged source content. Immutable decisions stay
  immutable; a superseding decision must already exist for a distinct exact
  item identity.
- Multi-item parsing, semantic duplicate matching, fuzzy source identity, or
  choosing one canonical duplicate source.
- A generic workflow, policy, event-sourcing, provider-callback, command,
  webhook, or filesystem API.
- Worker/objective/recent-decision surfaces owned by PC-050.

## Acceptance criteria

- [ ] Protocol schemas expose bounded conflict, reconciliation, resolution, and
      retry state without queue text, browser-selected paths, provider claims,
      or generic mutation fields.
- [ ] Queue-state schemas 1 and 2 remain readable; the first accepted PC-049
      mutation atomically writes schema 3 without changing existing decisions,
      attempts, hashes, outcomes, or order.
- [ ] Every resolution is server-authored, immutable, hash-verified, references
      one exact decision and applicable attempt, and follows a valid monotonic
      lifecycle transition.
- [ ] Stable source rewrites and degraded/empty/missing sources with prior
      decisions show explicit content-free conflict evidence after reload and
      local-server restart.
- [ ] Two current accepted sources with the same exact content hash show a
      duplicate conflict on both sources without comparing or exposing text.
- [ ] A differing second decision request preserves the first decision and
      returns a visible competing-decision conflict; an identical retry remains
      idempotent.
- [ ] Exact matching answer-file bytes show only transport-artifact-present
      evidence. Missing bytes remain acknowledgement-unavailable. Changed,
      symlinked, unsafe, or unreadable targets show a conflict without being
      modified.
- [ ] Role-prompt delivery remains acknowledgement-unavailable unless an
      explicit human-labelled resolution exists.
- [ ] Acknowledged, applied, unable-to-apply, confirmed-not-delivered, and
      superseded states display source, time, note, and exact immutable
      references without claiming provider-native evidence.
- [ ] A failed or unknown first attempt can be retried only after explicit
      confirmed-not-delivered Review/Cancel/Confirm, and at most one second
      attempt can ever be persisted or invoked.
- [ ] Delivered attempts, unresolved unknown attempts, stale sources, changed
      configuration, unsafe targets, and ineligible transitions cannot retry
      or mutate unrelated state.
- [ ] Refresh, browser reconnect, and local-server restart reconstruct conflict,
      artifact, lifecycle, and retry evidence without replaying a transport.
- [ ] Queue source bytes, answer-target bytes, `pacium.json`, repositories,
      selected terminals, layouts, and unrelated PTYs remain unchanged except
      for the one explicitly confirmed eligible delivery side effect.

## User experience

Source rows retain the compact queue hierarchy and add one restrained
`Conflict` label only when bounded server evidence exists. Duplicate conflicts
name accepted source labels/IDs, never excerpts. Degraded sources explain that
the earlier decision remains intact and that no acknowledgement was inferred.

The exact-item inspector separates:

1. immutable decision;
2. delivery attempt history;
3. current transport-artifact observation;
4. acknowledgement/application lifecycle;
5. conflicts and available manual resolution.

Every status states its evidence source: `filesystem observed`,
`terminal transport`, `provider unavailable`, or `human labelled`. Lifecycle
actions open a compact confirmation disclosure and explain that they record an
operator label without contacting an agent. Retry is absent until a first
failed/unknown attempt has been explicitly marked confirmed not delivered; it
then reuses the existing delivery review and says `Retry 1 of 1`.

Late responses, identity drift, mode exit, and disconnect cannot apply to a new
selection. Existing PTYs continue through every queue error. At 320 CSS px,
sections stack without hiding the Back action or terminal ownership status.

## Architecture

- Systems and modules touched:
  - shared queue reconciliation/resolution contracts and protocol;
  - queue-state validation, hashing, migration, and serialized mutations;
  - server reconciliation service joining accepted queue, decision, delivery,
    target-file, configuration, and live-session evidence;
  - authenticated WebSocket dispatch and exact-item/source observations;
  - browser transport/reducer and compact inspector/source presentation;
  - focused server, contract, browser, and Chromium fixtures.
- Systems of record:
  - queue files remain legacy input truth;
  - immutable decisions, delivery attempts, and human-labelled resolutions live
    in private `queue-state.json`;
  - answer-file bytes are current transport-artifact evidence only;
  - provider-native observers will own future native acknowledgement;
  - PTYs own process/terminal truth.
- State transitions:
  - `delivered -> acknowledged -> applied`;
  - `delivered -> applied | unable_to_apply | superseded`;
  - `failed | unknown -> confirmed_not_delivered -> one retry`;
  - `failed | unknown -> acknowledged | applied | unable_to_apply | superseded`
    only through an explicit human label;
  - terminal states `applied | unable_to_apply | superseded` accept no later
    lifecycle mutation.
- Protocol/schema impact:
  - protocol 16;
  - queue-state schema 3;
  - one identity-only lifecycle-resolution request/result;
  - content-free conflict and exact-target reconciliation evidence;
  - delivery state permits one explicitly unlocked second attempt.
- Relevant ADRs:
  - ADR-0001, ADR-0007, ADR-0012, and ADR-0015.

## Security and privacy

- Authorization: existing loopback/Host/Origin/ephemeral-token checks protect
  every read and mutation. The browser submits decision/attempt identities,
  one fixed action, and an optional note only.
- Privilege: the server resolves sources, targets, related decisions, and
  retry eligibility from accepted state. No new command, terminal-input, path,
  or arbitrary-read authority is added.
- Secrets/logging: queue text, target bytes, terminal bytes, provider data, and
  notes are not logged. Conflict summaries contain only accepted IDs, hashes,
  counts, fixed codes, and timestamps.
- Abuse/failure scenario: hostile queue rewrites or answer-target replacement
  produce inert conflict evidence. Symlinks, special files, oversized bytes,
  path drift, hash mismatch, forged actor/time/evidence, and invalid
  transitions fail closed without target or source mutation.

## Reliability

- Idempotency: identical resolution requests return the immutable existing
  record. Conflicting transitions reject. One serialized store writer enforces
  attempt and resolution uniqueness.
- Timeouts/retries: reconciliation reads are one-shot and bounded. There is no
  automatic retry. One explicit second attempt is the hard limit.
- Restart behavior: schemas 1-3 reread deterministically; an unfinished attempt
  is unknown and never invoked on startup.
- Unknown outcome: remains unknown until a human-labelled terminal resolution;
  absence or drift of a file is not sufficient.
- Migration/rollback: first mutation preserves all prior bytes semantically and
  writes schema 3 atomically. Protocol-15 code must preserve unsupported schema
  3 rather than rewriting it; no down-conversion is supported.

## Test plan

- Unit: strict schemas, canonical hashes, lifecycle transitions, conflict
  derivation, exact file inspection, duplicate grouping, retry eligibility,
  and browser presentation models.
- Contract: protocol 16 strict extras, content-free bounds, source/item
  invariants, identity-only resolution, question/approval separation, and
  maximum serialized messages.
- Integration: v1/v2 migration, source rewrite/degradation/restart, same-hash
  duplicates, competing decisions, exact/missing/changed/symlink target,
  role-prompt unavailable evidence, every lifecycle transition, one retry,
  duplicate retry suppression, and unchanged external state.
- Browser: conflict rows, exact artifact status, human-label confirmation,
  supersession, confirmed-not-delivered retry, reload/reconnect, stale response,
  focus return, terminal preservation, narrow/zoom/forced-color/reduced-motion.
- Failure/recovery: every atomic mutation boundary, read/type/hash errors,
  disconnect during mutation, final-write uncertainty, and server
  reconstruction with first or second pending attempt.
- Security: forged path/actor/time/source/target/provider/retry fields, hostile
  content, symlink/path drift, cross-decision/cross-attempt references, and log
  scanning.

## Dependencies

- Blocked by: PC-040 through PC-048.
- Blocks: PC-050 recent decisions/activity and the Milestone-3 compatibility
  loop exit evidence.

## Evidence required

- Focused contract, hash, store, migration, conflict, reconciliation, server,
  reducer, semantic-rendering, and target-file tests.
- Authenticated real-file and real/fake-PTY evidence proving exact observation,
  one eligible retry, no replay after restart, and external-state preservation.
- Chromium evidence for rewrite/degradation/duplicate conflict, manual
  lifecycle labels, retry confirmation, reload, focus, 320 CSS px, 200% zoom,
  forced colors, and reduced motion.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes recorded.
- Small coherent commits, clean branch, fast-forward merge into `dev`, and
  pushed exact `origin/dev` head.

## Open questions

- Provider-native acknowledgement remains unavailable in PC-049. Human labels
  must remain visibly weaker and can later be supplemented, never rewritten.
- Exact duplicate content is a conflict signal, not proof that two sources
  represent one logical request. PC-049 does not choose or delete a source.
- A missing answer file can mean consumed, deleted, or never durable. It is
  intentionally not acknowledgement evidence.
