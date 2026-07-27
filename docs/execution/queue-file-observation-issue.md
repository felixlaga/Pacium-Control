# Observe configured queue files without modifying them

**Status:** In progress

## Problem

Pacium workspace configuration can name up to 32 plain-text queue sources, but
those paths are still metadata only. Pacium cannot say whether a configured
source is present, stable, empty, changing, oversized, invalid, or unreadable,
and it cannot retain the bounded original text and provenance needed by later
classification and inspector slices.

A naive file watcher is unsafe here. Queue files can be replaced atomically,
partially rewritten, truncated, changed between `stat` and `read`, turned into
symlinks, or made arbitrarily large. Treating one transient read as truth could
manufacture or duplicate later queue items. Logging or executing the content
would cross the product's security boundary.

## Outcome

The local server continuously observes only accepted configured queue-source
paths. It performs debounced, bounded, stable, no-follow reads; retains the
latest bounded original UTF-8 text in memory; computes deterministic SHA-256
content provenance; and publishes content-free source health to Pacium mode.
The browser can tell which source was observed and when without exposing queue
text before the item/classification UI exists.

Source files, PTYs, repositories, delivery targets, and durable Pacium state
remain unchanged.

## Scope

- Add strict protocol-11 queue observation request, snapshot, and source-update
  contracts with bounded content-free metadata.
- Add one local-server queue observer synchronized to the latest accepted
  Pacium configuration.
- Watch the canonical parent of each configured source so missing files and
  atomic replacements can be observed.
- Debounce source events and verify identity/metadata before and after each
  read.
- Require a regular non-symlink file and open with no-follow behavior where the
  platform supports it.
- Read no more than 64 KiB plus one overflow byte per source and retain at most
  64 KiB of exact decoded UTF-8 text per stable source in server memory.
- Compute SHA-256 only for a complete stable read.
- Distinguish unconfigured, loading, ready, config-error, stable, empty,
  missing, changing, oversized, invalid-UTF-8, unsafe-type, read-error, and
  watcher-error evidence.
- Give each source a process-local monotonic observation revision while keeping
  configured source identity plus content hash as restart-stable provenance.
- Reconcile added, removed, and changed source definitions after accepted
  configuration reads or replacements.
- Expose a compact Pacium-only Queue sources group with label, requesting role,
  status, bytes, bounded hash prefix, and observation freshness.
- Provide explicit Refresh through the same read-only operation.
- Dispose file watchers and timers during server shutdown.

## Non-scope

- Parsing queue text into items or detecting item boundaries.
- Classifying questions, approvals, failures, reviews, or unknown requests.
- Showing original queue text in the browser, queue list, or inspector.
- Deriving item IDs, offsets, line ranges, requesting sessions, timestamps, or
  confidence.
- Persisting raw queue text, watcher caches, observation revisions, or a
  `queue-state.json` file.
- Durable import deduplication, decisions, answers, approvals, delivery,
  acknowledgement, conflict resolution, or activity entries.
- Writing, appending, truncating, renaming, locking, repairing, or creating a
  queue source or answer file.
- Executing commands, prompts, paths, links, templates, or instructions parsed
  from queue content.
- Polling all repositories, watching directories not named by accepted config,
  following symlinks, or remote queue access.
- A generalized filesystem-watch service, event store, job runner, database,
  or provider adapter.

## Acceptance criteria

- [ ] Observation starts only from a ready accepted Pacium configuration and
      only for its exact configured queue-source paths.
- [ ] Unconfigured or invalid configuration produces bounded honest state,
      starts no source watcher, and leaves General mode and PTYs unchanged.
- [ ] A stable regular UTF-8 file of at most 64 KiB produces exact byte length,
      SHA-256 hash, observation time, process-local revision, and bounded
      original text retained only in server memory.
- [ ] An empty file is distinct from missing and remains a valid complete
      observation with the SHA-256 hash of empty content.
- [ ] Missing, oversized, invalid-UTF-8, symlink/non-regular, permission/read,
      changing-read, and watcher failures are distinct and contain no stale
      text or hash presented as current.
- [ ] Reads use no-follow/open-file identity checks and reject a path whose
      device, inode, size, or modification evidence changes during observation.
- [ ] Filesystem bursts are debounced; a partial or unstable read is never
      promoted to stable and retry work remains bounded.
- [ ] Atomic replacement, file creation after missing, content rewrite,
      truncation, and deletion produce a newer source revision without server
      restart or browser refresh.
- [ ] Re-reading unchanged bytes does not increment the source revision or
      broadcast a duplicate source update.
- [ ] Config replacement removes obsolete watchers/timers, adds new sources,
      and cannot leak an update from a prior source generation into the current
      workspace revision.
- [ ] Queue text never enters logs, HTML, terminal input, provider prompts,
      durable files, notifications, or generic errors.
- [ ] Browser messages contain only source metadata and never original text.
- [ ] Pacium mode shows each configured source in stable config order with
      honest status/freshness and escaped labels/paths; General mode shows no
      queue-source surface.
- [ ] Queue observation never changes terminal selection, layout, inspector
      state, keyboard capture, source files, delivery files, repositories, or
      `pacium.json`.
