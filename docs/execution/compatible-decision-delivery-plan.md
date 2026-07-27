# Implementation plan: PC-048 compatible decision delivery

- Issue:
  [compatible-decision-delivery-issue.md](compatible-decision-delivery-issue.md)
- Owner: Pacium Control
- Agent/session: Codex `/root`
- Branch: `codex/compatible-decision-delivery`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `0b19e72f4f467646f5774944169ed08df3c67a35`
- Target milestone: Milestone 3 — Pacium mode
- Status: In progress

## Objective

Deliver one existing immutable queue decision at most once through its exact
configured answer-file or role-prompt compatibility method. Persist intent
before the side effect, make uncertain outcomes durable and non-retryable, and
preserve the distinction between terminal/file transport evidence and provider
acknowledgement or execution.

## Existing behavior

- Protocol 14 records one immutable local question answer or approval outcome
  for an exact current `whole_source_v1` item.
- Private schema-version-1 `queue-state.json` contains only decisions and
  rejects tampering, duplicates, unsafe state, and blind replacement.
- Exact inspection joins a matching decision and the browser renders
  **Not delivered yet** with no delivery action.
- Pacium config schema 1 already lets one queue source reference one explicit
  `answer_file` or `role_prompt` method.
- Answer-file targets are canonical regular non-symlink leaves or missing
  leaves beneath canonical existing parents. They are distinct from sources.
- Role-prompt methods name only Meta or Orchestrator and require that role to
  be configured. A binding may still be a launch preset, missing session, ended
  session, or changed session at runtime.
- Existing explicit prompt targeting sends one bounded user line to a selected
  live PTY, but its browser-owned request correlation is not durable and cannot
  be reused as queue-delivery idempotency evidence.

Relevant implementation:

- `packages/contracts/src/pacium-config.ts`
- `packages/contracts/src/queue-decision.ts`
- `packages/contracts/src/protocol.ts`
- `apps/local-server/src/queue-decision-store.ts`
- `apps/local-server/src/queue-decision-service.ts`
- `apps/local-server/src/queue-observer.ts`
- `apps/local-server/src/session-manager.ts`
- `apps/local-server/src/ws-hub.ts`
- `apps/web/src/pacium-queue-inspection-model.ts`
- `apps/web/src/pacium-queue-decision-panel.tsx`
- PC-040 through PC-047 issues, plans, tests, and evidence
- ADR-0001, ADR-0007, and ADR-0012 through ADR-0016

## Proposed behavior

A decided exact item gains a server-derived delivery state:

- `not_configured`: the source has no delivery method;
- `ready`: exact current source/config/decision and target are eligible;
- `delivering`: this server process owns a persisted in-flight intent;
- `delivered`: one external transport accepted the deterministic payload;
- `failed`: the attempt has definite bounded failure evidence;
- `unknown`: intent exists but the side-effect outcome is not provable;
- `unavailable`: state/config/identity/target evidence cannot safely authorize
  a first attempt.

Only `ready` renders a delivery action. The browser sends only decision ID and
hash. The server:

1. loads and hash-validates the immutable decision;
2. revalidates its exact current queue identity;
3. loads the same accepted workspace revision;
4. resolves the source's configured method;
5. snapshots the exact target;
6. deterministically serializes and hashes the delivery payload;
7. appends one durable delivery intent;
8. performs the adapter side effect once;
9. atomically records delivered, failed, or unknown outcome evidence.

An existing attempt is returned without invoking an adapter. An unfinished
intent is `delivering` only while this service instance owns it; after restart
it is `unknown`.

### Answer-file payload

The target is a single-slot compatibility mailbox. Pacium refuses to overwrite
any existing leaf. It writes deterministic pretty JSON plus a trailing newline:

```json
{
  "format": "pacium_decision_v1",
  "decisionId": "<uuid>",
  "decisionHash": "<sha256>",
  "kind": "question_answer",
  "source": {
    "workspaceId": "primary",
    "sourceId": "needs-felix",
    "itemId": "<sha256>",
    "contentHash": "<sha256>"
  },
  "payload": {
    "answer": "Use the verified slice.",
    "note": null
  },
  "decidedAt": "<server time>"
}
```

