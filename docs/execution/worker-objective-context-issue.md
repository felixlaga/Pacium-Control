# PC-050: Show workers, objective context, and recent decision evidence

## Problem

Pacium mode can operate Meta, Orchestrator, and one whole-source queue item,
but the operator still has to remember which configured terminals are workers,
open objective and plan files outside Pacium, and revisit individual queue
items to reconstruct recent decisions. That makes the compatibility loop hard
to supervise from one screen.

The existing sources do not justify a generalized run/task model. A configured
worker binding is not proof that an agent is working, a Git change is not proof
that a worker caused it, and a delivered or human-labelled decision is not
proof of resulting code. Reading arbitrary browser-selected paths, polling
context files, or generating an agent narrative would weaken the accepted
localhost and source-of-truth boundaries.

## Outcome

Pacium mode presents a compact configured-worker group and one explicit
Control context inspector. The inspector reads only configured objective and
plan files on demand and shows a bounded newest-first summary of immutable
queue decisions with their durable delivery and lifecycle evidence.

Worker rows resolve exact accepted bindings to current Pacium-owned sessions
and label process, attention, provider/command, repository, and already
available change evidence honestly. Objective and plan text remains inert
untrusted data. Decision evidence distinguishes recording, terminal/file
transport, and human-labelled lifecycle state without claiming provider-native
acknowledgement or causally attributing Git or terminal activity.

## Scope

- Project configured workers in workspace order from the accepted Pacium
  definition.
- Resolve only exact session IDs. Show live, starting, ending, ended, failed,
  missing, launch-preset-ready, unavailable, and disconnected states without
  display-name or command inference.
- Show worker label, configured binding, command/provider classification,
  repository/branch/worktree evidence, process-derived attention and
  freshness, and selected-session changed-file totals only when that existing
  evidence is already available.
- Open an exact live worker PTY without creating, rebinding, moving, or sending
  input to it.
- Add one explicit Control context inspector reached from Pacium navigation.
- Read only the accepted objective and plan paths with bounded, stable,
  no-follow, regular-file reads on initial open or explicit Refresh.
- Return ready, empty, unconfigured, missing, changing, oversized,
  invalid-UTF-8, unsafe-type, unreadable, config-drift, and state-unavailable
  evidence independently for each configured context source.
- Render ready objective/plan bytes as inert text with path, content hash, byte
  length, modification time, and observation time.
- Project at most twelve newest immutable decisions from private
  `queue-state.json`, joined to current configured source labels where
  available.
- Show bounded question-answer previews or exact approval outcomes, decision
  provenance/time, latest durable delivery result and attempt count, and latest
  human-labelled lifecycle result.
- Preserve exact IDs/hashes in the protocol without exposing target paths,
  notes, terminal bytes, queue source text, provider content, or commands.
- Preserve selected PTY, terminal input ownership, tabs, splits, session
  inspector state, queue sources, context files, Git state, configuration, and
  durable queue state.

## Non-scope

- Generalized runs, tasks, workflow state, task assignment, worker ownership,
  automatic worktree creation, handoffs, reviews, or completion claims.
- Worker launching, binding, editing, interrupting, terminating, messaging, or
  bulk actions. Existing terminal/session actions remain the only controls.
- Inferring workers from names, commands, repositories, branches, processes,
  terminal output, or provider prose.
- Native Claude/Codex events, task progress, token usage, tool calls, or
  provider narration; those belong to PC-060 through PC-064.
- Watching or polling objective/plan files, durable context snapshots, edit or
  write controls, Markdown/HTML rendering, link activation, search, or
  arbitrary path reads.
- Parsing objectives or plans into tasks, acceptance criteria, owners,
  commands, or progress.
- Persisting an activity journal or duplicating Git, PTY, provider, queue, or
  context-file truth.
- Claiming that a decision caused later process, terminal, Git, or verification
  activity.
- Multi-item queue parsing, historical queue-source text, semantic decision
  summaries, or more than twelve recent decision records.

## Acceptance criteria

