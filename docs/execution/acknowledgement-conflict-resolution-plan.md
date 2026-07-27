# Implementation plan: PC-049 acknowledgement and conflict resolution

- Issue:
  [PC-049 acknowledgement and conflict resolution](acknowledgement-conflict-resolution-issue.md)
- Owner: Local implementation agent
- Agent/session: Codex `/root`
- Branch: `codex/acknowledgement-conflict-resolution`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `d3077b90a32ab5cc67e072a9fd163b91acf3ac54`
- Target milestone: Milestone 3 — Pacium mode
- Status: In progress

## Objective

Complete the compatibility loop after delivery without inventing provider
truth. Pacium will derive bounded conflict and answer-artifact evidence from
the systems it already owns, persist only explicit human-labelled lifecycle
resolutions, and permit one deliberate retry only after an operator confirms
that a failed or uncertain first attempt did not deliver.

The result remains one compact queue/inspector slice inside the existing
terminal workspace. It does not add a workflow engine, provider abstraction,
background poller, database, or generic filesystem/terminal operation.

## Existing behavior

- Protocol 15 exposes content-free queue sources, exact current item
  inspection, immutable question/approval decisions, and identity-only
  compatible delivery.
- `queue-state.json` schema 2 stores bounded decisions and at most one delivery
  attempt per decision. Schema 1 migrates on first mutation.
- Delivery intent is durable before the answer-file or role-prompt side effect.
  An unfinished attempt reconstructs as unknown; completed, failed, and unknown
  attempts never retry.
- Answer-file delivery creates deterministic private no-clobber
  `pacium_decision_v1` JSON. Role delivery writes one JSON-escaped comment line
  to one exact live role PTY.
- The inspector shows decision and delivery state, but explicitly says conflict
  detection is absent and cannot record acknowledgement/application evidence.
- Source rewrites clear exact text. Earlier decisions remain durable but are
  not joined back to the new/degraded source UI.
- A different decision for one exact item is rejected while preserving the
  first record, but no structured conflict projection is returned.

Primary existing modules:

- `packages/contracts/src/queue-decision.ts`
- `packages/contracts/src/queue-delivery.ts`
- `packages/contracts/src/queue-observation.ts`
- `packages/contracts/src/queue-item-inspection.ts`
- `packages/contracts/src/protocol.ts`
- `apps/local-server/src/queue-decision-store.ts`
- `apps/local-server/src/queue-decision-service.ts`
- `apps/local-server/src/queue-delivery-service.ts`
- `apps/local-server/src/answer-file-delivery.ts`
- `apps/local-server/src/queue-observer.ts`
- `apps/local-server/src/ws-hub.ts`
- `apps/web/src/pacium-queue-inspection-model.ts`
- `apps/web/src/pacium-queue-sources.tsx`
- `apps/web/src/pacium-queue-inspector.tsx`
- `apps/web/src/pacium-queue-delivery-panel.tsx`

## Proposed behavior

On every explicit queue observation, the server joins the accepted queue
snapshot to durable decision identities and returns content-free conflict
summaries:

- `source_changed_after_decision`;
- `source_unavailable_after_decision`;
- `duplicate_current_item`.

The exact current item inspection additionally returns:

- prior decisions for the same accepted source, bounded to the identities
  needed for conflict/supersession review;
- a differing-submission conflict when applicable;
- all delivery attempts for the current decision;
- current answer-target artifact evidence or explicit role/provider
  unavailability;
- the latest valid human-labelled lifecycle state and its immutable history.

The answer target is inspected without following links and with the same
canonical target authority as delivery:

- regular file with exact deterministic length/hash:
  `transport_artifact_present`;
- missing file: `acknowledgement_unavailable`;
- different bytes, unsafe type, path drift, oversized content, or read error:
  `target_conflict`;
- role prompt: `acknowledgement_unavailable` with terminal-transport evidence
  retained separately.

The operator may append one of five fixed human-labelled resolutions through a
strict identity-only request:

