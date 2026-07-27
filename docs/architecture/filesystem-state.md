# Minimal local filesystem state

## Objective

Persist only application-owned metadata required by a concrete product
consumer. PTYs own live process truth, Git owns repository truth, configured
files own their content, and provider runtimes own native events.

## Current server-owned state

PC-040 introduces exactly one durable server-owned file:

```text
$PACIUM_DATA_DIR/
└── pacium.json
```

It contains the versioned, revisioned Pacium workspace definition: role or
launch-preset bindings, repository references, worker slots, queue-source path
metadata, future delivery metadata, and objective/plan path metadata.

It does not contain:

- live PTY/process state;
- browser terminal tabs, splits, selection, or preferences;
- terminal scrollback or input;
- queue, objective, plan, or answer content;
- verification executable definitions or results;
- provider credentials, environments, events, or transcripts.

The optional verification catalog is an operator-owned external input selected
at startup. Browser-owned preferences, tab/layout metadata, attention cursors,
and selected views remain versioned local-storage state and are not server
authority.

See the
[Pacium workspace configuration contract](../execution/pacium-workspace-configuration.md)
for the exact schema and lifecycle.

## Current ephemeral queue state

PC-044 adds no durable file. While the local server is running, one queue
observer retains at most 64 KiB of complete stable UTF-8 text for each accepted
queue source plus bounded source-health metadata. The text is discarded when a
source degrades, leaves accepted configuration, or the server stops.

Protocol 13 bulk observations send only source ID, process-local observation
revision, status, time, byte length, modification time, SHA-256 provenance,
bounded error evidence, process-local candidate-first-seen time, and
content-free whole-source classification metadata. Candidate IDs are
deterministically derived from the boundary version, source ID, and content
hash.

One authenticated exact-identity inspection may send the current source bytes
as bounded UTF-8 base64 to the browser. The browser keeps at most one decoded
item, renders it as inert text, and clears it on source/config drift,
disconnect, mode exit, or Back. Neither encoded nor decoded text is logged,
persisted, placed in the queue list, or treated as a parsed action.

Classification is also disposable runtime state. Empty/degraded evidence or
source/config removal discards it; restart reconstructs it from a new complete
stable read. Filesystem watchers and debounce timers remain disposable runtime
resources. Configured queue files remain the content authority and are never
modified by observation, classification, or inspection.

## File lifecycle

- Missing data/config state is `unconfigured`; inspection creates nothing.
- The default macOS data directory is
  `<canonical home>/Library/Application Support/Pacium Control`.
- `PACIUM_DATA_DIR` can select another dedicated absolute directory.
- The server creates the directory at mode `0700` and `pacium.json` at mode
  `0600`.
- Existing directory/file ownership, modes, type, and symlink status are
  checked before reads or replacement.
- Complete content is schema-validated and server-reference/path-validated.
- Replacement uses a same-directory exclusive temporary file, file sync,
  atomic rename, and directory sync.
- Expected revisions prevent a duplicate or stale request from overwriting
  newer state.
- Invalid or unsupported state is preserved and reported; it is not migrated,
  repaired, deleted, or overwritten automatically.

## Recovery

- Missing config: replace with expected revision `0`.
- Invalid config: repair or move the file explicitly, then inspect again.
- Failure before atomic rename: the previous file remains authoritative.
- Directory-sync failure after rename: inspect before retrying because the
  visible revision may already have changed.
- Browser disconnect: durable state and PTYs are unchanged; reconnect rereads
  config.
- Local-server restart: config is reread; direct PTYs have ended, so explicit
  session bindings may be unresolved and must not be rebound by inference.

## Planned state, not implemented

Later accepted slices may add narrowly scoped versioned files only when a real
consumer requires them, for example queue classification/decision/delivery
provenance or packaged-launcher preferences. The following are not current
files:

```text
queue-state.json
activity/*.jsonl
cache/
session restoration metadata
```

There is no application database, general event store, transaction journal,
universal entity store, durable terminal transcript, or provider-event archive.
