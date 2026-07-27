# Implementation plan: PC-050 worker and objective context

- Issue: [PC-050 worker and objective context](worker-objective-context-issue.md)
- Owner: Local implementation agent
- Agent/session: Codex `/root`
- Branch: `codex/worker-objective-context`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `55af59c2f95f206579c9b54a74713fc1a3d9bcb8`
- Target milestone: Milestone 3 — Pacium mode
- Status: In progress

## Objective

Complete the first Pacium compatibility loop with the smallest useful context
surface: configured workers in exact session context, current objective and
optional plan text from accepted files, and recent immutable decision evidence.
Keep the terminal dominant and every status tied to an existing source of
truth.

PC-050 does not introduce runs, tasks, assignments, provider narrative,
background polling, a worker launcher, durable activity projections, arbitrary
file reads, or causal claims about resulting work.

## Existing behavior

- Protocol 16 exposes accepted Pacium configuration, exact session summaries,
  queue observations/items, immutable decisions, compatible delivery attempts,
  source/target reconciliation, and explicit human-labelled lifecycle state.
- Version-1 `pacium.json` already contains up to 64 ordered worker slots and
  nullable canonical plain-text objective/plan paths, but no runtime consumes
  those paths.
- Configured workers already appear as eligible explicit prompt targets, but
  there is no worker group, exact status row, or Open action.
- Session summaries already own direct-PTY process state, fixed launch
  classification, and bounded repository branch/HEAD/worktree observations.
  The browser derives honest process-only attention and has selected-session
  Git changes/activity views.
- Version-3 `queue-state.json` contains validated immutable decisions,
  append-only delivery attempts, and human-labelled lifecycle resolutions.
  Recent records are not exposed outside exact current queue-item inspection.
- The right inspector already supports session details and exact queue-item
  routing. Browser mode/config/disconnect transitions already clear unsafe
  queue text and pending requests.

Primary existing modules:

- `packages/contracts/src/pacium-config.ts`
- `packages/contracts/src/protocol.ts`
- `packages/contracts/src/queue-decision.ts`
- `packages/contracts/src/queue-delivery.ts`
- `packages/contracts/src/queue-reconciliation.ts`
- `apps/local-server/src/pacium-config-service.ts`
- `apps/local-server/src/queue-decision-store.ts`
- `apps/local-server/src/ws-hub.ts`
- `apps/web/src/pacium-config-model.ts`
- `apps/web/src/pacium-prompt-target-model.ts`
- `apps/web/src/pacium-role-model.ts`
- `apps/web/src/recent-activity-model.ts`
- `apps/web/src/app.tsx`

## Proposed behavior

### Configured workers

One pure browser projection maps every accepted worker slot in configured order
to its exact binding:

- exact session binding:
  - resolve only the configured UUID;
  - show process state, process-derived attention source/confidence/freshness,
    command/provider classification, and repository branch/worktree;
  - show existing changed-file totals only when the same session's already
    accepted changes state is visible;
  - expose Open only while the exact PTY can be selected;
- launch-preset binding:
  - show configured preset and configured repository;
  - label it `Configured · not started`;
  - add no Launch action in PC-050;
- missing/disconnected/config-error states:
  - preserve the configured identity and explain that no replacement was
    inferred.

Opening a worker invokes the existing browser session selection path. The row
adds no transport operation, config mutation, PTY input, or lifecycle state.

### Control context

The Pacium summary gains `Open context`. It opens a third right-inspector route
beside the existing session and queue routes. Queue selection takes precedence.
Back or Escape closes Control context and restores the trigger focus.

Initial open and explicit Refresh each send one:

```text
pacium.context.inspect(requestId)
```

The server takes one accepted configuration snapshot, reads only its configured
objective/plan paths, inspects validated queue state, rechecks the same config
revision, and returns:

```text
pacium.context(requestId, observation)
```

The browser accepts only the matching pending request and currently accepted
workspace ID/revision. Config change, disconnect, mode exit, Back, or another
route clears decoded context text and pending intent. A late response cannot
reopen or repopulate the inspector.

### Context-file observations

Each of `objective` and `plan` is independent:

- `unconfigured`: no accepted source path;
- `ready`: complete stable UTF-8 bytes with bounded base64 content and
  provenance;
