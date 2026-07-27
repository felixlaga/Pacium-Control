# Classify one bounded queue item per stable source

**Status:** Complete

## Problem

PC-044 can prove that a configured queue source was read completely and retain
its bounded original text in local-server memory, but Pacium still cannot say
whether that document is a question, approval request, failure, review request,
or unknown input.

Treating arbitrary prose as an approval would be dangerous. Treating arbitrary
blank-line or Markdown structure as multiple items would also manufacture
boundaries that the legacy sources did not explicitly provide. The current
workflow has no accepted multi-item wire format, stable embedded IDs, or corpus
that justifies broader parsing.

## Outcome

Every complete nonblank stable queue-source observation receives one
deterministic, source-bound candidate-item identity and an honest classification
with confidence and fixed diagnostics. Empty/blank input produces no item.
Explicit supported markers can identify questions, concrete approval requests,
failures, and review requests; ambiguous, malformed, or multi-item-looking text
remains unknown.

Pacium mode shows the classification metadata beside source health without
rendering original queue text or adding answer/approval actions. Source files,
terminal input, provider sessions, and durable state remain unchanged.

## Scope

- Define strict bounded queue-item type, confidence, boundary, diagnostic, and
  candidate metadata contracts.
- Advance the coordinated local WebSocket protocol from 11 to 12.
- Treat one complete stable source document as at most one candidate item under
  boundary version `whole_source_v1`.
- Derive a deterministic SHA-256 item identity from boundary version,
  configured source ID, and complete source content hash.
- Recognize only supported first-content-line markers:
  - `# Question: <title>` or `Question: <title>`;
  - `# Approval request: <exact action>` or
    `Approval request: <exact action>`;
  - `# Failure: <title>`, `Failure: <title>`, `ERROR: <title>`, or
    `FAILED: <title>`;
  - `# Review request: <title>`, `Review request: <title>`, or
    `Review: <title>`.
- Give exact Markdown template markers `confirmed` confidence and supported
  plain-text legacy markers `high` confidence.
- Allow a final question mark on otherwise unmarked prose to classify only as
  a `medium`-confidence question.
- Require approval markers to contain a nonblank concrete action after the
  colon. Conversational words such as “approve”, “permission”, “allow”, command
  text, checkboxes, or question marks never infer approval.
- Detect more than one supported top-level marker as unsupported multi-item
  structure and classify the whole document as `unknown`.
- Return fixed non-content diagnostics for blank, unknown, malformed marker,
  ambiguous marker, and unsupported multi-item input.
- Reclassify only complete stable source evidence and discard classification
  when the source becomes empty, missing, changing, invalid, unsafe, oversized,
  unreadable, or unwatched.
- Add compact type/confidence/diagnostic metadata to the existing Pacium source
  row with text and icon pairing.
- Keep General mode, selected PTY, layouts, inspector state, and terminal focus
  unchanged.

## Non-scope

- Splitting one source into multiple queue items.
- Parsing arbitrary Markdown sections, YAML, JSON, front matter, checkboxes,
  timestamps, options, recommendations, commands, repository paths, risk, or
  requesting sessions.
- Treating filenames, configured labels, requesting roles, delivery methods,
  terminal output, or provider events as classification evidence.
- Showing original queue text, a derived title, excerpt, item list, inspector,
  queue navigation, waiting time, or unread state.
- Decisions, answers, approval controls, delivery, acknowledgement, conflicts,
  supersession, or activity entries.
- Granting permission or executing any action from a classification.
- Cross-source deduplication or treating identical content in different sources
  as one item.
- Durable queue import provenance, observation caches, a `queue-state.json`
  file, a database, or a generalized parser/plugin framework.
- A configurable grammar, heuristics trained from operator content, or provider
  classification.

## Acceptance criteria

- [x] Only a `stable` source with exact retained text and matching content hash
      can produce one candidate item; every other source state produces none.
- [x] An empty file and a whitespace-only document produce no item, with a
      bounded fixed diagnostic only for the whitespace-only case.
- [x] Exact supported Markdown and legacy first-line markers classify question,
      concrete approval, failure, and review with documented confidence.
- [x] A final question mark can produce only a medium-confidence question and
      can never produce approval.
- [x] Approval requires the exact supported approval marker and a nonblank
      action after the colon; all vague permission language remains question or
      unknown.
- [x] Malformed supported markers, conflicting first-line markers, and more
      than one supported top-level marker classify as unknown with fixed
      diagnostics.
- [x] Unknown hostile text, commands, paths, HTML, terminal controls, and
      Markdown are treated only as bounded data and never executed, rendered as
      HTML, linked, or sent to a terminal/provider.
- [x] Candidate identity is deterministic across restart for the same source ID
      and content hash, changes with either input, and never relies on time,
      path, label, or process-local observation revision.
- [x] Protocol messages contain classification metadata but no original text,
      title, excerpt, command, path, prompt, decision, or authority field.
- [x] An unchanged stable observation does not reclassify, advance source
      revision, or broadcast duplicate evidence.