- `acknowledged`;
- `applied`;
- `unable_to_apply`;
- `confirmed_not_delivered`;
- `superseded`.

All actions require Review/Cancel/Confirm. The server authors the actor label,
source, timestamp, UUID, and canonical hash. `superseded` also requires exact
existing replacement decision ID/hash; the server verifies same
workspace/source and different item identity.

`confirmed_not_delivered` is allowed only for a failed or unknown first
attempt. It unlocks one additional explicit delivery review. The existing
identity-only delivery request creates a second append-only attempt only after
revalidating the current source/config/target and resolution. Two attempts is
the absolute limit. No request carries a retry flag.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/queue-reconciliation.ts` (new)
  - strict conflict, artifact, lifecycle, resolution, and result contracts;
  - fixed codes/copy and hard bounds.
- `packages/contracts/src/queue-delivery.ts`
  - schema-3 document composition, multi-attempt cross references, and retry
    state;
  - preserve schemas 1 and 2 on read.
- `packages/contracts/src/queue-observation.ts`
  - content-free source conflict summaries.
- `packages/contracts/src/queue-item-inspection.ts`
  - exact-item reconciliation and bounded prior-decision references.
- `packages/contracts/src/protocol.ts`
  - protocol 16 resolution request/result and revised source/item evidence.
- `packages/contracts/src/index.ts`
  - export reconciliation contracts.
- `apps/local-server/src/queue-resolution-hash.ts` (new)
  - canonical resolution hash and verification.
- `apps/local-server/src/queue-conflict-model.ts` (new)
  - pure source rewrite/degradation/duplicate conflict derivation.
- `apps/local-server/src/answer-file-reconciliation.ts` (new)
  - bounded no-follow exact target inspection and deterministic payload
    comparison.
- `apps/local-server/src/queue-reconciliation-service.ts` (new)
  - state joins, lifecycle transition validation, target evidence, and
    server-authored resolution records.
- `apps/local-server/src/queue-decision-store.ts`
  - schema-3 normalization/migration, serialized resolution append, and a
    second-attempt gate.
- `apps/local-server/src/queue-decision-service.ts`
  - structured competing-decision result with first-record preservation.
- `apps/local-server/src/queue-delivery-service.ts`
  - derive current attempt history, retry eligibility, and one second attempt.
- `apps/local-server/src/queue-observer.ts`
  - expose one immutable content-free snapshot for reconciliation joins.
- `apps/local-server/src/ws-hub.ts`
  - enrich observations/inspection and dispatch one strict resolution request.
- `apps/web/src/transport.ts`
  - identity/action/note-only resolution request.
- `apps/web/src/pacium-queue-inspection-model.ts`
  - correlate resolutions, preserve accepted evidence, and reject late/drifted
    results.
- `apps/web/src/pacium-queue-model.ts`
  - source conflict labels and deterministic priority.
- `apps/web/src/pacium-queue-sources.tsx`
  - restrained conflict indicators and fixed recovery copy.
- `apps/web/src/pacium-queue-reconciliation-panel.tsx` (new)
  - artifact, lifecycle, history, conflict, confirmation, and retry states.
- `apps/web/src/pacium-queue-delivery-panel.tsx`
  - attempt history and `Retry 1 of 1` review.
- `apps/web/src/pacium-queue-inspector.tsx`
  - replace the unavailable conflict placeholder with the compact panel.
- `apps/web/src/styles.css`
  - existing compact hierarchy, narrow layout, forced-colors, reduced-motion.
- focused tests, E2E fixture, active docs, status, backlog, and changelog.

### Data/state changes

- Entity/schema changes:
  - `queue-state.json` schema 3 contains:
    - unchanged bounded immutable `decisions`;
    - bounded append-only `deliveries`, now at most two per decision;
    - bounded append-only `resolutions`;
  - resolution fields:
    - UUID resolution ID;
    - decision ID/hash;
    - applicable delivery ID/hash when required;
    - fixed lifecycle action;
    - fixed source `human_labelled`;
    - server actor `local_operator`;
    - server timestamp;
    - optional bounded note;
    - nullable exact related decision ID/hash for supersession only;
    - canonical resolution hash.
  - current answer-artifact and source-conflict observations remain ephemeral;
    they are recomputed and never copied into durable state.
- Commands/events:
  - client `pacium.queue.decision.resolve`;
  - server `pacium.queue.resolution`;
  - existing source/item messages gain bounded reconciliation evidence;
  - existing delivery request remains identity-only.
- Idempotency:
  - one serialized mutation queue owns decision, attempt, and resolution
    appends;
  - identical resolution intent returns the existing record;
  - incompatible transitions reject without writing;
  - attempt two requires one exact `confirmed_not_delivered` record for attempt
    one;
  - attempt three is structurally invalid.
- Migration:
  - schemas 1 and 2 normalize to schema-3 in-memory shape with empty
    resolutions;
  - read-only inspection does not rewrite;
  - first accepted decision, attempt, or resolution mutation writes complete
    schema 3 atomically;
  - every schema-1/2 decision/delivery object and hash remains unchanged.

### Protocol changes

- Bump `PROTOCOL_VERSION` from 15 to 16.
- Add:

```text
pacium.queue.decision.resolve(
  requestId,
  decisionId,
  decisionHash,
  action,
  deliveryId?,
  deliveryHash?,
  relatedDecisionId?,
  relatedDecisionHash?,
  note
)

