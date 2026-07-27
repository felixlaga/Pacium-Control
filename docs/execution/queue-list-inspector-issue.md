# PC-046: Implement a compact queue list and safe item inspector

## Problem

Pacium can observe configured queue files and classify one whole-source
candidate per stable source, but the source cards are still health telemetry.
The operator cannot open a queue item, inspect its exact original text, or see
its source and classification provenance beside the terminal. Treating the
current cards as a complete queue would also overstate waiting time, parsed
fields, conflict detection, and delivery behavior that do not exist yet.

## Outcome

Pacium mode has a compact, keyboard-accessible queue list. Opening a current
candidate reveals its bounded exact source text and honest provenance in the
right inspector without changing the selected PTY, writing any file, or
granting answer or approval authority. A rewrite, config change, disconnect, or
degraded source removes text that can no longer be proven current.

## Scope

- Turn each current whole-source candidate into a labelled queue-list button.
- Keep empty, pending, and degraded source health visible without pretending
  those sources are queue items.
- Track a process-local first-observed timestamp for the current candidate so
  the UI can show honest waiting evidence for this server run.
- Add an authenticated, read-only request for one exact current item.
- Bind inspection to workspace revision, source ID, observation revision,
  content hash, and deterministic item ID.
- Render exact original UTF-8 text as inert React text in a bounded inspector.
- Show type, confidence, diagnostic, requesting role/session where exact,
  source path, boundary, hashes, revisions, and timestamps.
- Show reason, consequence, recommendation, related evidence, and conflict
  detection as unavailable when the whole-source adapter does not provide
  them.
- Preserve terminal selection, layout, process lifecycle, and previous
  inspector tab.
- Support pointer opening, native button keyboard activation, Back, and Escape
  with focus restoration to the originating queue row.

## Non-scope

- Multiple-item parsing, generated excerpts, semantic title extraction, or
  inferred reason/consequence/recommendation.
- Answer, deny, approve, note, acknowledgement, or delivery controls.
- Durable queue provenance or waiting time across local-server restart.
- Conflict detection, unread state, queue prioritization, or blocking/risk
  inference.
- Provider-native or terminal-output parsing.
- Generic file reads, path-based browser requests, source mutation, or terminal
  input.

## Acceptance criteria

- [ ] Every current candidate is a distinct queue-list button labelled with
      type, source, requesting role, confidence, and process-local first-seen
      evidence.
- [ ] The list sends no original text, excerpt, semantic title, command,
      decision, or authority field.
- [ ] Opening a row requests only an exact current item identity; the browser
      cannot request an arbitrary path or source text.
- [ ] A ready inspection contains the exact bounded original text and matching
      workspace/source/observation/hash/item provenance.
- [ ] Original text is rendered only as escaped text, with no HTML, link,
      terminal escape, clipboard, command, or queue execution behavior.
- [ ] A source rewrite, degradation, config replacement, disconnect, stale
      response, or identity mismatch removes the accepted text and explains
      that terminals and source files were untouched.
- [ ] Queue inspection does not change the selected PTY, tabs, splits,
      terminal focus ownership, running processes, or source/config files.
- [ ] The inspector exposes no answer or approval control and explicitly says
      classification grants no authority.
- [ ] A keyboard operator can open a row, review the inspector, and return with
      Escape or Back to the same row; terminal capture continues to own its
      normal keys.
- [ ] Empty, unconfigured, loading, disconnected, degraded, and narrow-screen
      states explain the next safe action.
- [ ] Focused, contract, integration, browser, security, full verification, and
      production-build evidence pass.

## User experience

The Pacium sidebar section is labelled **Queue** and counts current candidates,
not configured files. Current candidates use compact buttons such as
“Question from Meta inbox”; the supporting line shows requesting role,
confidence, and “First seen this server run” evidence. Sources without a
candidate remain noninteractive health rows below the item list.

Activating a queue row opens a queue-specific view in the existing right
inspector and moves focus to its heading. Loading copy says the source is being
read without claiming delivery or process impact. The inspector presents:

- exact original source text;
- question/approval/failure/review/unknown and parse confidence;
- fixed classifier diagnostic;
- exact requesting role and the configured role session only when that binding
  resolves without inference;
- process-local first-seen and current observation times;
- source label/path/ID, workspace and observation revisions, boundary, content
  hash, and item ID;
- explicit unavailable labels for reason, consequence, recommendation,
  conflict detection, and related evidence;
- a safety note that this read-only view cannot answer or authorize anything.

