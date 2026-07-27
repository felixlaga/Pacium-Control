# PC-040: Server-owned Pacium workspace configuration

## Problem

Pacium mode has no authoritative definition of which session or launch preset
is Meta or Orchestrator, which repositories and workers belong to the
workspace, where queue/objective/plan sources live, how decisions may later be
delivered, or which existing verification presets apply. Hardcoding those
choices in the browser would make refresh and future queue safety unreliable;
reading an operator-edited file without a server-owned write contract would
violate the accepted single-writer state boundary.

## Outcome

The local server owns one small versioned `pacium.json` document in Pacium's
local data directory. An authenticated browser can inspect or replace the
complete workspace definition using an expected revision. The server strictly
validates identifiers, references, bounds, and canonical host paths before an
atomic replacement. Missing or corrupt Pacium configuration degrades only
Pacium mode; terminals, sessions, Git inspection, and verification continue.

## Scope

- A single initial Pacium workspace document with schema version and monotonic
  revision.
- Explicit nullable Meta and Orchestrator bindings to a live session ID or
  fixed launch preset plus optional configured repository.
- Configured repository IDs, labels, canonical roots, and references to
  existing server-owned verification preset IDs.
- Bounded worker slots using the same explicit session-or-preset binding.
- Bounded queue-source metadata with canonical file paths, requesting role,
  plain-text format, and optional delivery-method reference.
- Explicit future delivery metadata for separate answer files or a Meta/
  Orchestrator prompt target.
- Optional canonical plain-text objective and plan source paths.
- A server-owned data-directory and `pacium.json` store with strict reads,
  optimistic revision replacement, same-directory temporary file, file sync,
  atomic rename, and restrictive permissions.
- Protocol-10 get/replace/response contracts and authenticated WebSocket
  dispatch.
- A browser transport and disposable per-connection config state for later
  Pacium-mode UI consumers.

## Non-scope

- The General/Pacium toggle, settings editor, pinned role UI, prompt composer,
  worker list, objective/plan presentation, or any Pacium navigation.
- Launch, attach, relaunch, terminal input, prompt delivery, role targeting, or
  automatic binding.
- Reading, watching, parsing, hashing, classifying, or mutating queue files.
- Reading objective/plan files or writing answer files.
- Decision creation, delivery, acknowledgement, conflict handling, retry, or
  deduplication.
- Executing commands, queue content, context content, delivery definitions, or
  verification definitions supplied by the Pacium workspace document.
- Duplicating executable verification commands; workspace repositories
  reference the existing external server-owned catalog by preset ID.
- Multiple workspaces, a generalized workspace engine, database, event journal,
  migration framework, backup system, or browser-local authoritative config.
- tmux bindings until the optional tmux adapter exists.

## Acceptance criteria

- [ ] The initial store manages only `<data-dir>/pacium.json`; absence is a
      valid unconfigured state and does not create or modify a file on read.
- [ ] The data directory is absolute, private to the local user when created,
      canonicalized before use, and rejected if it resolves inside a configured
      repository.
- [ ] The complete file is strict, version 1, UTF-8 JSON, byte/record/field
      bounded, and rejects unknown keys, controls, duplicate IDs/paths,
      dangling references, ambiguous live-session bindings, and invalid
      revisions.
- [ ] Repository roots are existing canonical directories; queue,
      objective/plan, and answer-file targets resolve through existing
      canonical parents and reject existing symlinks or non-files.
- [ ] A queue source cannot also be an answer target, and every referenced
      delivery, repository, launch preset, live session, and verification
      preset is revalidated by the server before replacement.
- [ ] Protocol 10 exposes only get and complete replace; replace requires the
      current expected revision, increments exactly once, and a stale request
      cannot overwrite newer state.
- [ ] The server validates before write, creates one unpredictable temporary
      file in the same directory, writes and syncs it with restrictive
      permissions, atomically renames it, and never leaves partial JSON as the
      authoritative file.
- [ ] Missing configuration returns unconfigured; corrupt or unsupported
      configuration is preserved and reported as a bounded Pacium-only error
      rather than crashing or weakening the generic terminal workspace.
- [ ] Browser disconnect, duplicate/stale response, failed replacement, or
      local-server restart cannot invent a successful revision or change PTY
      lifecycle, selection, input, or terminal layout.
- [ ] No configured path is read or watched beyond the minimum filesystem
      metadata required for validation; no delivery, prompt, verification, or
      queue action is performed.
- [ ] Unit, contract, atomic-store, fault, WebSocket ownership, browser-state,
      security, clean-build, and full repository gates pass.

## User experience

