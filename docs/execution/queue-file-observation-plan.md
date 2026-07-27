# Implementation plan: Bounded queue-file observation

- Issue: [PC-044](queue-file-observation-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/queue-file-observation`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `529b65f31f900fc394b2d7752bb05150c0608bc4`
- Target milestone: Milestone 3
- Status: In progress

## Objective

Turn accepted queue-source path metadata into safe, bounded, current
observation evidence. Read only complete stable regular UTF-8 files, retain the
bounded original text solely inside the local queue service, and give Pacium
mode a compact source-health consumer. Add no item parsing, classification,
decision, delivery, content rendering, or durable speculative state.

## Existing behavior

- Protocol 11 is not yet defined; protocol 10 carries strict Pacium workspace
  configuration but no queue observation operation or event.
- `pacium.json` can configure at most 32 uniquely identified `plain_text`
  sources with canonical absolute paths, requesting roles, and optional
  delivery references.
- Configuration validation accepts an existing regular non-symlink leaf or a
  missing leaf under an existing canonical parent. It grants no content-read
  authority before this issue.
- The browser reads accepted config on connect and Pacium mode displays only a
  configured queue-source count.
- The local server already owns the HTTP/WebSocket lifecycle and disposes PTY
  subscriptions and verification processes on shutdown.
- No queue content, hash, observation cache, provenance file, watcher, parser,
  item, decision, or answer state exists.

## Proposed behavior

1. Synchronize one queue observer with the latest accepted config at server
   startup and after every config get/replace.
2. Group configured sources by canonical parent and watch those parents so
   missing-file creation and atomic replacement are observable.
3. Debounce source events, perform a bounded no-follow stable read, and publish
   only changed source evidence.
4. Retain exact stable original text behind an internal source-ID/config-
   revision API for PC-045, never in protocol messages or logs.
5. Let the browser request a complete content-free snapshot and receive complete
   push snapshots when source evidence changes.
6. Project source evidence only against the matching accepted workspace
   revision and render a compact Pacium-only health group.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/queue-observation.ts`: strict status, source evidence,
  and aggregate observation schemas and bounds.
- `packages/contracts/src/protocol.ts`: protocol 11 observe request, correlated
  snapshot, and uncorrelated complete update.
- `apps/local-server/src/queue-file-reader.ts`: bounded no-follow open/read,
  strict UTF-8 decode, file identity/stability checks, and SHA-256.
- `apps/local-server/src/queue-observation-model.ts`: pure source transitions,
  equality, revision rules, stale-generation rejection, and aggregate state.
- `apps/local-server/src/queue-observer.ts`: config reconciliation,
  parent-directory watchers, debounce/retry timers, in-memory text, subscriber
  snapshots, and disposal.
- `apps/local-server/src/ws-hub.ts`, `http-server.ts`, and `index.ts`: lifecycle,
  read-only dispatch, config synchronization, and bounded broadcast.
- `apps/web/src/transport.ts`: observe request.
- `apps/web/src/pacium-queue-model.ts`: correlated browser state and exact config
  revision/source projection.
- `apps/web/src/pacium-queue-sources.tsx`: semantic source-health group.
- `apps/web/src/app.tsx` and `styles.css`: Pacium-only request lifecycle,
  reconnect/config refresh, rendering, responsive/accessibility behavior.
- Focused contract, reader, model, watcher, integration, semantic, security, and
  Playwright tests.

### Data/state changes

- Entity/schema changes: new ephemeral queue observation contracts only.
  `pacium.json` remains schema version 1.
- Server current state per source:
  `{configRevision, sourceId, generation, observationRevision, status,
observedAt, byteLength, modifiedAt, contentHash, error}` plus bounded original
  text stored separately and present only for stable/empty evidence.
- Browser state: accepted correlated aggregate observation plus an optional
  pending request ID. It contains no queue text.
- Commands/events: `pacium.queue.observe`, `pacium.queue.sources`, and
  `pacium.queue.sources.updated`.
- Idempotency: unchanged complete evidence does not advance revision or emit;
  Refresh can repeat safely because it performs no mutation.
- Migration: none. No queue state file is created.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 10 to 11.
- Client request:

```text
pacium.queue.observe {
  requestId
}
```

- Correlated response and push update carry one aggregate:

```text
status: loading | unconfigured | config_error | ready
workspaceRevision: number | null
observedAt
sources[]:
  sourceId
  observationRevision
  status
  observedAt
  byteLength?
  modifiedAt?
  contentHash?
  error?
```

- Source status is one of `pending`, `stable`, `empty`, `missing`, `changing`,
  `oversized`, `invalid_utf8`, `unsafe_type`, `read_error`, or
  `watch_error`.
- Contracts enforce at most 32 sources, configured identifier bounds, SHA-256
  lowercase hex, safe integer byte/revision bounds, ISO timestamps, bounded
  error code/message, strict objects, and state-dependent nullable fields.
- Protocol contains no path, label, requesting role, original text, parsed
  text, command, prompt, delivery, decision, or answer field. The browser joins
  evidence to already accepted config by source ID and exact config revision.

### Authorization and privilege

- The authenticated WebSocket operation selects no path. The server gets paths
  only from a ready accepted Pacium configuration.
- The observer runs with local-user read authority and does not expand it.
- Every read rechecks leaf type and identity because an accepted path can drift
  after configuration validation.
- `O_NOFOLLOW` is used when available; `lstat`, opened-file `fstat`, and final
  path `stat` evidence must agree on regular-file device/inode/size/mtime.
- The service never writes, locks, chmods, repairs, executes, renders, or logs
  queue content.

## Read and watcher contract

### Bounds

- Maximum configured sources: existing 32.
- Maximum complete source bytes: 65,536.
- Read allocation: at most 65,537 bytes to detect overflow.
- Maximum retained original text: one complete decoded string per stable/empty
  source, at most 65,536 UTF-8 bytes.
- Debounce: 200 ms after the newest relevant event.
- Stability retry: at most three attempts for one scheduled observation, with
  short bounded backoff and generation cancellation.
- No periodic polling. Explicit Refresh and filesystem events are the only
  post-start triggers.

### Stable read

1. Capture the observer generation and accepted configured source.
2. `lstat` the exact path without following links.
3. Return Missing for `ENOENT`; return Unsafe file for symlink/non-regular.
4. Open read-only with no-follow, then `fstat` the opened descriptor.
5. Read at most limit plus one; Oversized has no text/hash.
6. `fstat` again and `stat` the path.
7. Require regular type and matching device/inode/size/mtime evidence before,
   during, and after the read.
8. Decode with fatal UTF-8. Invalid text has no text/hash.
9. Hash the exact complete bytes and publish Stable or Empty.
10. If evidence changed, retry within budget; otherwise publish Changing.

Nanosecond precision is used when Node exposes it. The file descriptor always
closes in `finally`.

### Watch lifecycle

- Parent directories are grouped so one platform watcher can cover several
  configured sources.
- A filename event schedules only matching source basenames; a missing filename
  schedules every source in that parent because some platforms omit it.
- Watch errors degrade affected sources to Watch error but do not discard or
  mutate configured state.
- A config generation change cancels all old timers, closes unused parent
  watchers, drops removed in-memory text, creates new groups, and rejects late
  completions from the prior generation.
- Startup and config reconciliation explicitly observe every current source;
  correctness does not depend on an initial watcher event.
- Shutdown clears timers, closes watchers, clears subscribers, and makes late
  work inert.

## UI behavior and states

| Evidence                 | Pacium Queue sources surface                          |
| ------------------------ | ----------------------------------------------------- |
| Config loading           | Reading configured queue sources                      |
| Unconfigured             | No queue sources configured                           |
| Config error             | Configuration error; terminals continue               |
| Ready, zero sources      | Empty state explaining where sources are configured   |
| Pending/changing         | Neutral activity state with observed/retry copy       |
| Stable                   | Green text/icon plus bytes, hash prefix, freshness    |
| Empty                    | Explicit valid Empty, zero bytes, hash prefix         |
| Missing                  | Muted/amber Missing; watcher remains active           |
| Oversized/invalid/unsafe | Red/amber bounded reason; no content/hash implication |
| Read/watch error         | Bounded error and explicit Refresh                    |
| Disconnected             | Last accepted evidence labelled stale/disconnected    |

Sources remain in accepted config order. Labels, requesting roles, and paths
come from accepted config and render only as text. The source path is available
as a title/detail but no path is clickable or executable. Refresh is disabled
while disconnected or a correlated request is pending.

The group sits under Primary roles. It does not claim a queue-item count and
does not compete with the terminal canvas. Mode exit hides the group but does
not stop the server observer or alter browser terminal state.

## PTY/process lifecycle

- Queue observation launches, attaches, inputs, resizes, signals, closes, or
  relaunches no PTY.
- Browser refresh and mode changes do not affect watchers or PTYs.
- Local-server shutdown disposes watchers before process exit, then follows the
  existing PTY shutdown path.
- Queue text can never enter terminal input.

## Reconnect and failure behavior

- Reconnect requests a fresh complete snapshot after accepted config.
- The browser retains last accepted evidence during a transient disconnect but
  labels it disconnected and accepts no update whose config revision differs.
- A request interrupted by disconnect becomes idle; reconnect explicitly reads
  again.
- Config replacement temporarily makes old queue evidence stale until the
  observer publishes the exact new revision.
- Watch failure does not prevent explicit Refresh from attempting a direct
  stable read.
- Read failure clears current text/hash for that source rather than presenting
  earlier content as current.
- No observer failure affects terminals, config replacement, General mode, or
  other sources.

## Sequence

1. Commit issue and plan separately.
2. Add strict queue-observation contracts and protocol-11 fixtures.
3. Add stable-read result model and exhaustive pure transition tests.
4. Implement the bounded Node file reader with fault-injected and real-file
   tests.
5. Implement config/source reconciliation and late-generation guards.
6. Implement grouped directory watchers, debounce, retry, dedup, and disposal.
7. Wire observer startup, config synchronization, WebSocket request/update, and
   shutdown.
8. Add authenticated integration/security tests and byte-preservation proof.
9. Add browser request/reconnect/revision state and tests.
10. Build semantic Queue sources UI and hostile-text tests.
11. Wire Pacium-only App lifecycle and compact responsive styling.
12. Add real browser stable/missing/rewrite/refresh/accessibility evidence.
13. Synchronize protocol/config/spec, README, status, backlog, issue, plan, and
    changelog.
14. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect exact history,
    fast-forward into `dev`, and push.

## Failure model

| Failure point                | Expected state                                   | Recovery                              |
| ---------------------------- | ------------------------------------------------ | ------------------------------------- |
| Config absent/invalid        | No watchers; unconfigured/error aggregate        | Repair config, Refresh/reconnect      |
| Source missing               | Missing, no text/hash                            | Create file; parent watcher observes  |
| Source exceeds 64 KiB        | Oversized, bounded read, no text/hash            | Reduce file, then event/Refresh       |
| Invalid UTF-8                | Invalid text, no text/hash                       | Correct bytes, then event/Refresh     |
| Symlink or special file      | Unsafe file, unopened/unfollowed content         | Restore regular file                  |
| File changes during read     | Bounded retries then Changing                    | Stable later event or Refresh         |
| Permission/I/O failure       | Read error; other sources continue               | Correct access, Refresh               |
| Watch creation/runtime error | Watch error; explicit reads remain available     | Correct parent/access, Refresh config |
| Config replaced during read  | Late result discarded by generation              | New generation observes exact sources |
| Browser disconnect           | Last evidence stale; pending request interrupted | Reconnect requests complete snapshot  |
| Observer/server shutdown     | Timers/watchers disposed; files unchanged        | Restart rebuilds from config          |

## Compatibility

- Supported versions: protocol 11, Pacium config schema 1, local plain-text
  queue sources.
- Fallback behavior: General terminals remain fully usable; unconfigured/error
  queue observation degrades only the Pacium Queue sources group.
- Rollback: remove protocol-11 messages, observer, and group. No queue,
  configuration, repository, or durable state cleanup is required.

## Test plan

- Unit: schema invariants, equality/revision transitions, aggregate ordering,
  config generation, source projection, browser correlation, and labels.
- Property/fault: arbitrary bytes/labels, 65,536/65,537 boundaries, Unicode,
  device/inode/size/mtime drift at each read step, event bursts, late promises,
  duplicate updates, and dispose timing.
- Contract: strict protocol 11, maximum 32 source evidence records, no content
  fields, hostile extras, and updated welcome mismatch tests.
- Integration: real temp regular files for empty/stable/create/rewrite/atomic
  replace/truncate/delete; authenticated observe and push; config replacement;
  reconnect; shutdown.
- Browser: source group only in Pacium, real stable/missing transitions,
  Refresh, unchanged selected terminal, disconnect freshness, narrow/zoom/
  forced colors/reduced motion/focus.
- Security: symlink/FIFO/directory rejection, no-follow behavior, bounded read,
  no queue text in messages/logs/UI, no source/answer/config mutation.
- Performance: max-source startup, watcher grouping, burst coalescing, bounded
  timers/subscriptions/memory, and no polling.

## Documentation changes

- Update protocol and workspace-configuration docs to state the new explicit
  read authority and unchanged schema/write boundary.
- Update README current slice and queue-source UI behavior.
- Mark PC-044 complete and PC-045 next in status/backlog/issue/plan.
- Add changelog evidence and keep item parsing, classification, original-text
  browser display, decisions, delivery, conflicts, and durable provenance
  explicitly deferred.

## Rollout

- Development: disposable data directory and queue fixtures outside the
  repository; no real operator queue paths.
- Integration: fault-injected reader/watcher tests plus real macOS filesystem
  behavior and authenticated loopback browser regression.
- Canary: localhost development only with disposable sources.
- Production: none; project remains pre-release.

## Open questions

- If a supported platform lacks no-follow open flags, PC-044 must retain
  lstat/fstat/final-stat identity checks and label the weaker capability in
  tests/docs rather than silently claiming kernel-enforced no-follow.
- PC-045 owns item segmentation and parse diagnostics. It can consume the
  internal exact bounded text but must not weaken PC-044 file stability or
  provenance rules.
- Durable `queue-state.json` begins only when classification/decision consumers
  require restart-safe import provenance; it will not store unrestricted raw
  queue text.

## Approval

- Product: the first queue UI answers “are my configured sources safely
  observable?” without pretending items or decisions exist.
- Architecture: configured files remain content truth; Pacium owns only bounded
  in-memory observation evidence and adds no generalized state platform.
- Security: accepted config is the sole path authority, reads fail closed, raw
  text stays off transport/log/UI, and no queue content is executed or written.
