# PC-065: Secret-free relaunch manifests

## Problem

Pacium can relaunch an ended terminal only while the owning local-server
process still retains that session summary. The browser reconstructs a create
request from visible fields, so the action has no durable, server-owned launch
record, no explicit lineage, and no honest recovery path after local-server
restart.

## Outcome

Every Pacium-launched direct PTY receives a bounded, versioned, server-owned
relaunch manifest. Manifests survive local-server restart, contain only the
fixed launch preset, safe command description, canonical cwd/repository
reference, environment key allowlist, provider classification, and an optional
native resume identifier, and can create an explicitly linked fresh PTY without
accepting executable or environment values from the browser.

## Scope

- Define a strict version-1 relaunch-manifest contract.
- Persist a bounded newest-first manifest catalog in Pacium's private data
  directory with validation and atomic replacement.
- Record one manifest for every successfully launched direct PTY.
- Retain exact predecessor lineage for an explicit relaunch.
- Record a bounded provider resume identifier only when it appears in accepted
  native or hook evidence.
- List recoverable manifests independently from live terminal sessions.
- Replace browser-reconstructed relaunch with a typed server-owned relaunch
  request.
- Preview the retained launch facts and process consequence before confirmation.
- Keep duplicate as a fresh create action with no lineage claim.

## Non-scope

- Automatically resuming a provider conversation.
- Persisting provider tokens, environment values, prompts, terminal bytes,
  transcripts, observer arguments, or browser-supplied commands.
- Adopting a direct PTY after local-server restart.
- tmux discovery, attachment, or keep-alive.
- User-defined commands or launch presets.
- Recently closed terminal history beyond the bounded manifest catalog.
- Multi-host synchronization or cloud backup.

## Acceptance criteria

- [ ] Each successful session has one strict manifest with immutable session ID,
      preset command, cwd, repository reference, provider/runtime
      classification, environment key names, predecessor ID, and optional
      provider resume reference.
- [ ] No manifest contains an environment value, provider token, observer
      command, prompt, terminal content, or complete environment.
- [ ] A valid private manifest catalog survives local-server restart; invalid,
      public, symlinked, or unsupported state fails visibly without being
      overwritten.
- [ ] A relaunch request identifies only a stored manifest and dimensions; the
      server revalidates the cwd and current preset before launching.
- [ ] Relaunch creates a new immutable session ID and manifest linked to the
      exact predecessor; the source manifest and ended session are unchanged.
- [ ] Missing, stale, unavailable-preset, invalid-cwd, and persistence failures
      return bounded typed errors without launching a PTY.
- [ ] The UI previews provider, command, cwd, repository, environment key names,
      resume-reference availability, and the fresh-process consequence.
- [ ] Recoverable manifests remain available after browser or local-server
      restart and are never presented as running terminals.
- [ ] The manifest catalog is bounded deterministically and atomic writes use
      private permissions.
- [ ] Focus, Escape, confirmation, empty, loading, and failure behavior are
      accessible and do not remount live terminals.

## User experience

Ended sessions expose `Relaunch from manifest`. The confirmation dialog states
that Pacium will start a new process with a new session ID, shows the retained
server-owned facts, and states that the provider resume identifier is evidence
only and will not resume automatically. Cancel and Escape restore focus.

A compact `Recovery` group lists retained manifests whose source session is no
longer live in the current local-server process. Selecting one opens the same
preview. Successful relaunch selects the newly created terminal. Failure leaves
the manifest and every existing process unchanged and explains the recovery
action.

## Architecture

- Systems and modules touched: shared contracts, relaunch-manifest store,
  local-server session manager/WebSocket hub/startup, browser transport,
  session actions, recovery UI, tests, and status documents.
- Systems of record: PTY remains live process truth; the manifest catalog owns
  only Pacium launch metadata; provider observations own resume-ID evidence;
  Git owns repository truth.
- State transitions: create -> manifest stored -> PTY live; provider evidence
  may add one resume reference; relaunch request -> manifest revalidated -> new
  manifest with predecessor -> new PTY.
- Protocol/schema impact: increment the protocol version; add strict manifest
  schemas, manifest list events, a typed relaunch request, and manifest
  references in session summaries.
- Relevant ADRs: ADR-0001, ADR-0010, ADR-0013, ADR-0015.

## Security and privacy

- Authorization: existing exact Origin, connection token, and optional
  Tailscale identity checks protect list and relaunch messages.
- Privilege: the browser supplies only a manifest ID and terminal dimensions;
  executable, arguments, cwd, provider, environment allowlist, and lineage are
  server-owned.
- Secrets/logging: only environment key names are retained. Observer-injected
  arguments and environment additions are excluded. State bytes and terminal
  bytes are not logged.
- Abuse/failure scenario: hostile manifest JSON, symlinks, public permissions,
  path changes, catalog floods, and forged browser fields fail closed.

## Reliability

- Idempotency: each relaunch request creates at most one process attempt and one
  successor manifest; transport requests are not retried automatically.
- Timeouts/retries: no automatic retry. A failed attempt leaves the source
  manifest available for a new explicit action.
- Restart behavior: manifests reload; direct PTYs are not claimed to survive.
- Unknown outcome: disconnect during relaunch causes no browser retry; the next
  manifest/session list reveals whether a successor exists.
- Migration/rollback: an absent file is an empty catalog. Unsupported or
  malformed files remain untouched. Rolling back ignores the optional catalog.

## Test plan

- Unit: schema bounds/refinements, redaction shape, catalog ordering/bounds,
  resume-ID extraction, and relaunch preview model.
- Contract: strict list/relaunch messages, session-manifest relationship, and
  protocol version.
- Integration: create/persist/reload/list/relaunch lineage, spawn failure,
  preset/cwd drift, and provider resume evidence.
- Browser: ended-session and recovery-list confirmation, cancel/Escape/focus,
  successful selection, and disconnected failure.
- Failure/recovery: corrupt, unsupported, public, symlinked, and atomic-write
  failures preserve prior bytes and launch no PTY.
- Security: forged command/env/cwd fields are rejected; serialized state excludes
  token/value fixtures and terminal content.

## Dependencies

- Blocked by: PC-061, PC-062, PC-063, PC-064, direct PTY lifecycle, private
  atomic state patterns, and provider observation.
- Blocks: PC-070 through PC-076 and Milestone 4 exit evidence.

## Evidence required

- Focused contract, store, session-manager, integration, component, and browser
  results.
- A restart fixture proving the same manifest is available without a live PTY.
- Serialized-state inspection proving secret fixtures are absent.
- Full repository verification and production builds.
- Rendered Chromium workflow showing explicit recovery and successor lineage.

## Open questions

- None. Automatic provider resume remains deliberately deferred until each
  provider's supported CLI contract can be verified independently.