For approvals, `kind` and payload remain the exact immutable
`approval_decision`/`approved | denied` record. Queue original text, actor
environment, commands, terminal bytes, configured path, and delivery metadata
are not copied into the target document.

The publisher creates a mode-`0600` same-directory unpredictable temporary
file, writes/syncs/closes it, atomically hard-links it to the missing final
leaf, syncs the parent directory, removes the known temporary link, and syncs
cleanup. `EEXIST` is definite failure. Any uncertainty after the final link is
reported unknown and is never retried.

### Role-prompt payload

The target snapshot contains method ID/label, role, exact live session ID, and
session epoch. The transport bytes are exactly one UTF-8 line and one carriage
return:

```text
# Pacium decision v1 <decision-id> <decision-hash> <compact-json>\r
```

`compact-json` contains only kind and immutable payload. `JSON.stringify`
escapes answer newlines, carriage returns, controls, quotes, backslashes, and
shell metacharacters. The fixed `# ` prefix makes the line a no-op in the
supported POSIX shells while remaining readable to an active CLI agent. The
complete line has a dedicated UTF-8 byte ceiling below the terminal-input
protocol bound.

`SessionManager.input` accepting the line produces delivered evidence named
`terminal_transport_accepted`; it is not provider-native receipt,
acknowledgement, application, permission execution, or completion.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/queue-delivery.ts`
  - target snapshots, intent/outcome/evidence records;
  - fixed errors, state/result unions, versioned payload schema and bounds;
  - queue-state v1/v2 schemas and cross-record validation.
- `packages/contracts/src/queue-decision.ts`
  - retain decision schemas and identity helpers;
  - export compatible state types without weakening version-1 validation.
- `packages/contracts/src/protocol.ts`
  - protocol 15 deliver request/result and exact-item delivery state.
- `apps/local-server/src/queue-decision-store.ts`
  - v1 compatible read, normalized v2 observation, atomic migration;
  - serialized begin/finish delivery mutations and hash validation.
- `apps/local-server/src/queue-delivery-payload.ts`
  - deterministic answer-file JSON and shell-safe role line plus hashes.
- `apps/local-server/src/answer-file-delivery.ts`
  - canonical no-clobber private atomic publisher and failure boundary.
- `apps/local-server/src/queue-delivery-service.ts`
  - current decision/config/source/target resolution, intent-before-effect,
    adapter invocation, active-attempt tracking, and exact result mapping.
- `apps/local-server/src/queue-observer.ts`
  - narrow exact current source definition lookup if needed.
- `apps/local-server/src/session-manager.ts`
  - read-only exact session summary lookup; reuse existing input operation.
- `apps/local-server/src/ws-hub.ts`
  - inspect join and one strict delivery dispatch.
- `apps/web/src/transport.ts`
  - decision-ID/hash-only request.
- `apps/web/src/pacium-queue-inspection-model.ts`
  - correlated delivery request and persistent state reconciliation.
- `apps/web/src/pacium-queue-decision-panel.tsx`
  - target preview, confirmation, pending/outcome states.
- focused tests, Chromium fixture, active docs, status, and changelog.

### Data/state changes

- Entity/schema changes:
  - queue-state schema version 2:
    `schemaVersion`, positive `revision`, bounded immutable `decisions`, and
    bounded `deliveries`;
  - one delivery record per decision ID/hash;
  - record fields: UUID delivery ID, decision ID/hash, target snapshot,
    deterministic payload hash/byte length, requested time, nullable final
    outcome, and recomputable canonical delivery hash;
  - outcome: `delivered | failed | unknown`, recorded time, fixed evidence or
    fixed error;
  - every delivery references one present decision with a matching hash.
- Commands/events:
  - client `pacium.queue.decision.deliver`;
  - server `pacium.queue.delivery`;
  - exact `pacium.queue.item` includes delivery state only with a decided
    decision state.
- Idempotency:
  - store serializes `beginDelivery`;
  - first accepted intent owns the only adapter invocation;
  - same decision request returns the existing record;
  - concurrent requests cannot create two attempts;
  - failed, unknown, delivering, or delivered attempts block another attempt.
- Migration:
  - reads accept exact schema 1 or 2;
  - schema 1 normalizes in memory to decisions plus empty deliveries;
  - first decision or delivery mutation writes complete schema 2 atomically;
  - all decision bytes and hashes are preserved exactly;
  - invalid/unsupported state remains untouched.

### Protocol changes

- Bump `PROTOCOL_VERSION` to 15.
- Request:

```text
pacium.queue.decision.deliver(requestId, decisionId, decisionHash)
```

- The strict request accepts no workspace/source identity, target, path, role,
  session, method, payload, command, terminal data, retry flag, or actor claim.
- Response:

```text
pacium.queue.delivery(requestId, result)
```

- Result is `delivered | failed | unknown | existing | rejected`; only states
  that have a persisted attempt contain its complete bounded record.
- Exact item inspection adds a strict delivery-state union. A ready item with
  an open decision has no delivery state. A decided item always has exactly one
  state derived from current config plus persisted attempt evidence.
- All messages remain below 128 KiB; answer bodies are not duplicated in
  delivery responses beyond the existing decision inspector record.

### Authorization and privilege

- Existing loopback/Host/Origin/token checks protect the request.
- The server resolves method and target from accepted `pacium.json` only.
- The decision record supplies payload; the browser cannot alter it.
- Answer-file authority is one no-clobber create at one accepted path.
- Role-prompt authority is one fixed-shape line to one exact configured live
  PTY. It does not launch, interrupt, resize, terminate, or select another PTY.
- Queue source text remains data and is never serialized into a delivery,
  executed, or parsed as a target.

## Sequence

1. Add and commit this issue and implementation plan.
2. Add strict queue delivery and state-v2 contracts with fixed bounds/errors.
3. Add canonical delivery hashing and state cross-reference tests.
4. Extend the store to accept v1/v2 and atomically migrate without decision
   changes.
5. Add serialized `beginDelivery` and `finishDelivery` operations with injected
   fault tests.
6. Add deterministic answer-file and role-line serialization.
7. Add the private atomic no-clobber answer-file publisher.
8. Expose exact current source definition and exact session summary reads.
9. Implement delivery resolution and state inspection without side effects.
10. Implement intent-before-effect delivery and active-attempt ownership.
11. Add protocol-15 contracts and strict forbidden-field tests.
12. Wire exact item inspection and authenticated delivery dispatch.
13. Add real-file and real/fake-PTY server integration evidence.
14. Add browser transport and delivery reducer state.
15. Add configured target preview and explicit confirmation UI.
16. Add delivered/failed/unknown presentation and responsive styling.
17. Extend Chromium coverage for answer-file and role-prompt delivery.
18. Synchronize filesystem/protocol/security/README/STATUS/backlog/changelog.
19. Run focused gates, `pnpm verify`, and full Chromium.
20. Close acceptance evidence, audit the clean small-commit series,
    fast-forward into `dev`, and push exact `origin/dev`.

## Failure model

| Failure point                          | Expected state                                    | Recovery                                       |
| -------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| No method configured                   | `not_configured`; no intent                       | Configure explicitly in a later setup slice    |
| Config/source/decision drift           | `unavailable` or rejected; no intent              | Refresh/reopen exact current item              |
| Role preset-only/missing/ended         | `unavailable`; no intent                          | Bind one exact live role session               |
| State v1 valid                         | Ready; no rewrite on inspection                   | First accepted mutation migrates atomically    |
| State invalid/unsafe/full              | `unavailable`; no side effect                     | Repair/move state explicitly                   |
| Intent write fails before rename       | No side effect; prior state authoritative         | Inspect, then deliberate action if still ready |
| Intent directory sync fails            | Unknown; adapter is not invoked                   | Inspect state; PC049 resolves                  |
| Answer target already exists           | Persisted `failed`; target unchanged              | PC049 conflict/resolution                      |
| Temp write/sync/link fails before link | Persisted `failed`; target absent/unchanged       | PC049 explicit resolution                      |
| Parent sync/cleanup fails after link   | Persisted or inferred `unknown`; no retry         | Inspect target manually; PC049 resolves        |
| Role exits/rebinds before input        | Persisted `failed`; no other PTY touched          | PC049 explicit resolution                      |
| PTY accepts fixed line                 | `delivered` with transport evidence               | Await PC049/provider evidence                  |
| Final outcome write fails              | Persisted intent becomes `unknown`                | Reload/restart; never resend                   |
| Browser disconnect                     | Server attempt continues; browser assumes unknown | Reconnect and inspect durable state            |
| Server restart with null outcome       | `unknown`; no adapter invocation                  | PC049 explicit resolution                      |
| Duplicate/concurrent deliver           | Existing attempt returned; no side effect         | Inspect existing evidence                      |

## Compatibility

- Supported versions: protocol 15, Pacium config schema 1, queue-state schemas
  1 and 2 on read, queue-state schema 2 on write, answer payload format
  `pacium_decision_v1`, role line `Pacium decision v1`.
- Fallback behavior: no method or unsafe target disables delivery without
  changing decisions, sources, PTYs, or General mode. Missing acknowledgement
  remains unverified.
- Rollback: PC-047 cannot interpret schema 2 and must preserve it. Roll back
  only after copying state and accepting temporary decision-state
  unavailability; never down-convert or delete delivery evidence.

## Test plan

- Unit:
  - all schemas, bounds, hashes, cross references, fixed errors;
  - deterministic JSON and comment line, Unicode/control/metacharacters;
  - resolver and browser reducer/UI state.
- Property/fault:
  - v1/v2 corruption and tampering;
  - every begin/finish atomic I/O boundary;
  - concurrent duplicate attempts;
  - temp/link/sync/cleanup failure.
- Contract:
  - protocol 15 request/result/item invariants and maximum size;
  - forbidden browser authority fields;
  - question/approval payload preservation.
- Integration:
  - valid v1 migration with byte-identical decisions;
  - answer-file mode/content/hash/no-clobber;
  - exact role session/epoch and exact one-line PTY bytes;
  - intent before adapter invocation;
  - final-write failure and restart unknown;
  - source/config/target/repository/unrelated PTY preservation.
- Browser:
  - unconfigured state;
  - answer-file preview/cancel/confirm/delivered/reload;
  - role preview/confirm/transport-only copy;
  - failed and unknown states without retry;
  - focus, selected PTY, terminal input ownership;
  - 320 CSS px, 200% zoom, forced colors, reduced motion.
- Security:
  - symlink/parent drift, existing target, forged fields, multiline/shell
    injection, path/role/session confusion, hostile evidence rendering;
  - no source/payload/path/terminal bytes in logs/errors.
- Performance:
  - 4,096 decisions/attempts and 4 MiB queue-state ceiling;
  - one serialized state writer and bounded one-shot adapters;
  - no polling or background automatic delivery.

## Documentation changes

- Update filesystem state for schema 2 and intent/outcome recovery.
- Document protocol 15 and exact answer-file/role-prompt formats in the Pacium
  workspace contract.
- Update SECURITY with no-clobber file and shell-safe role prompt boundaries.
- Update README/STATUS/backlog with delivered versus unacknowledged truth.
- Record exact verification counts, bundle sizes, runtime mismatch, and
  remaining PC049-PC050 limitations in CHANGELOG and completion evidence.

## Rollout

- Development: deterministic serializers, fake adapter, and disposable state.
- Integration: disposable answer target and live shell-safe PTY fixture only.
- Canary: localhost operator with explicit confirmation and inspectable
  compatibility targets. No automatic delivery.
- Production: none; Pacium Control remains pre-release.

## Open questions

- Keep one attempt terminal in PC048. PC049 adds operator-visible conflict and
  resolution rather than a generic retry flag.
- Treat the answer file as a no-clobber single-slot mailbox. Other legacy file
  layouts require separately typed configured adapters.
- Treat PTY acceptance as delivered-at-transport with explicit weaker evidence;
  provider observers can add acknowledgement later.
- Keep delivery records in queue-state schema 2 so decision and attempt
  uniqueness are validated in one atomic document without a journal/database.

## Approval

- Product: delivery remains a compact second step inside the existing decided
  inspector, with no dashboard or generalized workflow shell.
- Architecture: one versioned queue-state document and two typed adapters are
  the smallest compatibility loop already anticipated by accepted config.
- Security: server-owned target resolution, intent-before-effect, no-clobber
  file creation, shell-safe fixed PTY bytes, and no retry preserve the accepted
  authority boundary.
