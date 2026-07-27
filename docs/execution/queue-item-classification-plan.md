# Implementation plan: Conservative queue-item classification

- Issue: [PC-045](queue-item-classification-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/queue-item-classification`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `c54d5833cd67a091915f6366fc8449ddd37e661f`
- Target milestone: Milestone 3
- Status: In progress

## Objective

Turn one complete stable queue-source document into at most one reproducible
candidate item with an honest question, approval, failure, review, or unknown
classification. Keep approval recognition intentionally strict, expose only
bounded content-free classification metadata in the existing source-health UI,
and leave original-text inspection, multi-item parsing, decisions, and delivery
for their owning slices.

## Existing behavior

- Protocol 11 carries content-free queue-source health for the exact accepted
  Pacium config revision and source IDs.
- `QueueObserver` reads only accepted paths, retains complete stable text behind
  `sourceText(revision, sourceId)`, and publishes status, byte length,
  modification time, SHA-256, and bounded errors.
- Stable/empty content hashes are deterministic across restart while source
  observation revisions are process-local.
- Queue source rows render only in Pacium mode and currently state that stable
  reads describe source health, not queue items.
- The repository contains rich question and approval templates, but no accepted
  legacy multi-item queue syntax or production fixture corpus.
- No queue item identity, classification, parser diagnostic, item protocol,
  browser item state, durable provenance, decision, or delivery state exists.

## Proposed behavior

1. Advance the coordinated browser/server protocol to 12 and extend each source
   observation with nullable content-free classification metadata.
2. Classify only `stable` evidence whose retained text and SHA-256 belong to the
   same completed read.
3. Treat the complete source document as boundary `whole_source_v1`; blank
   content produces no candidate and every nonblank document produces exactly
   one candidate.
4. Recognize exact supported first-line markers, detect additional supported
   top-level markers as unsupported multi-item structure, and otherwise use
   only the safe final-question-mark heuristic.
5. Bind the deterministic item ID to boundary version, configured source ID,
   and content hash.
6. Reuse classification when a refresh returns the same stable source ID/hash;
   replace it on changed content and clear it on every non-stable state.
7. Project the metadata only against exact config/source evidence and add one
   compact type/confidence/diagnostic line to the existing Pacium source row.

## Architecture and boundaries

### Modules touched

- `packages/contracts/src/queue-classification.ts`: type, confidence, boundary,
  diagnostic, candidate, and source-classification schemas.
- `packages/contracts/src/queue-observation.ts`: nullable classification on
  source evidence plus state invariants.
- `packages/contracts/src/protocol.ts`: protocol 12 through the existing queue
  snapshot/update messages.
- `apps/local-server/src/queue-item-classifier.ts`: deterministic bounded
  whole-source parser and item identity.
- `apps/local-server/src/queue-observation-model.ts`: current classification
  state, semantic equality, and degraded-state clearing.
- `apps/local-server/src/queue-observer.ts`: classify changed stable hashes,
  reuse unchanged classification, and preserve exact source-text/hash coupling.
- `apps/web/src/pacium-queue-model.ts`: exact-revision/source projection of
  classification evidence.
- `apps/web/src/pacium-queue-sources.tsx`: compact metadata presentation.
- Focused contract, classifier, model, observer, integration, semantic,
  security, and Playwright tests plus current-truth docs.

### Data/state changes

- Entity/schema changes: add ephemeral `QueueSourceClassification`; do not add a
  durable QueueItem entity or change `pacium.json`.
- Source classification shape:

```text
status: none | candidate
boundary: whole_source_v1
candidate:
  itemId: 64-char lowercase SHA-256
  type: question | approval | failure | review | unknown
  confidence: confirmed | high | medium | low
diagnostics[]:
  code: fixed enum
  message: fixed bounded copy
```

- `none` has no candidate and currently represents whitespace-only stable text.
  Nonblank stable text always has one candidate, including `unknown`.
- Empty files and every pending/degraded source have `classification: null`;
  their existing source status already explains why no item exists.
- Commands/events: no new operation. Existing `pacium.queue.sources` and
  `pacium.queue.sources.updated` carry the new field.
- Idempotency: classification is cached and reused for the same source ID/hash.
  Item identity is
  `sha256("whole_source_v1\\0" + sourceId + "\\0" + contentHash)`.
- Migration: none. No JSON/JSONL file, cache, offset, or durable item is added.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 11 to 12 because strict source observations
  gain a required nullable `classification` field.
- Candidate metadata contains no original text, title, excerpt, source path,
  label, requesting role, command, arguments, terminal input, decision,
  delivery, callback, or approval-authority field.
- Bounds:
  - one classification per source;
  - one candidate per classification;
  - at most four diagnostics;
  - fixed diagnostic enum and at most 160 message characters;
  - fixed whole-source boundary version;
  - existing maximum 32 sources and 128 KiB application-message envelope.
- State invariants:
  - only `stable` source evidence may contain a classification;
  - `none` requires `candidate: null` and at least one diagnostic;
  - `candidate` requires one candidate;
  - `approval` never uses `medium` or `low` confidence;
  - all non-stable source states require `classification: null`.

### Classification grammar

The classifier removes a leading Unicode BOM for matching, preserves original
text unchanged, and examines lines without executing or rendering them.
Leading blank lines are allowed before the first content line.

Exact case-sensitive first-content-line forms:

| Marker                                     | Type     | Confidence |
| ------------------------------------------ | -------- | ---------- |
| `# Question: <nonblank>`                   | question | confirmed  |
| `Question: <nonblank>`                     | question | high       |
| `# Approval request: <nonblank>`           | approval | confirmed  |
| `Approval request: <nonblank>`             | approval | high       |
| `# Failure: <nonblank>`                    | failure  | confirmed  |
| `Failure:`, `ERROR:`, or `FAILED:` + title | failure  | high       |
| `# Review request: <nonblank>`             | review   | confirmed  |
| `Review request:` or `Review:` + title     | review   | high       |
| Unmarked trimmed prose ending in `?`       | question | medium     |
| Other nonblank input                       | unknown  | low        |

Marker-like first lines with no nonblank suffix become `unknown` with
`malformed_marker`. More than one supported top-level marker anywhere in the
document becomes `unknown` with `multiple_markers`. An exact first marker plus
another type marker does not retain the first type.

Fixed diagnostic codes:

```text
blank_content
legacy_marker
question_heuristic
unrecognized_format
malformed_marker
multiple_markers
```

Marker recognition is not case-folded and does not inspect configured
filenames, labels, roles, paths, delivery methods, embedded commands,
checkboxes, or permission vocabulary. In particular, “Can you approve this?”
is a question, not an approval.

### Authorization and privilege

- The authenticated queue request still selects no path and no item.
- The classifier receives only PC-044 bounded stable text, configured source
  ID, and complete content hash.
- Classification is passive metadata. It cannot answer, approve, deliver,
  execute, open a link, send terminal bytes, invoke a provider, or mutate state.
- Original text never leaves the local-server queue service in this slice.

## UI behavior and states

| Source/classification             | Existing source row addition                           |
| --------------------------------- | ------------------------------------------------------ |
| Pending or degraded               | No classification line; source health remains primary  |
| Empty                             | `No item · Empty source`                               |
| Stable whitespace                 | `No item · Blank source`                               |
| Confirmed/high/medium candidate   | `<Type> · <Confidence> confidence`                     |
| Unknown candidate                 | `Unknown · Low confidence · <fixed diagnostic>`        |
| Disconnected accepted evidence    | Same metadata under existing disconnected footer label |
| Exact config revision unavailable | No candidate displayed                                 |

The source article accessible name adds type/confidence only when current
classification exists. Type is paired with text and a restrained existing
indicator treatment; approval does not receive an action button or permission
color. The terminal remains the strongest visual surface.

## PTY/process lifecycle

- Classification starts, attaches, inputs, resizes, signals, closes, or
  relaunches no PTY.
- Browser mode changes and refresh do not alter classification service lifetime
  or terminal ownership.
- Queue content and derived metadata can never enter terminal input.
- Server restart ends direct PTYs as before, rereads accepted queue sources, and
  deterministically reconstructs candidates from current complete evidence.

## Reconnect and failure behavior

- Reconnect receives a complete protocol-12 snapshot after current config/read
  reconciliation.
- Browser state retains accepted classification during disconnect but labels
  the whole source projection disconnected.
- A config revision mismatch hides classification rather than joining it to a
  changed source definition.
- Read/watcher degradation clears classification with the same source revision
  transition; stale item metadata is not presented as current.
- Parser exceptions are caught at the observer boundary and become a fixed
  low-confidence unknown diagnostic without source text in the error.
- No classification failure affects terminals, General mode, config
  replacement, other sources, or source files.

## Sequence

1. Commit issue and plan separately.
2. Add strict classification contracts and protocol-12 fixtures.
3. Add the deterministic whole-source classifier with table-driven safety
   fixtures.
4. Extend queue runtime/source observation state and semantic equality.
5. Integrate changed-hash classification and unchanged-hash reuse in the
   observer.
6. Add authenticated integration tests for rewrite/degrade/reconnect and
   content-free messages.
7. Extend browser projection and semantic source-row presentation.
8. Add hostile-text, approval-safety, responsive, and real-file browser
   evidence.
9. Synchronize configuration/protocol docs, README, status, backlog, issue,
   plan, and changelog.
10. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect exact history,
    fast-forward into `dev`, and push.

## Failure model

| Failure point                   | Expected state                              | Recovery                         |
| ------------------------------- | ------------------------------------------- | -------------------------------- |
| Source pending/empty/degraded   | No current classification                   | Stable read or source correction |
| Whitespace-only stable text     | No candidate, `blank_content`               | Rewrite source                   |
| Exact marker lacks suffix       | Unknown, `malformed_marker`                 | Add explicit title/action        |
| Multiple supported markers      | Unknown, `multiple_markers`                 | Use one item per source          |
| Unrecognized nonblank text      | Unknown, `unrecognized_format`              | Add a supported marker           |
| Conversational approval wording | Question/unknown, never approval            | Use exact approval marker        |
| Source changes during parse     | Old generation/sequence result is discarded | Stable read retries/re-observes  |
| Config revision changes         | Old classification hidden/discarded         | New config observation           |
| Browser disconnect              | Last accepted metadata labelled stale       | Reconnect snapshot               |
| Classifier implementation error | Fixed unknown metadata; terminals survive   | Correct code and Refresh         |

## Compatibility

- Supported versions: protocol 12, config schema 1, queue boundary
  `whole_source_v1`, existing plain-text source format.
- Fallback behavior: unknown is a valid safe candidate classification; General
  terminals and source health remain available.
- Rollback: remove classification field/parser/UI and return to protocol 11. No
  queue/config/repository/durable-state cleanup is required.

## Test plan

- Unit: strict schemas, all grammar rows, confidence, diagnostics, blank/BOM/
  Unicode/control input, approval strictness, multiple markers, and identity.
- Property/fault: arbitrary bounded strings, line endings, marker placement,
  repeated markers, source IDs/hashes, deterministic output, and no throws.
- Contract: protocol 12, state-dependent classification nullability, diagnostic
  bounds, item hash, extra fields, approval confidence, and forbidden content/
  authority fields.
- Integration: observer stable classification, cached unchanged hash, rewrite
  replacement, empty/missing/watch failure clearing, stale generation,
  reconnect, and authenticated content-free snapshots/updates.
- Browser: current candidate metadata only in Pacium, reload/Refresh,
  disconnected projection, unchanged selected PTY, narrow/zoom/forced colors/
  reduced motion/focus.
- Security: conversational fake approvals, commands, paths, HTML, links,
  controls, queue text absence, no source/config writes, and no terminal input.
- Performance: 32 maximum-size sources, single-pass bounded classification, no
  timers/polling, and unchanged-source classification reuse.

## Documentation changes

- Update active workspace/protocol documentation from protocol 11 to 12.
- Document the one-document boundary and explicit supported markers.
- Update README/status/backlog to say classification metadata exists while
  original-text item UI and actions remain absent.
- Mark PC-045 complete and PC-046 next only after full evidence.
- Add changelog results and keep multi-item parsing, durable provenance,
  decisions, delivery, and authority explicitly deferred.

## Rollout

- Development: synthetic bounded fixtures and disposable queue sources only.
- Integration: fault/unit tables plus authenticated real-file observer tests.
- Canary: localhost development with explicit operator-created fixture content.
- Production: none; project remains pre-release.

## Open questions

- A supported multi-item syntax requires real legacy examples or an explicit
  structured format. It is not inferred from blank lines, headings, or
  checkboxes in PC-045.
- PC-046 may render the exact retained original text in a safe text-only
  inspector, but must keep it non-HTML and tie it to the same item ID/hash.
- Durable source/item provenance begins only when decisions or restart-safe
  import state require it. Deterministic reconstruction is sufficient here.

## Approval

- Product: the first item signal is useful in the existing source row without
  pretending a complete queue list exists.
- Architecture: the classifier consumes the PC-044 vertical slice and adds no
  generalized parser, database, or speculative durable state.
- Security: approval requires an exact concrete marker, ambiguity fails to
  unknown, original text stays server-only, and classification grants no
  authority.