- `empty`: stable zero-byte regular file;
- `missing`: accepted leaf is absent;
- `changing`: metadata changed across the bounded read;
- `oversized`: file exceeds 32 KiB;
- `invalid_utf8`: stable bytes are not strict UTF-8;
- `unsafe_type`: symlink or non-regular leaf;
- `unreadable`: bounded filesystem failure.

Ready evidence contains source kind, fixed format, path, observed time, byte
length, modification time, SHA-256 content hash, and content base64. Other
states contain only applicable bounded metadata and safe error copy. The
reader performs one no-follow open/read/fstat sequence and never creates,
watches, repairs, truncates, or writes a file.

### Recent decision evidence

The server sorts validated decisions by `decidedAt` descending, then decision
ID ascending, and returns at most twelve summaries. Each summary contains:

- exact decision ID/hash;
- source workspace/source/item IDs and content hash;
- current source label when the same accepted source ID still exists, otherwise
  a nullable label and `sourceCurrent: false`;
- question-answer or approval-decision kind;
- a question answer preview bounded to 320 UTF-8 bytes plus `truncated`, or the
  exact approved/denied outcome;
- decision time and local-operator label;
- attempt count and latest durable attempt ID/hash/status/time/evidence kind;
- latest lifecycle resolution ID/hash/action/time and fixed
  `human_labelled` source.

Notes, delivery target paths, target role/session identity, payload bytes,
errors, queue text, terminal bytes, and provider data remain excluded.
Unavailable queue state returns a bounded decision-summary error while
objective/plan evidence remains usable. Empty state returns an empty list, not
an unavailable claim.

