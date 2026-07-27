# Implementation plan: PC-047 immutable local queue decisions

- Issue:
  [immutable-queue-decisions-issue.md](immutable-queue-decisions-issue.md)
- Owner: Pacium Control
- Agent/session: Codex `/root`
- Branch: `codex/immutable-queue-decisions`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `115d250d1d1ca60c341a83523fb9360ee1fe38a2`
- Target milestone: Milestone 3 — Pacium mode
- Status: Complete

## Objective

Let the local operator answer an exact current question or explicitly approve
or deny an exact current approval request. Persist one immutable, attributable,
hash-verified local decision without delivering it, confusing answer with
permission, changing queue/config/terminal state, or introducing a generalized
database or event system.

## Existing behavior

- Protocol 13 publishes content-free current whole-source candidates and lets
  an authenticated browser inspect the exact bounded text for one exact
  current identity.
- Classification has distinct `question` and `approval` item types. Approval
  requires an exact supported marker; question marks and natural-language
  requests do not infer permission.
- The right inspector renders exact text inertly and exposes no action control.
- Queue runtime state and candidate-first-seen time are ephemeral. Rewrite,
  degradation, config drift, disconnect, and mode exit clear accepted text.
- The only durable server-owned file is private, atomic `pacium.json`.
- Delivery methods are accepted metadata only. Answer targets are never opened
  and role prompts are never sent.

Relevant evidence lives in:

- `packages/contracts/src/queue-classification.ts`
- `packages/contracts/src/queue-item-inspection.ts`
- `apps/local-server/src/queue-observer.ts`
- `apps/local-server/src/pacium-config-store.ts`
- `apps/local-server/src/ws-hub.ts`
- `apps/web/src/pacium-queue-inspection-model.ts`
- `apps/web/src/pacium-queue-inspector.tsx`
- ADR-0012, ADR-0015, the PC-046 issue/plan, and their tests.

## Proposed behavior

Exact item inspection gains a separately reported decision state:

- `open`: durable state is safe and no decision exists for this item;
- `decided`: the exact immutable record exists;
- `unavailable`: durable state cannot be trusted, so actions are disabled.

A question inspector in `open` state shows bounded Answer and optional Note
fields plus **Record answer**. An approval inspector instead shows **Approve**
and **Deny**. Choosing either approval outcome enters a second inline
confirmation step while the source text remains visible. Other item types show
no decision controls.

The browser sends either a strict question-answer message or a strict
approval-decision message. The server rechecks the entire exact current item
and classification, assigns `Local operator` and the decision timestamp,
constructs a canonical record, computes its SHA-256 hash, and asks the narrow
decision store to append it.

The store writes a schema-version-1 `queue-state.json` document. It contains a
revision and at most 4096 immutable decision records within a 4 MiB serialized
limit. Physical persistence replaces the complete validated document
atomically. The store has no update/delete API and verifies that every prior
record and hash remains byte-for-value unchanged before adding one record.

An identical replay returns the existing decision. A different replay for the
same item returns a fixed already-decided error and preserves the first record.
After reload/restart, exact inspection joins the stored decision back to the
current candidate. The UI shows `Not delivered yet`; PC047 never touches the
configured delivery method.

## Architecture and boundaries

### Modules touched

- `packages/contracts`
  - source and decision payload/record schemas;
  - decision-state and result unions;
  - strict protocol-14 client/server messages and fixtures.
- `apps/local-server`
  - canonical decision hashing;
  - private bounded atomic `queue-state.json` store;
  - exact current item decision service;
  - WebSocket dispatch and safe error mapping;
  - startup wiring and integration fixtures.
- `apps/web`
  - separate answer and approval transport calls;
  - correlated reducer state and draft reset rules;
  - question form, approval confirmation, immutable detail, and errors;
  - focused component and browser tests.
- `docs`
  - filesystem state, protocol/configuration, security, README, STATUS,
    backlog, changelog, issue, and plan evidence.

### Data/state changes

- Entity/schema changes:
  - `QueueDecisionSourceIdentity` stores workspace ID/revision, source ID,
    observation revision, `whole_source_v1`, content hash, item ID, and item
    type;
  - `QuestionAnswerDecision` stores a bounded nonblank answer;
  - `ApprovalDecision` stores `approved | denied`;
  - both store optional bounded note, fixed actor
    `{ kind: "local_operator", label: "Local operator" }`, ISO timestamp,
    UUID decision ID, and lower-case SHA-256 decision hash;
  - `QueueStateDocument` stores schema version 1, positive revision, and a
    bounded ordered decision array.
- Commands/events:
  - client `pacium.queue.question.answer`;
  - client `pacium.queue.approval.decide`;
  - server `pacium.queue.decision`;
  - exact item inspection reports open/decided/unavailable decision state.
- Idempotency:
  - unique logical key is workspace ID + source ID + boundary + item ID;
  - identical canonical type-specific payload and note returns the prior
    record;
  - any differing second payload returns already-decided;
  - no browser or server automatic retry.