- [ ] Protocol schemas expose one bounded identity-free context inspection
      request and one strict workspace-revision-bound response without
      browser-selected paths, context write fields, commands, terminal bytes,
      provider claims, or generic query parameters.
- [ ] Only accepted objective and plan paths are read. Reads are stable,
      bounded, no-follow, regular-file-only, UTF-8 validated, and never modify
      either file.
- [ ] Objective and plan observations fail independently and present exact
      ready/empty/unconfigured/degraded evidence with provenance and inert text.
- [ ] Opening Control context and Refresh are the only read triggers; browser
      reconnect, config drift, mode exit, and late responses cannot display
      text for a different accepted workspace revision.
- [ ] Recent decisions are derived only from validated immutable queue state,
      sorted newest first with deterministic ties, capped at twelve, and
      content-bounded.
- [ ] Decision summaries distinguish local recording, delivery attempt
      evidence, and explicitly human-labelled lifecycle state. They never
      promote transport or process evidence to provider acknowledgement,
      application, completion, or resulting code.
- [ ] Invalid or unavailable queue state leaves context files and terminals
      usable and shows bounded decision-state degradation without repairing or
      rewriting state.
- [ ] Every configured worker appears once in accepted order. Exact session
      bindings resolve without inference and launch-preset bindings remain
      capability-labelled rather than silently launched.
- [ ] Worker rows show source-labelled process/attention, command/provider,
      repository, freshness, and already available Git-change evidence without
      claiming task progress or authorship.
- [ ] Opening one live worker selects its existing PTY and returns focus without
      creating a session, changing configuration, sending input, or affecting
      another worker.
- [ ] Empty, loading, partial, error, disconnected, 320 CSS px, 200% zoom,
      forced-colors, reduced-motion, keyboard, and focus-return states are
      complete.
- [ ] Unit, contract, authenticated integration, browser, security, production
      build, and full repository gates pass with exact evidence recorded.

## User experience

Pacium navigation keeps Meta and Orchestrator first, then a compact Workers
group in configured order. Each row has one status line and at most one Open
action. A missing session says that the exact binding is absent after restart;
a launch preset says it is configured but not started. Live-process rows say
`Unknown` until stronger attention evidence exists. Repository and changed-file
facts remain source-labelled and never become a progress percentage.

The workspace summary exposes one `Open context` action. It opens the existing
right inspector without remounting or covering the terminal. The inspector
uses Objective, Plan, and Recent decisions sections under one Refresh action.
Each context section shows provenance and preserves whitespace as inert text.
An empty or degraded source teaches the operator to repair the configured file
outside Pacium and Refresh.

Recent decision cards show local outcome, configured/former source identity,
decision time, durable attempt evidence, and the latest human lifecycle label.
Question previews are visibly truncated when needed. No card says `resulting
work`; the section says that Git and terminal activity cannot be causally
attributed. Queue-item mutation controls remain in the exact current item
inspector.

Back and Escape restore focus to the Open context trigger. Queue inspection
continues to take precedence when a queue row is opened. At narrow widths the
right inspector remains a drawer and all sections stack without hiding terminal
ownership status.

## Architecture

- Systems and modules touched:
  - strict context/decision-summary contracts and protocol 17;
  - a bounded no-follow context file reader;
  - a read-only context service joining accepted config and validated queue
    state;
  - authenticated WebSocket dispatch;
  - correlated browser context state;
  - pure worker projection, worker group, and Control context inspector;
  - focused contract, server, browser, and Chromium fixtures.
- Systems of record:
  - `pacium.json` owns configured worker identities and context paths;
  - exact PTY session summaries own process and repository observation truth;
  - the attention reducer owns displayed attention evidence;
  - configured objective/plan files own their current text;
  - `queue-state.json` owns immutable decisions, attempts, and human labels;
  - Git and providers retain their own truth.
- State transitions:
  - context `idle -> loading -> ready | partial | error`;
  - open/Refresh creates one request; accepted matching response replaces the
    prior projection; disconnect or identity drift clears text and pending
    intent;
  - worker rows are pure projections and create no lifecycle state.
- Protocol/schema impact:
  - protocol 17 adds `pacium.context.inspect` and `pacium.context`;
  - no Pacium config, queue-state, browser-storage, or filesystem schema change.