The inspector labels decision recording, transport attempt, and lifecycle
evidence separately and states that none proves resulting Git/terminal work.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/pacium-context.ts` (new)
  - source status/evidence, recent decision summary, response observation,
    fixed bounds and safe errors.
- `packages/contracts/src/protocol.ts`
  - protocol 17 request/response messages.
- `packages/contracts/src/index.ts`
  - public context contract exports.
- `apps/local-server/src/context-file-reader.ts` (new)
  - bounded stable no-follow exact-file inspection.
- `apps/local-server/src/pacium-context-service.ts` (new)
  - config snapshot/recheck and recent-state projection.
- `apps/local-server/src/ws-hub.ts`
  - authenticated context dispatch.
- `apps/web/src/pacium-worker-model.ts` (new)
  - exact binding/session/attention/repository projection.
- `apps/web/src/pacium-workers.tsx` (new)
  - compact configured worker group and Open action.
- `apps/web/src/pacium-context-model.ts` (new)
  - idle/loading/ready state, request correlation, config/disconnect/mode
    invalidation, and strict base64 decoding.
- `apps/web/src/pacium-context-inspector.tsx` (new)
  - objective, plan, and recent-decision presentation.
- `apps/web/src/pacium-mode-summary.tsx`
  - Open context action.
- `apps/web/src/transport.ts`
  - request constructor.
- `apps/web/src/app.tsx`
  - worker derivation, inspector routing, request lifecycle, and focus return.
- `apps/web/src/styles.css`
  - compact worker/context hierarchy and accessibility states.
- focused tests, Playwright fixture/workflow, active docs, status, backlog, and
  changelog.

### Data/state changes

- Entity/schema changes:
  - none;
  - context observations and recent-decision summaries are disposable;
  - worker models are browser projections.
- Commands/events:
  - client `pacium.context.inspect`;
  - server `pacium.context`.
- Idempotency:
  - every request is read-only;
  - browser request identity and workspace revision accept one matching result;
  - repeated Refresh creates a fresh independent observation.
- Migration:
  - none for `pacium.json`, `queue-state.json`, or browser storage.

### Protocol changes

- Bump `PROTOCOL_VERSION` from 16 to 17.
- Client request contains only `type` and bounded UUID `requestId`.
- Server response contains the request ID and one strict observation:
  - accepted workspace ID/revision;
  - independent objective/plan source observations;
  - recent decision state `ready | unavailable`;
  - at most twelve strict decision summaries;
  - observation time.
- The complete maximum message remains below 128 KiB:
  - two context sources at 32 KiB raw each, base64 encoded;
  - twelve 320-byte previews plus bounded metadata;
  - fixed errors and no notes/targets/queue text.
- No response is broadcast. Context reads occur only for the requesting
  authenticated socket.

### Authorization and privilege

- Existing loopback Host/Origin/token checks remain the network boundary.
- `PaciumContextService` resolves configuration and data paths internally.
- The browser cannot submit workspace revision, path, source kind, queue
  identity, filter, range, count, target, session, command, or read flags.
- The file reader receives only an accepted normalized context source, opens
  with no-follow semantics, verifies regular type, bounds bytes, checks stable
  metadata, and validates strict UTF-8.
- The service invokes no shell, Git command, PTY input, provider API, delivery,
  resolution, or state write.
- All context and preview content renders as React text, never Markdown, HTML,
  ANSI, hyperlink, command, or terminal input.

## Sequence

1. Commit the PC-050 issue and this plan separately.
2. Add strict context-source and recent-decision summary contracts.
3. Add protocol-17 request/response schemas and maximum-message tests.
4. Add the stable no-follow context reader and complete status matrix.
5. Add pure recent-decision ordering/preview/delivery/lifecycle projection.
6. Add the config-snapshot context service with revision recheck.
7. Wire authenticated WebSocket context inspection.
8. Add integration tests for real context files, queue state, drift, restart,
   and unchanged external state.
9. Add pure worker models for session, preset, missing, disconnected, and
   already-available changes evidence.
10. Render the compact Workers group with exact Open behavior.
11. Add correlated browser context state and strict base64 decoding.
12. Add the Control context inspector route and summary trigger.
13. Render objective/plan provenance, text, empty/degraded states, and Refresh.
14. Render bounded recent decision, transport, and lifecycle evidence with
    explicit non-causality copy.
15. Complete focus, Escape, route precedence, config/mode/disconnect
    invalidation, responsive, forced-color, and reduced-motion behavior.
16. Extend Chromium fixtures/workflows for workers, context, decisions,
    reconnect, and unchanged PTY/config/files.
17. Synchronize architecture, security, workspace protocol, workflow, README,
    STATUS, backlog, changelog, issue, and plan.
18. Run focused tests after every coherent slice, then `pnpm verify` and full
    Chromium at the exact head.
19. Audit the small commit series and clean worktree, fast-forward into `dev`,
    push exact `origin/dev`, and continue to the next roadmap task.

## Failure model

| Failure point                        | Expected state                                                   | Recovery                                               |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Pacium unconfigured                  | Workers/context unavailable; General terminals survive           | Configure outside PC-050 and refresh definition        |
| Config invalid or unreadable         | Bounded configuration error; no context path opened              | Repair config externally and Retry                     |
| Objective/plan unconfigured          | Independent teaching empty state                                 | Configure a source if useful                           |
| Context leaf missing                 | Missing evidence; no file created                                | Restore the configured file and Refresh                |
| Context symlink/special file         | Unsafe-type evidence; target untouched                           | Replace externally with a regular file                 |
| Context changes during read          | Changing evidence; no partial text returned                      | Refresh after writer settles                           |
| Context oversized/invalid UTF-8      | Degraded evidence without content                                | Reduce or convert externally and Refresh               |
| One context read fails               | Partial inspector; other source and decisions remain usable      | Repair source and Refresh                              |
| Config changes during service read   | Config-drift result; no mixed-revision response                  | Browser refreshes definition and inspects again        |
| Queue state missing                  | Ready empty recent-decision list                                 | Record a decision through the exact queue workflow     |
| Queue state invalid/unavailable      | Decision section degraded; context files remain usable           | Repair or move private state explicitly                |
| Decision preview exceeds bound       | UTF-8-safe prefix plus explicit truncated label                  | Open exact current item when still available           |
| Worker session missing after restart | Exact configured ID shown as Missing; no inferred replacement    | Rebind through a later explicit configuration workflow |
| Worker launch preset configured      | Ready/not-started row; no automatic launch                       | Launch a terminal through existing workspace controls  |
| Git changes not already inspected    | `Changes not inspected`; no background Git request               | Open worker and use existing Changes/Activity view     |
| Browser disconnect during inspect    | Pending intent/text cleared; PTYs and files unchanged            | Reconnect and Open context again                       |
| Late or cross-revision response      | Reducer rejects response                                         | Current matching request completes                     |
| Queue row opened over context        | Queue inspector takes precedence; context request cannot replace | Back from queue, then reopen context                   |
| Hostile context/preview text         | Bounded inert whitespace-preserving text                         | Inspect owner file directly if needed                  |

## Compatibility

- Supported versions:
  - protocol 17;
  - Pacium config schema 1;
  - queue-state schemas 1, 2, and 3 on read;
  - unchanged browser preference schemas.
- Fallback behavior:
  - no context sources yields teaching empty states;
  - invalid decision state does not hide objective/plan or workers;
  - no provider observer yields process-only Unknown attention;
  - missing selected-session changes evidence stays unavailable.
- Rollback:
  - remove protocol-17 context messages, reader/service, worker group, and
    inspector route;
  - no durable data requires conversion or deletion;
  - protocol-16 clients and servers must remain version-matched.

## Test plan

- Unit:
  - every context source state and safe copy;
  - stable metadata, no-follow, exact byte and UTF-8 bounds;
  - UTF-8-safe preview truncation;
  - decision sorting/ties, source-label join, latest attempt/resolution;
  - worker exact binding, process/attention/repository/change evidence;
  - browser request/state identity and invalidation.
- Property/fault:
  - file replacement before/during/after open;
  - maximum source/message sizes;
  - malformed base64 and UTF-8;
  - invalid decision timestamps/cross references already rejected by store;
  - simultaneous context/config replacement;
  - stale responses across mode/config/route changes.
- Contract:
  - protocol 17 accepted and forbidden fields;
  - independent source status invariants;
  - decision summary cross-field constraints;
  - maximum application message below 128 KiB;
  - protocol mismatch rejection.
- Integration:
  - real objective/plan status matrix and provenance;
  - empty/valid/invalid queue state;
  - multiple attempts and lifecycle summaries;
  - current/former source labels;
  - config drift/restart;
  - byte-for-byte context/config/queue/repository preservation and PTY survival.
- Browser:
  - worker order/status/exact Open;
  - context open/Refresh/Back/Escape;
  - ready/empty/partial/degraded objective/plan;
  - recent decision preview, delivery, lifecycle, truncation;
  - reconnect/config drift/mode exit and route precedence;
  - selected PTY/layout/input ownership;
  - 320 CSS px, 200% zoom, forced colors, reduced motion.
- Security:
  - forged path/revision/source/count/filter/session fields;
  - symlinks/special files/hostile content;
  - no log content, notes, targets, terminal bytes, or provider data;
  - no context/state mutation, terminal input, shell, Git, or network call.
- Performance:
  - two one-shot 32 KiB maximum reads;
  - one bounded validated state read and at most twelve summaries;
  - up to 64 pure worker rows;
  - no watcher, poller, background Git fan-out, or durable projection.

## Documentation changes

- `ARCHITECTURE.md`: disposable context projection and exact worker evidence.
- `SECURITY.md`: accepted context-read authority, no-follow/UTF-8/content
  handling, and decision-summary exclusions.
- `docs/execution/pacium-workspace-configuration.md`: protocol 17 context
  consumer and bounds.
- `docs/workflow/meta-and-orchestrator.md`: implemented worker/context evidence
  and limitations.
- `docs/execution/milestone-3-pacium-mode.md`: exact completion boundary.
- `README.md`, `STATUS.md`, implementation backlog, and `CHANGELOG.md`: honest
  implemented/absent behavior and exact evidence.
- This issue and plan: checked criteria, tests, counts, bundle sizes, runtime
  caveat, and remaining provider/release limitations.

## Rollout

- Development: deterministic worker/decision fixtures and disposable private
  context/state directories.
- Integration: authenticated localhost server with real regular files and one
  real PTY; never use operator context or queue state.
- Canary: localhost operator review only after all automated gates.
- Production: none. Pacium Control remains pre-release.

## Open questions

- PC-050 uses a 320-byte question-answer preview because compact recent
  decisions need the operator's actual direction, not an invented semantic
  summary. The inspector labels truncation and excludes notes.
- Worker change totals appear only when existing selected-session evidence is
  already accepted. Automatically inspecting every configured worker would
  create background Git load and implied fleet monitoring outside this slice.
- The recent-decision section reports durable decision/transport/lifecycle
  evidence, not resulting work. Provider-native events or explicit future
  correlation may add stronger links without rewriting these facts.
- Worker launching and reconfiguration remain separate explicit product
  decisions; PC-050 only opens existing exact live sessions.

## Approval

- Product: the terminal remains dominant; workers are compact and Control
  context uses the existing inspector rather than a dashboard or run shell.
- Architecture: every projection reads existing owners and creates no new
  durable entity, activity journal, task graph, or database.
- Security: one identity-free request, server-resolved accepted paths, bounded
  no-follow reads, inert text, excluded notes/targets, and no mutation preserve
  the browser-to-filesystem/terminal boundary.