- Migration:
  - absent `queue-state.json` is empty state and is created only on first valid
    decision;
  - no migration from queue source contents or `pacium.json`;
  - unsupported or invalid files are preserved and block writes.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 13 to 14.
- Both mutating requests repeat the exact current item tuple and allow no path,
  source text, actor, timestamp, decision ID/hash, delivery, command, or
  terminal fields.
- Question request:
  - exact item identity;
  - `answer` trimmed for blank checking but stored with deliberate internal
    newlines preserved;
  - nullable optional note;
  - strict bounds defined in the shared contract.
- Approval request:
  - exact item identity;
  - `outcome: approved | denied`;
  - nullable optional note;
  - no generic response or answer field.
- Result statuses are `recorded`, `existing`, `stale`, `unavailable`, and
  `rejected`.
  - only `recorded | existing` carry a full decision;
  - `stale | unavailable | rejected` carry fixed bounded safe errors and no
    operator payload;
  - request correlation is mandatory.
- Exact inspection's ready branch carries one bounded decision-state union but
  bulk queue observations remain free of answer/note/original text.
- `MAX_APPLICATION_MESSAGE_BYTES` remains 128 KiB; decision payloads are far
  below it.

### Authorization and privilege

- Reuse authenticated WebSocket, loopback Host, exact Origin, and ephemeral
  local-token checks.
- The WebSocket connection does not accept an actor claim. The server assigns
  the current fixed local actor label.
- The decision service calls `QueueObserver.inspectItem` immediately before
  building a record, then requires a ready identity and exact expected
  classification.
- Decision recording has no reference to `deliveryMethods`, terminal input,
  session prompts, provider callbacks, Git writers, shells, or generic paths.
- Queue source text remains only in queue runtime/one browser inspection and is
  never copied into durable decision state.
- Safe errors contain fixed product copy, not filesystem error details or
  answer/note content.

## Sequence

1. Commit the issue and this plan separately.
2. Add strict source, question, approval, actor, record, document, decision
   state, and result contracts without protocol wiring.
3. Add canonical hashing and record validation tests.
4. Implement private `queue-state.json` inspection and missing/unsafe/corrupt/
   unsupported/full behavior.
5. Implement serialized atomic append with identical replay, differing replay,
   injected pre-rename failure, and post-rename durability-unknown behavior.
6. Add a decision service that revalidates exact runtime identity and item type
   and joins durable state to exact inspection.
7. Add separate protocol-14 answer/approval requests and bounded decision
   responses through the WebSocket hub.
8. Wire one store/service at startup and keep HTTP/server test constructors
   injectable.
9. Extend the browser inspection reducer for open/decided/unavailable,
   correlated submission, drift/disconnect clearing, and no blind retry.
10. Add the bounded question form and immutable decision presentation.
11. Add separate approval outcome controls and explicit inline confirmation.
12. Style loading, submitting, success, stale, rejected, storage-unavailable,
    narrow, zoomed, forced-color, and reduced-motion states.
13. Add real-file integration and browser workflows proving restart recovery,
    duplicate protection, type separation, and no external mutations.
14. Synchronize active documentation in small commits.
15. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect the commit
    series, fast-forward into `dev`, and push.

## Failure model

| Failure point                        | Expected state                                    | Recovery                                        |
| ------------------------------------ | ------------------------------------------------- | ----------------------------------------------- |
| No `queue-state.json`                | Exact item is open; no file is created            | Submit one valid current decision               |
| Item rewrites before submit          | Stale rejection; no durable write                 | Inspect and decide the replacement deliberately |
| Classification/type mismatches       | Rejected; no durable write                        | Use the controls for the exact current type     |
| Same request repeats                 | Existing record returned; no new revision         | Continue to PC048 delivery later                |
| Different request follows a decision | Already-decided rejection; first record preserved | PC049 explicit conflict/supersession flow       |
| State file is corrupt/unsafe/full    | Decision state unavailable; controls disabled     | Repair/archive state explicitly, then inspect   |
| Failure before rename                | Previous state remains authoritative              | Inspect and deliberately retry                  |
| Directory sync fails after rename    | Durability unknown; no automatic retry            | Reopen/restart and inspect before retrying      |
| Disconnect during request            | Browser outcome unknown; pending state clears     | Reconnect and inspect durable item state        |
| Late response or source/config drift | Reducer ignores/clears payload and controls       | Reopen the current item                         |
| Hostile answer/note text             | Stored/rendered as bounded inert text             | Review immutable record                         |
| Delivery target/session is missing   | Irrelevant; decision records as not delivered     | Configure/fix during PC048                      |

## Compatibility

- Supported versions: protocol 14, Pacium config schema 1, queue-state schema 1,
  `whole_source_v1`, current question/approval classifier markers.
- Fallback behavior: General terminals and read-only queue inspection continue
  if durable decision state is unavailable. Mutating controls fail closed.