Back and Escape close the queue view, restore the previous inspector tab, and
return focus to the same row when it still exists. Leaving Pacium mode,
disconnecting, or receiving changed source evidence clears original text from
browser state. The PTY remains selected and alive.

## Architecture

- Systems and modules touched: shared queue/protocol contracts, local queue
  runtime and WebSocket hub, browser transport/reducer, Pacium queue list,
  queue inspector, app inspector routing, styles, tests, and active docs.
- Systems of record: queue files own original text; accepted `pacium.json`
  owns source definitions and requesting roles; the queue observer owns
  process-local current text/classification and first-seen evidence; the
  browser owns ephemeral selection and inspector focus only.
- State transitions: no candidate -> current candidate -> inspection loading ->
  ready; current item rewrite/degrade/config drift/disconnect -> stale or
  unavailable with original text cleared; Back/mode exit -> closed and cleared.
- Protocol/schema impact: protocol 13 adds candidate first-seen evidence,
  `pacium.queue.item.inspect`, and `pacium.queue.item` with strict bounded
  ready/stale/unavailable observations.
- Relevant ADRs: ADR-0001, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016.

## Security and privacy

- Authorization: the existing authenticated WebSocket and ephemeral token are
  required. An item request must match the server's exact current accepted
  workspace/source/observation/hash/item tuple.
- Privilege: read-only access to one already configured queue source in the
  local server's current bounded memory; no new filesystem path or command is
  accepted from the browser.
- Secrets/logging: original text is never placed in bulk queue observations,
  logs, durable state, notices, titles, accessibility labels, test snapshots,
  or terminal input. Browser state keeps at most one bounded inspected text and
  clears it on identity loss.
- Abuse/failure scenario: hostile HTML, URLs, ANSI/OSC, control characters,
  oversized content, stale IDs, arbitrary paths, repeated requests, config
  drift, and source rewrites remain data or fail closed. Terminals and queue
  files survive.

## Reliability

- Idempotency: inspection is a read of one exact current identity and has no
  side effect. Repeating it returns current evidence only.
- Timeouts/retries: no polling or automatic retry. The operator may reopen or
  refresh after a definite stale/unavailable result.
- Restart behavior: queue files are re-observed and candidate first-seen time
  restarts honestly; no inspection state or raw text is restored.
- Unknown outcome: a disconnect clears text and labels the inspection
  unavailable; no request is replayed.
- Migration/rollback: no durable migration. Removing protocol 13 item
  inspection returns to content-free protocol 12 source cards.

## Test plan

- Unit: strict item-inspection schema, process-local first-seen retention/reset,
  reducer correlation/reconciliation, projection copy, and relative-time
  labels.
- Contract: ready/stale/unavailable invariants, exact IDs/hash/revisions,
  maximum text bound, protocol 13, forbidden extras, and content-free list
  messages.
- Integration: authenticated exact-current inspection; rewritten, degraded,
  config-drifted, and forged identities; reconnect; unchanged files; and no
  source/config/PTY mutation.
- Browser: item list -> loading -> exact text inspector -> Back/Escape focus
  return; source rewrite clearing; General/Pacium toggle; unchanged selected
  real PTY; 320 CSS px; 200% zoom; forced colors; reduced motion.
- Failure/recovery: pending/empty/missing/changing/oversized/invalid/unsafe/read/
  watch states, stale response, disconnect during request, and source removal.
- Security: HTML/script/link/ANSI/control content, arbitrary path and extra
  authority fields, no logging, no terminal injection, and question/approval
  separation.

## Dependencies

- Blocked by: PC-044 queue observation and PC-045 whole-source
  classification.
- Blocks: PC-047 immutable decisions, PC-048 delivery, PC-049 acknowledgement
  and conflict handling, and PC-050 worker/objective context.

## Evidence required

- Focused shared/server/browser tests proving strict identities, first-seen
  behavior, stale clearing, inert rendering, and focus return.
- Authenticated real-file integration evidence with before/after source and
  configuration bytes and unchanged PTY selection/process evidence.
- Playwright evidence for exact text inspection, rewrite invalidation,
  keyboard flow, responsive/accessibility states, and absence of action
  controls.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes recorded.
- Small coherent commit history, clean branch, fast-forward merge into `dev`,
  and pushed exact `origin/dev` head.

## Open questions

- Durable age, unread, priority, conflict, and delivery history begin with the
  later decision/provenance slices. PC-046 labels their absence rather than
  inferring them.
- Structured reason, consequence, recommendation, options, and exact approval
  action require a supported source grammar or provider-native contract. The
  original whole-source text remains the authoritative review surface here.