PC-040 has no settings or Pacium-mode presentation. It establishes the
server-owned contract those slices will consume. The browser transport can ask
for the current definition and receives one of:

- `unconfigured`, revision 0, with guidance for the future setup surface;
- `ready`, a positive revision, and the normalized complete workspace;
- `error`, no workspace content, and a bounded reason that says General mode
  and terminals remain available.

A complete replace uses the last observed revision. Conflict, invalid reference,
path, or atomic-write errors are explicit and do not update browser state.
Future UI must present the full consequence before sending a replacement; this
slice does not expose a user-facing editor.

## Architecture

- Systems and modules touched: server config/data-directory resolution, shared
  contracts, Pacium workspace schema/normalizer/store, session and verification
  reference validation, WebSocket hub, browser transport/state.
- Systems of record: `pacium.json` owns only Pacium configuration; PTYs own live
  sessions; the fixed launch catalog owns launch presets; the verification
  catalog owns executable commands; configured files remain their own truth.
- State transitions: unconfigured revision 0 -> ready revision 1; ready N ->
  ready N+1; corrupt -> error; stale expected revision -> conflict without
  write.
- Protocol/schema impact: protocol 10 adds strict config get, replace, response,
  and bounded error codes; terminal and Git messages are unchanged.
- Relevant ADRs: ADR-0001, ADR-0007, ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: exact Origin, ephemeral token, strict WebSocket schema, and
  final-message limits protect get and replace.
- Privilege: replacement writes only the one server-owned file; configured
  queue/context/answer paths are metadata and grant no read, watch, write,
  terminal-input, or execution authority.
- Secrets/logging: schemas reject secret fields and complete environments;
  document content and configured paths are not logged.
- Abuse/failure scenario: a hostile browser cannot choose a generic state-file
  location, command, argument, executable, environment, signal, queue content,
  or arbitrary write target. Canonical path/reference validation fails before
  the atomic write.

## Reliability

- Idempotency: expected revision prevents duplicate accepted replacement; a
  retry after an unknown response must inspect before attempting another
  replace.
- Timeouts/retries: local bounded file operations have no automatic retry;
  future queue I/O is not started.
- Restart behavior: the server rereads and validates the complete file; direct
  session bindings may become unresolved and are reported honestly by later UI,
  never rebound by name.
- Unknown outcome: a lost replace response requires get; the browser does not
  advance its revision from request intent.
- Migration/rollback: only schema version 1 is accepted. Unsupported versions
  remain preserved and Pacium mode degrades. Removing `pacium.json` returns to
  unconfigured without touching terminals or source files.

## Test plan

- Unit: strict schema, every bound, unique IDs/paths, role/worker binding
  invariants, reference graph, canonical directories/files, missing leaves,
  symlinks, verification lookup, data-directory containment, and normalization.
- Contract: protocol-10 ready/unconfigured/error observations, complete replace,
  revision bounds, forbidden extra/process/content fields, and message size.
- Integration: initial write, sequential replace, stale conflict, reread,
  permission mode, same-directory atomic rename, simulated open/write/sync/
  rename failure, corrupt/unsupported preservation, and no leftover authority.
- Browser state: get/replace pending state, accepted revision, stale and
  cross-connection responses, disconnect interruption, and error retention.
- Failure/recovery: missing directory/file, invalid JSON, oversized file,
  concurrent request, external rewrite, repository removal, missing preset,
  missing session, and server restart.
- Security: data directory/repository overlap, traversal/control paths,
  symlinks, source/answer alias, no queue/context content read, no command or
  terminal message, restrictive modes, Origin/token, and bounded errors.

## Dependencies

- Blocked by: PC-037 server-owned verification catalog and the existing
  authenticated selected-session WebSocket boundary.
- Blocks: PC-041 through PC-050.

## Evidence required

- Filesystem fixtures proving canonical path/reference validation and
  fail-closed bounds.
- Fault-injected store tests proving atomicity, revision conflict, permissions,
  corrupt preservation, and clean retry behavior.
- Contract/session/WebSocket tests proving authenticated ownership, live
  session validation, no executable fields, and no PTY effect.
- Browser reducer/transport tests proving state changes only from matching
  accepted responses.
- `pnpm verify` and `pnpm test:e2e`.
- Synchronized protocol, filesystem-state docs, configuration reference,
  status, backlog, issue, plan, README, and changelog.

## Open questions

- A packaged launcher must finalize the platform-specific default data-directory
  location. PC-040 uses a deterministic host-local default and an explicit
  absolute `PACIUM_DATA_DIR` override without creating state during read-only
  startup.
