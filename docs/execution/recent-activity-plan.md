# Implementation plan: Recent activity summary

- Issue: [PC-038](recent-activity-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/recent-activity`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `42bef969d4be49941160ee1652e56e0a97b64fdd`
- Target milestone: Milestone 2
- Status: In progress

## Objective

Give the operator one compact, deterministic summary of the selected terminal's
current attention and recent process, Git, and verification facts by projecting
the bounded evidence Pacium already owns. Preserve source and timestamp meaning
without adding an event store, protocol surface, polling loop, or inferred
agent narrative.

## Existing behavior

Protocol 9 and the browser already provide:

- immutable session identity plus process creation, exit, code, and signal
  evidence;
- a deterministic attention reducer whose current implementation is explicitly
  process-observed;
- lazy, per-session changed-file observations with freshness and totals;
- lazy, per-session current-branch commit history capped at 50 records;
- lazy, per-session verification catalogs and the active or latest server-owned
  run;
- request identity, cross-session rejection, disconnect interruption, and
  reconnect recovery for each inspector source.

Overview, Changes, History, and Checks expose those facts separately. There is
no combined summary, activity projection, durable activity state, or Activity
tab.

## Proposed behavior

A pure `buildRecentActivity` model accepts:

```text
selected SessionSummary
current AttentionResult
visible GitChangesObservation | null
visible GitHistoryObservation | null
visible VerificationSnapshot | null
source loading/error metadata
```

It returns a bounded view model, not a new domain source of truth. The model
contains:

- one current attention observation;
- one process lifecycle fact for start plus an exit fact when present;
- one current Git working-tree observation;
- at most three current-branch commit records;
- one active or latest verification fact;
- source-specific availability and loading state.

Each fact has a deterministic ID, kind, source, title, bounded detail,
timestamp, and timestamp semantic: `occurred` for session/process, commit, and
verification lifecycle evidence; `observed` for attention and Git inspection.
Items sort newest first by valid timestamps, then by a fixed kind rank and
stable ID. The projection has a fixed total ceiling and omits invalid timestamp
evidence instead of inventing a time.

Activity is a lazy fifth inspector tab. Its first opening invokes the existing
changes, history, and verification inspect callbacks only when their
per-session state is idle. Refresh explicitly invokes all three. Existing
reducers independently retain visible prior evidence while refreshing and
reject stale or cross-session responses, so Activity can truthfully show
partial evidence without a new coordinating request or state machine.

The UI separates “Current evidence” from “Recent facts.” It labels the attention
source/confidence and says that process evidence does not prove assigned-task
progress. Fact rows show source, “Observed” or “Occurred,” and local time.
Source errors stay visible in a compact availability section and say that the
terminal remains available. Verification output, diff content, terminal bytes,
and repository file content never enter the projection.

## Architecture and boundaries

### Modules touched

- New browser activity model and unit tests.
- New Activity inspector component and semantic tests.
- Existing inspector tabs for a fifth semantic tab and keyboard order.
- `app.tsx` for deriving visible evidence, lazy request effects, and Refresh.
- Existing CSS for compact activity hierarchy and 320 CSS px behavior.
- Playwright fixtures/workflows for end-to-end evidence.

### Data/state changes

- Entity/schema changes: none; `ActivityEntry` remains a bounded transient
  application projection rather than durable state.
- Commands/events: none; reuse `repository.changes`,
  `repository.history`, and `verification.inspect`.
- Idempotency: lazy open requests only idle sources; Refresh deliberately
  repeats all three read-only requests.
- Migration: none.

### Protocol changes

- `PROTOCOL_VERSION` remains 9.
- Activity consumes existing validated response types and never serializes a new
  request or response.
- Existing response bounds, request identities, repository ownership, and
  verification snapshot contracts remain authoritative.

### Authorization and privilege

- Existing exact Origin and ephemeral local-token checks authorize every reused
  request.
- The selected server-owned session continues to select repository evidence.
- Activity adds no shell, process, signal, path, file-content, terminal-input,
  provider, or queue endpoint.
- Commit subjects are bounded by the history contract and rendered as text.

## Sequence

1. Commit the PC-038 issue and this implementation plan separately.
2. Add the pure activity types, constants, and empty/current-evidence
   projection.
3. Add process lifecycle facts and honesty tests.
4. Add Git working-tree and bounded commit projections with ordering tests.
5. Add verification projections and source availability summaries.
6. Add the fifth inspector tab and complete five-tab keyboard tests.
7. Add the Activity component in current, loading, partial, degraded, and empty
   states.
8. Wire selected-session visible evidence and lazy existing requests.
9. Add explicit Refresh and reconnect/session-switch behavior.
10. Add compact styling and 320 CSS px semantic/layout coverage.
11. Add a browser workflow proving lazy reads, current/process/Git/check facts,
    Refresh, keyboard movement, and unchanged terminal selection.
12. Synchronize docs, complete acceptance evidence, and run all gates.
13. Fast-forward and push the small coherent commit series to `dev`.

## Failure model

| Failure point                | Expected state                                           | Recovery                              |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------- |
| No selected session          | Inspector keeps existing no-selection shell              | Select or create a terminal           |
| Source still idle            | Lazy request begins; other facts remain visible          | Wait or use Refresh                   |
| Git changes unavailable      | Git source message plus process/attention/check facts     | Restore repository and Refresh        |
| History unavailable/unborn   | Explicit source message; no fabricated commit activity   | Create/restore HEAD and Refresh       |
| Verification unconfigured    | “No matching presets” source state, not an error          | Configure presets or continue         |
| Verification read fails      | Existing bounded error evidence; terminal survives       | Inspect config/server and Refresh     |
| One source is refreshing     | Prior visible evidence remains labelled with its time     | Wait for matching response            |
| Stale response arrives       | Existing reducer rejects it; projection stays unchanged  | Current request completes             |
| Session changes during load  | New selected session gets its own projection              | Existing request cannot cross session |
| Browser disconnects          | PTY and server verification run survive                  | Reconnect and re-inspect              |
| Invalid evidence timestamp   | Invalid item is omitted; source stays degraded/available | Refresh source                        |
| Hostile display text         | Bounded plain text only                                  | Inspect source directly if needed     |

## Compatibility

- Supported versions: protocol-9 browser/server pair on the existing macOS-first
  Node.js 24 target.
- Fallback behavior: the four existing inspector views and terminal remain
  independently usable if Activity is partial or unavailable.
- Rollback: remove the client projection, fifth tab, and styles; no server,
  protocol, or durable state rollback is required.

## Test plan

- Unit: deterministic IDs, valid timestamp enforcement, occurred/observed
  semantics, stable tie ordering, total/category ceilings, source states,
  process start/exit/failure honesty, Git totals, three-commit cap, verification
  lifecycle, and hostile bounded text.
- Property/fault: invalid dates, empty subjects, maximum contract text, partial
  observations, simultaneous timestamps, and contradictory unavailable
  sources.
- Contract: regression-test existing request constructors and assert no Activity
  protocol message exists or is needed.
- Integration: existing server Git/history/verification tests remain the
  boundary proof; Activity adds no server path.
- Browser: fifth-tab navigation, lazy source requests, Refresh, process and
  attention labels, changed-file total, commit item, verification item, partial
  failure, reconnect, unchanged terminal selection, and 320 CSS px layout.
- Security: repository/terminal/verification content exclusion, plain-text
  commit subjects, no terminal input, no command execution, no persistence, and
  no new WebSocket authority.
- Performance: at most one attention item, two process items, one changes item,
  three commits, one verification item, and a fixed total of eight recent
  facts; no polling and no repeated idle-source request loop.

## Documentation changes

- Mark PC-038 complete in status and backlog only after evidence passes.
- Synchronize README capability/limitation copy and changelog.
- Record durable unread cursors, provider-native activity, optional narrative,
  automatic refresh, queue activity, and Pacium grouping as deferred.

## Rollout

- Development: deterministic component fixtures and temporary Git repositories.
- Integration: full unit, semantic, browser, and production-build gates.
- Canary: localhost development only.
- Production: none; the project remains a pre-release executable slice.

## Open questions

- Durable “since last checked” behavior requires an event-retention and cursor
  contract. The historical generalized event blueprint is superseded and is not
  revived by this slice.
- Optional agent narrative needs an explicit labelled source and retention
  boundary after provider-native observations exist.

## Approval

- Product: one compact selected-terminal summary with honest labels and no
  decorative dashboard.
- Architecture: pure bounded projection over existing owners; no duplicate
  system of record or protocol.
- Security: no new authority, content interpretation, terminal input,
  execution, persistence, or logging surface.