- [ ] Refresh, reconnect, browser close/reopen, and server shutdown do not
      duplicate work, leak watchers/timers, or mutate queue sources.
- [ ] Protocol, unit, fault, integration, security, semantic, and browser tests
      pass with synchronized issue, plan, README, status, backlog, and
      changelog evidence.

## User experience

In Pacium navigation, a compact Queue sources section sits below the primary
roles and above ordinary sessions:

```text
QUEUE SOURCES                                      2
● Needs Felix          Stable · Meta · 1.8 KB · 5c12a9e1
○ Review queue         Missing · Orchestrator
  Observed 4s ago                               [ Refresh ]
```

This is source health, not a queue-item count. A Stable source means Pacium
completed one bounded stable file read; it does not mean the content parsed,
contains a question, or is safe to execute. Empty, Missing, Changing,
Oversized, Invalid text, Unsafe file, Read error, and Watch error remain
explicit.

Loading and config-error states explain that terminals continue. Refresh asks
the server to reconcile current accepted config and re-observe each source.
Watcher updates arrive while the browser is open, but browser lifecycle does
not own the watcher.

## Architecture

- Systems and modules touched: contracts/protocol, queue observation model and
  Node adapter, WebSocket hub/lifecycle, browser transport/state, compact
  Pacium queue-source presentation, tests, and docs.
- Systems of record: configured queue files own content; accepted
  `pacium.json` owns source identity/path metadata; the queue observer owns only
  bounded current in-memory observation evidence.
- State transitions: config loading/unconfigured/error/ready; per source
  pending -> stable/empty/degraded; watcher event -> debounced pending ->
  changed/unchanged evidence; config generation change -> reconcile.
- Protocol/schema impact: protocol 10 becomes 11 with read-only
  `pacium.queue.observe`, correlated `pacium.queue.sources`, and uncorrelated
  `pacium.queue.source.updated`; Pacium config schema remains version 1.
- Relevant ADRs: ADR-0001, ADR-0007, ADR-0012, ADR-0014, and ADR-0015.

## Security and privacy

- Authorization: reuse exact loopback/Serve Origin, ephemeral token, strict
  WebSocket schema, and payload limits.
- Privilege: reads occur with the invoking user's authority but only at paths
  selected by accepted server-owned config.
- Secrets/logging: original text is bounded in memory and is neither logged nor
  sent to the browser in this slice; UI receives only hash/size/status metadata.
- Abuse/failure scenario: repository or queue content may replace a configured
  file with a symlink, special file, invalid bytes, rapid rewrite, or oversized
  payload. Observation fails closed and never executes or mutates it.

## Reliability

- Idempotency: unchanged source identity and content state produces no revision
  or broadcast change; configured source ID plus SHA-256 provides stable
  provenance across restart.
- Timeouts/retries: filesystem events debounce for a fixed short interval;
  unstable reads receive a small bounded retry budget, then remain Changing
  until another event or explicit Refresh.
- Restart behavior: accepted config is reread, watchers are rebuilt, source
  hashes are recomputed, and process-local observation revisions restart.
- Unknown outcome: no write or delivery exists. A read that cannot prove
  stability becomes degraded rather than retaining prior text as current.
- Migration/rollback: protocol 11 is a coordinated local client/server update;
  removing the observer and source UI requires no state migration or source
  cleanup.

## Test plan

- Unit: status contracts, metadata bounds, stable hashing, UTF-8, empty,
  missing, oversize, type/symlink, changing identity, revision/dedup, config
  ordering, and browser reducer.
- Contract: strict request/snapshot/update schemas, no content field, maximum
  source count/message size, protocol mismatch, and hostile extra fields.
- Integration: temporary real files for create/rewrite/atomic replace/truncate/
  delete; configuration replace; authenticated request and push update; source
  and `pacium.json` byte-for-byte preservation.
- Browser: Pacium-only source group, explicit Refresh, stable/missing live
  update, unchanged terminal selection, narrow/zoom/forced colors/focus.
- Failure/recovery: watcher error, read permissions, config corruption,
  disconnect/reconnect, delayed stale generation, shutdown disposal.
- Security: symlink/special-file rejection, no traversal/new paths, no content
  execution/render/log/protocol field, bounded reads, and hostile labels.

## Dependencies

- Blocked by: PC-040 through PC-043.
- Blocks: PC-045 classification and PC-046 queue list/inspector.

## Evidence required

- Small coherent commits for issue, plan, protocol, read model, watcher,
  lifecycle, transport/state, UI, styling, integration/browser coverage, and
  docs.
- Fault-injected and real-filesystem proof that only complete stable bytes
  receive a hash and revision.
- Byte-for-byte source and `pacium.json` preservation across observation tests.
- Exact `pnpm verify`, `pnpm test:e2e`, clean history, fast-forward `dev` merge,
  and pushed remote SHA.

## Open questions

- PC-045 will define supported item boundaries and parse diagnostics. PC-044
  retains exact bounded text internally but intentionally publishes no content.
- Durable import provenance is added only with the first consumer that must
  survive restart; PC-044 provides restart-stable source ID plus content hash
  without creating speculative durable state.