- [x] A changed stable observation replaces the candidate; a degraded
      observation removes it and cannot retain stale classification as current.
- [x] The browser accepts classification only for the exact accepted config
      revision/source ID and labels disconnected evidence honestly.
- [x] Pacium mode pairs type/confidence with text and icon in the existing
      source-health row; General mode shows no classification surface.
- [x] Classification and UI updates never change source files, `pacium.json`,
      PTYs, selection, layout, inspector state, keyboard capture, or prompt
      scope.
- [x] Unit, property/fault, contract, integration, security, semantic, and
      browser tests pass with synchronized issue, plan, README, status, backlog,
      and changelog evidence.

## User experience

The existing source-health row gains one restrained classification line:

```text
● Needs Felix          Stable · Meta · 1.8 KB · 5c12a9e1
  Question · High confidence
  Observed 4s ago                               [ Refresh ]
```

Other honest states include:

```text
Approval · Confirmed
Failure · High confidence
Review · Confirmed
Unknown · Low confidence · Multiple items are not supported yet
No item · Blank source
```

This does not claim the item is actionable, blocking, safe, parsed completely,
or authorized. There are no answer or approval controls in PC-045. PC-046 will
own the original-text inspector and queue list after this classification
contract is proven.

## Architecture

- Systems and modules touched: queue classification contracts/pure parser,
  queue observer projection, protocol 12, browser queue model/source row, tests,
  and current-truth documentation.
- Systems of record: queue files own original text; accepted config owns source
  identity; the PC-044 observer owns current stable bytes/hash; the classifier
  owns only derived ephemeral candidate metadata.
- State transitions: no item -> classified candidate; candidate -> replaced
  candidate on changed complete hash; candidate -> no item when source degrades;
  ambiguous/malformed input -> unknown candidate.
- Protocol/schema impact: protocol 12 adds nullable bounded candidate metadata
  to each source observation; `pacium.json` remains schema version 1.
- Relevant ADRs: ADR-0007, ADR-0012, ADR-0014, and ADR-0015.

## Security and privacy

- Authorization: classification is passive observation behind the existing
  authenticated queue operation and selects no path or action.
- Privilege: the pure classifier receives only already-bounded server-memory
  text and hashes and performs no I/O.
- Secrets/logging: original text and derived title/excerpt are absent from
  protocol, HTML, logs, errors, notifications, and durable state.
- Abuse/failure scenario: a source may contain shell commands, HTML, control
  bytes, fake headings, multiple markers, or “approve this” prose. The
  classifier returns data-only metadata and never grants authority.

## Reliability

- Idempotency: deterministic classification and identity depend only on
  boundary version, source ID, and complete content hash.
- Timeouts/retries: parsing is synchronous, single-pass, and bounded by the
  existing 64 KiB source limit; it adds no timer, polling, or retry.
- Restart behavior: the observer rereads and deterministically reconstructs the
  same candidate when source ID and content hash are unchanged.
- Unknown outcome: malformed or unsupported structure remains an explicit
  unknown candidate; no action or write has an unknown outcome.
- Migration/rollback: protocol 12 is a coordinated local client/server update;
  removing candidate metadata needs no file migration or cleanup.

## Test plan

- Unit: every marker/type/confidence, approval strictness, question heuristic,
  blank, malformed, multi-marker, unknown, Unicode, controls, and deterministic
  identity.
- Contract: strict protocol-12 candidate schema, state-dependent nullability,
  bounds, diagnostics, hostile extra fields, and forbidden authority/content
  fields.
- Integration: current observer text/hash classification, rewrite replacement,
  degraded-state removal, reconnect snapshot, and content-free authenticated
  messages.
- Browser: type/confidence/diagnostic row only in Pacium, unchanged terminal,
  refresh/reload, disconnected evidence, narrow/zoom/forced-colors/focus.
- Failure/recovery: stale config generation, changing read, server restart,
  unknown/malformed input, and source watcher failure.
- Security: fake approval prose, embedded commands/HTML/links/controls, no
  execution/render/log/protocol content, and no source/config mutation.

## Dependencies

- Blocked by: PC-044.
- Blocks: PC-046 queue list and inspector; PC-047 immutable local decisions.

## Evidence required

- Small coherent commits for issue, plan, contracts/protocol, pure classifier,
  observer integration, browser model/UI, security/integration/browser tests,
  and docs.
- Fixture table proving exact approval marker requirements and safe fallback.
- Deterministic identity proof across a reconstructed observer.
- Content/source/config/terminal preservation proof.
- Exact `pnpm verify`, `pnpm test:e2e`, clean history, fast-forward `dev` merge,
  and pushed remote SHA.

## Open questions

- Real multi-item boundaries remain deliberately unsupported until an explicit
  legacy syntax or structured transport fixture is accepted. PC-046 may present
  one candidate per source without inventing offsets.
- PC-046 will decide how much original text can be shown safely in the
  inspector. PC-045 sends no title or excerpt to the browser.
- Durable provenance begins with the first decision/import consumer that must
  survive restart; this slice keeps classification reproducible and ephemeral.