- Rollback: protocol 13 code may ignore the private valid `queue-state.json`.
  It must not delete, compact, migrate, or overwrite decisions.

## Test plan

- Unit:
  - strict type-specific schemas and bounds;
  - canonical hashes and tamper detection;
  - store inspect/append/replay/immutability/bounds;
  - decision service exact identity/type checks;
  - browser reducer drafts/confirmation/correlation/clearing.
- Property/fault:
  - arbitrary Unicode/control answer and note content;
  - generated request extras and cross-type fields;
  - duplicate/concurrent append ordering;
  - truncated, oversized, wrong-version, wrong-hash, duplicate-key state;
  - every atomic I/O failure point.
- Contract:
  - protocol 14 unions and maximum serialized messages;
  - fixed actor/error copy;
  - no path/text/actor/command/delivery extras;
  - question cannot carry approval outcome and approval cannot carry answer.
- Integration:
  - authenticated answer/approve/deny against real current files;
  - store file mode and restart recovery;
  - exact same/different replay;
  - source rewrite/config drift/classification mismatch;
  - corrupt/unsafe state and atomic faults;
  - unchanged queue/config/delivery-target bytes and live PTY.
- Browser:
  - question draft/record/result/reload;
  - approval choose/cancel/confirm approve and deny;
  - no approval controls on question;
  - no answer controls on approval;
  - Back/Escape and text-focus ownership;
  - stale/disconnected/unavailable/rejected states;
  - 320 CSS px, 200% zoom, forced colors, and reduced motion.
- Security:
  - forged actor/decision/hash/identity/type and extra fields rejected;
  - inert hostile text;
  - no operator payload or queue text in logs/errors/list labels;
  - no source, delivery target, terminal, Git, provider, or config mutation.
- Performance:
  - 4096-record/4 MiB state boundary;
  - one atomic serialized writer;
  - at most one detailed current decision in browser inspection state;
  - no polling or background delivery.

## Documentation changes

- Add the implemented `queue-state.json` schema, lifecycle, privacy, recovery,
  and rollback contract to filesystem-state docs.
- Document protocol 14 and decision/no-delivery behavior in the Pacium
  configuration contract.
- Update SECURITY with fixed local attribution, type separation, private
  answer metadata, replay, and atomic-failure rules.
- Update README and STATUS with the exact implemented controls and remaining
  PC048-PC050 limitations.
- Mark PC047 complete and PC048 next only after evidence passes.
- Record test counts, bundle sizes, browser boundary, runtime mismatch, and
  exact limitations in CHANGELOG and completion sections.

## Completion evidence

- Protocol 14 contracts, canonical hashing, private state storage, exact
  decision service, authenticated server dispatch, browser state/forms, and
  explicit no-delivery presentation are implemented.
- Focused contract, store, service, server integration, browser-model, semantic
  rendering, and Chromium decision tests pass. A reconstructed store instance
  reads the same immutable record, proving local-server restart recovery.
- Authenticated integration evidence preserves queue source, `pacium.json`,
  delivery target, and live PTY state while recording/replaying decisions.
- `queue-state.json` is mode `0600`, contains application-owned answer/outcome
  data, and does not contain the raw queue source text.
- `pnpm verify` passed formatting, lint, all workspace type checks, 91 test
  files and 546 tests, and the 834.31 kB web / 227.62 kB local-server
  production builds.
- `pnpm test:e2e` passed all ten Chromium workflows with the required Xcode Git
  path, including question/approval separation, reload, rewrite, focus,
  responsive, forced-color, and reduced-motion evidence.
- Verification used Node.js 26.4.0 rather than the pinned Node.js 24.18.x;
  clean supported-runtime and release gates remain open outside this slice.

## Rollout

- Development: synthetic current question/approval sources and disposable data
  directories only.
- Integration: disposable queue/config/delivery-target fixtures plus one live
  PTY; inspect exact byte/mode evidence before and after.
- Canary: localhost operator recording only. No real compatibility delivery
  and no Tailscale remote operation in this slice.
- Production: none; Pacium Control remains pre-release.

## Open questions

- Keep the initial actor server-owned and honest as `Local operator`. Verified
  Tailscale identity will require a later transport-aware attribution change,
  not a browser-provided label.
- Store a narrow versioned JSON document rather than JSONL so every write can
  preserve the repository's atomic-replacement rule. Logical records remain
  append-only and there is no mutation API.
- Full competing-decision and supersession records belong to PC049. Here, a
  differing second decision is rejected and the first remains authoritative.
- Delivery lifecycle fields begin in PC048. The decision record itself does not
  claim delivery.

## Approval

- Product: answer and approval controls occupy the existing exact-item
  inspector and add no parallel dashboard or workflow shell.
- Architecture: one bounded queue-state file is the smallest durable
  application-owned state required by a visible consumer.
- Security: type-specific messages, exact-current revalidation, server-owned
  attribution, immutable atomic persistence, explicit approval confirmation,
  and no delivery authority preserve the accepted boundaries.