pacium.queue.resolution(requestId, result)
```

- Optional fields are action-constrained:
  - acknowledgement/application/unable-to-apply/confirmed-not-delivered name
    the exact attempt being resolved;
  - superseded names an exact related decision and no delivery unless its
    transition requires one;
  - the browser cannot submit actor, source, time, resolution ID/hash,
    workspace/source identity, path, target bytes, evidence strength,
    provider claim, terminal bytes, command, or retry flag.
- Queue source observations add at most bounded content-free conflicts carrying
  fixed kind, stable conflict ID, affected accepted source IDs, decision
  references/counts, and observation time.
- Exact-item inspection adds a reconciliation state whose cross references must
  agree with the item decision and delivery records.
- Application messages remain below 128 KiB. Prior-decision references and
  resolution history have strict display caps and truncation flags.

### Authorization and privilege

- Existing loopback binding, Host/Origin checks, and ephemeral local token
  remain the entire network authorization boundary.
- The server resolves every source, target, decision, delivery, replacement,
  and retry gate from accepted configuration/runtime/durable state.
- The only new durable user content is one optional bounded note.
- Answer-target reconciliation reads only the exact snapshotted configured path
  of a delivered decision, with no symlink following and bounded bytes.
- No request can launch/choose a PTY, write a file, or retry directly.
- Queue and target bytes are treated as data, never logged, rendered as HTML,
  executed, or sent to a terminal.

## Sequence

1. Commit the issue and this plan separately.
2. Add reconciliation/resolution contracts and fixed errors/copy.
3. Add schema-3 document invariants with schema-1/2 compatibility.
4. Add canonical resolution hashing and tamper tests.
5. Extend store inspection/normalization without read-time writes.
6. Add atomic schema-3 migration and resolution append.
7. Extend delivery persistence to two attempts behind the exact resolution
   gate.
8. Add the pure source conflict model for rewrite/degradation/duplicates.
9. Add bounded no-follow answer-target reconciliation.
10. Add the server reconciliation/lifecycle service.
11. Return structured competing-decision conflicts without replacing the first
    record.
12. Add protocol-16 strict request/result/source/item contracts.
13. Wire content-free source enrichment and exact-item reconciliation.
14. Wire authenticated resolution dispatch and exact result correlation.
15. Extend delivery inspection/invocation for one eligible retry.
16. Add server integration fixtures for migration, conflicts, target evidence,
    lifecycle, retry, restart, and external-state preservation.
17. Add browser transport and reducer state for reconciliation/resolution.
18. Add source conflict labels and deterministic queue ordering.
19. Add compact artifact/lifecycle/conflict/history UI.
20. Add Review/Cancel/Confirm for human labels, supersession, and retry.
21. Add responsive/forced-color/reduced-motion styles and semantic tests.
22. Extend Chromium workflow with real queue/answer targets and restart/reload
    evidence.
23. Synchronize architecture, security, workspace protocol, README, STATUS,
    backlog, changelog, issue, and plan evidence.
24. Run focused tests after each coherent slice, then `pnpm verify` and full
    Chromium at the exact head.
25. Audit the small commit series and clean worktree, fast-forward into `dev`,
    push exact `origin/dev`, and continue directly to PC-050.

## Failure model

| Failure point                                   | Expected state                                                  | Recovery                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Schema 1 or 2 read                              | Valid state normalized in memory; no rewrite                    | First accepted mutation migrates atomically                                     |
| Invalid/unsafe/full schema 3                    | Reconciliation unavailable; queue observation remains read-only | Repair or move state explicitly                                                 |
| Source identity differs after decision          | Content-free rewrite conflict; old decision preserved           | Inspect current item; decide separately and explicitly supersede if appropriate |
| Source empty/missing/changing/oversized/invalid | Source-unavailable conflict; no acknowledgement inferred        | Repair source externally and Refresh                                            |
| Same exact hash in accepted sources             | Duplicate conflict on all affected sources                      | Inspect each source; Pacium never chooses one                                   |
| Different answer for exact item                 | First decision preserved; competing conflict result             | Keep first or wait for a distinct rewritten item and supersede explicitly       |
| Answer file exact                               | Artifact-present evidence only                                  | Await provider evidence or add human label                                      |
| Answer file missing                             | Acknowledgement unavailable                                     | Inspect external workflow; add human label only with operator evidence          |
| Answer file changed/unsafe/unreadable           | Target conflict; bytes untouched                                | Repair externally or resolve lifecycle manually                                 |
| Role prompt delivered                           | Terminal transport retained; acknowledgement unavailable        | Provider observer later or explicit human label                                 |
| Resolution write fails before rename            | Prior lifecycle remains authoritative                           | Refresh and resubmit only after inspection                                      |
| Resolution directory sync fails                 | Mutation outcome unknown                                        | Reinspect exact item; never blind retry                                         |
| Invalid lifecycle transition                    | Rejected; no write or side effect                               | Review current immutable lifecycle                                              |
| First failed/unknown without confirmation       | Retry unavailable                                               | Confirm not delivered after external inspection                                 |
| First attempt confirmed not delivered           | Retry ready if exact source/config/target still valid           | Review and explicitly confirm retry                                             |
| Retry transport invoked                         | Second intent persisted first                                   | Inspect durable second outcome                                                  |
| Second failed/unknown                           | No more attempts                                                | Human-label final outcome or repair externally                                  |
| Browser disconnect/late result                  | UI assumes unknown and drops pending intent                     | Reconnect and exact-item inspect                                                |
| Server restart with pending attempt             | Attempt remains unknown; no transport replay                    | Manual resolution only                                                          |
| Config/source/target drift before retry         | Retry unavailable; no second intent                             | Restore exact accepted boundary or supersede                                    |

## Compatibility

- Supported versions:
  - protocol 16;
  - Pacium config schema 1;
  - queue-state schemas 1, 2, and 3 on read;
  - queue-state schema 3 on mutation;
  - unchanged `pacium_decision_v1` answer and role payloads.
- Fallback behavior:
  - missing provider observers yield acknowledgement-unavailable;
  - missing/corrupt reconciliation state does not affect General mode or PTYs;
  - source/target drift creates evidence, never an inferred lifecycle change.
- Rollback:
  - protocol-15/server schema-2 code cannot interpret schema 3 and must preserve
    it unchanged;
  - copy state before rollback and accept temporary decision-state
    unavailability;
  - never delete, down-convert, or collapse attempt/resolution history.

## Test plan

- Unit:
  - strict contracts, hashes, cross references, transition table, retry gate;
  - source conflict grouping and deterministic IDs/order;
  - answer-target exact/missing/different/unsafe/error evidence;
  - browser reducer, labels, confirmation, and stale-result handling.
- Property/fault:
  - schema-1/2/3 corruption and tampering;
  - every atomic append boundary;
  - concurrent identical/conflicting resolutions;
  - concurrent retry requests and attempt-limit enforcement.
- Contract:
  - protocol 16 accepted and forbidden fields;
  - source/item/reconciliation cross invariants;
  - question/approval separation;
  - maximum source/item/result message sizes.
- Integration:
  - byte-equivalent schema-1/2 migration;
  - rewrite, empty, missing, changing/truncation, and restart conflicts;
  - exact duplicates in two configured sources;
  - competing decision preservation;
  - answer exact/missing/changed/symlink/oversized/read error;
  - role acknowledgement unavailable;
  - every valid/invalid lifecycle transition;
  - one retry only, intent-before-effect, duplicate suppression, restart
    unknown, and exact target/source revalidation;
  - queue/config/repository/unrelated PTY byte/process preservation.
- Browser:
  - source conflict row and exact details;
  - answer artifact versus acknowledgement copy;
  - human acknowledgement/applied/unable confirmation;
  - source rewrite and supersession review;
  - failed/unknown confirm-not-delivered and retry;
  - refresh/reconnect/reload, stale identity, Back/Escape focus;
  - selected PTY/layout/input ownership;
  - 320 CSS px, 200% zoom, forced colors, reduced motion.
- Security:
  - forged path/target/source/workspace/actor/time/evidence/provider/retry
    fields;
  - cross-decision/attempt/supersession references;
  - symlink/path drift and hostile queue/target/note rendering;
  - no queue, target, terminal, environment, or note logs.
- Performance:
  - bounded schema-3 state at configured decision/attempt/resolution ceilings;
  - at most 32-source conflict join and bounded duplicate grouping;
  - one-shot target read only while inspecting; no polling/watch expansion.

## Documentation changes

- `ARCHITECTURE.md`: schema 3, ephemeral reconciliation, and human-labelled
  lifecycle boundary.
- `SECURITY.md`: exact target read, conflict evidence, transition/retry
  authority, and no acknowledgement inference.
- `docs/execution/pacium-workspace-configuration.md`: protocol 16 and schema 3.
- `docs/workflow/questions-and-approvals.md`: implemented evidence sources and
  bounded retry/supersession rules.
- `README.md`, `STATUS.md`, and implementation backlog: exact implemented and
  absent behavior.
- `CHANGELOG.md`, this issue, and this plan: exact tests, counts, bundle sizes,
  runtime caveat, and remaining PC-050/provider limitations.

## Rollout

- Development: deterministic fixtures, fake observers/adapters, disposable
  state, and small coherent commits.
- Integration: disposable queue and answer files plus exact fake/real PTY
  fixtures. Never use operator queue state.
- Canary: localhost operator review only after all automated gates. Human
  labels remain visually explicit.
- Production: none. Pacium Control remains pre-release.

## Open questions

- Provider acknowledgement is not available yet. PC-049 records only explicit
  human labels and current filesystem/transport facts.
- Duplicate exact hashes are surfaced but not automatically merged or
  dismissed because separate accepted sources may intentionally repeat text.
- The one-retry ceiling is deliberately fixed for this compatibility slice.
  More attempts would be a workflow policy and require later evidence/approval.
- No background target watcher is added. Explicit inspection/Refresh keeps the
  localhost application quiet and avoids treating transient file events as
  lifecycle truth.

## Approval

- Product: PC-049 stays inside the current queue list/inspector and prioritizes
  readable oversight over a new dashboard.
- Architecture: schema 3 extends the existing single private state document
  with only app-owned immutable records; ephemeral observations stay outside
  durable state.
- Security: exact server-owned reads, strict human-label transitions, one
  bounded retry, and no automatic inference preserve the accepted
  browser-to-shell/filesystem boundary.