- Relevant ADRs:
  - ADR-0001, ADR-0005, ADR-0007, ADR-0012, ADR-0013, ADR-0014, and ADR-0015.

## Security and privacy

- Authorization: existing loopback Host/Origin/ephemeral-token checks protect
  the request. It contains only a request ID.
- Privilege: the server resolves the current workspace, objective/plan paths,
  source labels, and queue state. The browser cannot submit a path, revision,
  worker/session ID, queue identity, filter, count, command, or read option.
- Secrets/logging: context bytes, decision answer previews, notes, queue text,
  terminal bytes, environments, and provider data are not logged. Notes and
  target paths are excluded from the summary protocol.
- Abuse/failure scenario: symlink or special-file replacement, oversized or
  changing bytes, invalid UTF-8, config drift, forged response identity, and
  hostile display content fail closed or render only as inert bounded text.

## Reliability

- Idempotency: inspect and Refresh are repeatable read-only operations.
  Request/workspace identities reject stale or cross-revision responses.
- Timeouts/retries: reads are one-shot and bounded. There is no watcher,
  automatic retry, polling, or background refresh.
- Restart behavior: no context projection is durable. Browser/local-server
  restart requires an explicit new inspection; immutable decisions reconstruct
  from validated state and direct-worker bindings may honestly be missing.
- Unknown outcome: a changed or unreadable context source remains degraded;
  an unavailable decision store does not imply no decisions.
- Migration/rollback: protocol 16 clients cannot use protocol 17. Removing the
  context request/UI restores prior behavior without data migration.

## Test plan

- Unit: file status matrix, stable-read checks, UTF-8/base64 bounds, recent
  decision ordering/truncation, delivery/lifecycle joins, worker binding/status,
  attention/repository copy, and stale browser-state transitions.
- Contract: strict request/response extras, path/content/preview bounds,
  workspace revision, independent sources, decision cross references, maximum
  message size, and protocol mismatch.
- Integration: accepted objective/plan reads, empty/missing/changing/
  oversized/invalid/symlink/unreadable cases, config drift, valid/empty/invalid
  queue state, latest attempt/lifecycle projection, and unchanged external
  state.
- Browser: open/Refresh/Back/Escape, objective/plan text, partial errors,
  twelve-decision ceiling, worker exact open, missing/preset workers,
  reconnect/config drift/mode exit, selected PTY and terminal preservation,
  320 CSS px, 200% zoom, forced colors, and reduced motion.
- Failure/recovery: disconnect during read, late response, server restart,
  context replacement during read, invalid queue state, no configured sources,
  and no configured workers.
- Security: forged path/revision/count/query fields, symlinks, hostile text,
  answer preview escaping, no context/answer/note logs, and no mutations or
  terminal input.

## Dependencies

- Blocked by: PC-040 through PC-049.
- Blocks: the Milestone-3 compatibility-loop exit and provider-enrichment work
  that later adds stronger worker/activity evidence.

## Evidence required

- Focused contract, context reader/service, decision projection, worker model,
  reducer, and semantic rendering tests.
- Authenticated real-file evidence for every context status and immutable-state
  projection without external mutation.
- Chromium evidence for worker/open context, text/provenance, recent decision
  evidence, Refresh, Back/Escape, reconnect, terminal preservation, 320 CSS px,
  200% zoom, forced colors, and reduced motion.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes.
- Small coherent commits, clean branch, fast-forward merge into `dev`, and
  pushed exact `origin/dev` head.

## Open questions

- A question-answer preview improves compact oversight but may contain operator
  secrets. PC-050 bounds it to 320 UTF-8 bytes, excludes notes, renders it as
  inert text, and provides no export or persistence beyond current browser
  state.
- Already available Git-change evidence can describe a worker repository but
  cannot prove that worker authored or caused the changes. Uninspected evidence
  stays unavailable rather than triggering up to 64 background Git reads.
- Provider-native worker progress, completion, plans, tools, and usage remain
  later enrichment and must supplement rather than rewrite process evidence.
