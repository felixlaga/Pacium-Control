# Implementation plan: PC-046 queue list and safe item inspector

- Issue:
  [queue-list-inspector-issue.md](queue-list-inspector-issue.md)
- Owner: Pacium Control
- Agent/session: Codex `/root`
- Branch: `codex/queue-list-inspector`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `016adf3921bfbdf03b29ad2498731dd1db31e3ca`
- Target milestone: Milestone 3 — Pacium mode
- Status: In progress

## Objective

Convert the content-free whole-source classification surface into a useful,
compact queue list and a read-only right-panel inspector. Expose exact original
text only for one exact current item, keep it inert and ephemeral, and preserve
the terminal workspace and strict question/approval boundary.

## Existing behavior

- Protocol 12 publishes configured source health and one deterministic
  content-free `whole_source_v1` candidate per stable nonblank source.
- The queue observer retains each exact bounded stable text in server memory
  and exposes it only through an internal revision/source lookup.
- Pacium renders source cards in the session sidebar with status, requesting
  role, classification/confidence, fixed diagnostic, size, short hash, and
  refresh.
- The browser receives no original text, title, excerpt, path-based read
  authority, decision, or delivery field.
- The right inspector has session Overview, Changes, History, Checks, and
  Activity tabs, with a nested diff-detail pattern and focus restoration.
- Mode switches preserve PTYs, tabs, splits, selection, and session inspector
  context.

Relevant evidence lives in:

- `packages/contracts/src/queue-classification.ts`
- `packages/contracts/src/queue-observation.ts`
- `apps/local-server/src/queue-observer.ts`
- `apps/local-server/src/ws-hub.ts`
- `apps/web/src/pacium-queue-model.ts`
- `apps/web/src/pacium-queue-sources.tsx`
- `apps/web/src/app.tsx`
- PC-044 and PC-045 issue, plan, unit, integration, and browser tests.

## Proposed behavior

The sidebar section becomes **Queue**. It counts only current candidates and
uses a button for each one. The button label is fixed from type and source
label; list metadata remains content-free. Sources without candidates stay
visible as noninteractive health rows, so pending/degraded evidence is not
hidden.

Opening a row stores an ephemeral exact selection and sends a strict
item-inspection request. The right inspector temporarily switches from session
tabs to a queue-item view. A ready response renders the exact text inside a
plain `<pre>` plus structured provenance. It does not extract a semantic title,
render Markdown, enable links, interpret terminal escapes, or expose action
controls.

If the current config or queue observation no longer proves the selected
workspace/source/observation/hash/item identity, the browser immediately drops
the text and presents stale/unavailable recovery. A late response cannot
restore it. Disconnect and General-mode exit also clear the item and text.
Back or Escape returns to the prior inspector tab and restores focus to the
originating queue row.

Each candidate gets `firstObservedAt`, retained only while its item ID stays
current within one server process. The UI labels this explicitly as
process-local evidence and shows the exact timestamp; it does not claim durable
queue age.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: candidate observation and item-inspection schemas,
  protocol messages, exports, fixtures, and protocol version.
- `apps/local-server`: candidate first-seen runtime state, exact item lookup,
  WebSocket dispatch, and authenticated integration evidence.
- `apps/web`: transport request, inspection reducer/projection, Queue list,
  read-only inspector, app routing/focus lifecycle, styling, semantic tests,
  and Playwright workflow.
- `docs`: active protocol/configuration/security/status/readme/backlog/
  changelog truth.

### Data/state changes

- Entity/schema changes:
  - add nullable `candidateFirstObservedAt` to queue source observations;
  - add strict `QueueItemInspection` union with `ready`, `stale`, and
    `unavailable`;
  - ready detail carries exact bounded UTF-8 bytes as base64 plus matching
    current provenance;
  - stale/unavailable detail carries fixed safe diagnostics and no text.
- Commands/events:
  - client `pacium.queue.item.inspect` with request ID, workspace revision,
    source ID, observation revision, content hash, and item ID;
  - server `pacium.queue.item` with correlated strict observation.
- Idempotency: read-only request, exact identity, no filesystem action, no
  automatic replay.
- Migration: none. First-seen and inspected text are process/browser memory
  only.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 12 to 13.
- Bulk observations remain content-free.
- Candidate first-seen is present only for a stable classification with a
  candidate and is null for blank/degraded sources.
- Ready detail invariants:
  - all requested identity fields equal current accepted observer evidence;
  - `originalTextBase64` is bounded to the base64 expansion of
    `MAX_QUEUE_SOURCE_BYTES` and represents the exact decoded current source
    bytes after browser UTF-8 decoding;
  - classifier candidate and content hash still match;
  - no title, excerpt, command, answer, decision, permission, delivery, or
    generic path field exists.
- Stale/unavailable responses contain no original text and use fixed bounded
  codes/copy.
- Strict schema rejection prevents browser-supplied path/content/command or
  extra authority fields.

### Authorization and privilege

- Reuse the authenticated WebSocket, Host/Origin, and ephemeral-token boundary.
- The browser selects from server-published identifiers but supplies no path.
- `QueueObserver.inspectItem` compares the entire current identity tuple before
  returning the already bounded in-memory text.
- Queue source content never enters logs, error messages, notices, row labels,
  ARIA names, durable state, terminal input, or HTML interpretation.
- Base64 avoids JSON control-character expansion exceeding the 128 KiB
  application-message ceiling; the browser validates and decodes it once for
  inert text rendering.
- No result authorizes a question answer or approval.

## Sequence

1. Commit the issue and this plan separately.
2. Add strict item-inspection and candidate-first-seen contracts under protocol
   13 with forbidden-field tests.
3. Track/reset process-local candidate first-seen evidence in the queue runtime.
4. Add exact-current observer lookup with stale/unavailable outcomes.
5. Dispatch the authenticated request in the WebSocket hub and prove no
   arbitrary path or content request is accepted.
6. Add browser transport helpers and an ephemeral correlated inspection
   reducer that clears text on drift/disconnect/mode exit.
7. Turn current candidates into compact queue buttons while preserving
   non-candidate source health.
8. Add the read-only queue inspector, Back/Escape focus restoration, and honest
   unavailable fields without changing session inspector state.
9. Style normal, narrow, zoomed, forced-color, reduced-motion, hostile-content,
   loading, stale, and disconnected states.
10. Add real-file integration and browser workflows proving exact text,
    rewrite invalidation, unchanged PTY/source/config, and question/approval
    safety.
11. Synchronize protocol/configuration/security/readme/status/backlog/
    changelog/issue/plan truth in small commits.
12. Run focused gates, `pnpm verify`, `pnpm test:e2e`, inspect the exact commit
    series, fast-forward into `dev`, and push.

## Failure model

| Failure point                 | Expected state                                 | Recovery                              |
| ----------------------------- | ---------------------------------------------- | ------------------------------------- |
| No candidate                  | Health row only; no inspect action             | Wait, Refresh, or correct source      |
| Source changes before request | `stale`, no text                               | Open current replacement item         |
| Source changes after response | Browser clears text on update                  | Open current replacement item         |
| Config revision changes       | Selection and text cleared                     | Re-enter Pacium and open current item |
| Source becomes degraded       | Selection remains explanatory but text clears  | Correct source and reopen             |
| Forged source/path/item/hash  | Strict rejection or stale detail, no text      | Use a published current row           |
| Disconnect before response    | Request becomes unknown; selection/text clear  | Reconnect and deliberately reopen     |
| Late/stale response           | Reducer ignores it                             | Deliberately reopen current item      |
| Original text is hostile      | Literal inert text in bounded scrolling region | Inspect or edit source outside Pacium |
| Observer unavailable          | Fixed unavailable detail; PTYs/files untouched | Refresh after source/config recovery  |
| Browser storage/reload        | No item/text restoration                       | Deliberately reopen after reconnect   |

## Compatibility

- Supported versions: protocol 13, config schema 1,
  `whole_source_v1`, current plain-text queue sources.
- Fallback behavior: General mode, terminals, source health, and classification
  continue if item inspection is unavailable. Raw text is never reconstructed
  from list metadata.
- Rollback: remove protocol-13 request/detail/first-seen fields and return to
  protocol 12. No durable data cleanup or file rewrite is required.

## Test plan

- Unit: schema invariants; first-seen retain/reset; exact lookup; reducer
  request correlation, identity drift, disconnect/mode clearing; queue sorting
  and labels; focus helpers.
- Property/fault: arbitrary bounded Unicode and controls; all identity fields;
  maximum text; unexpected extras; repeated/open/late messages; generated
  source transitions.
- Contract: protocol 13 client/server unions, content-free aggregate, strict
  no-path/no-command requests, no-authority details, and payload bounds.
- Integration: authenticated ready read, rewrite stale, config drift,
  degradation, reconnect, forged tuple, concurrent watcher update, unchanged
  source/config bytes, and live PTY survival.
- Browser: pointer and keyboard open, loading/ready/stale, Back/Escape focus
  restoration, selected PTY/layout/tab preservation, mode exit/re-entry,
  reload, 320 CSS px, 200% zoom, forced colors, and reduced motion.
- Security: React text escaping, script/URL/ANSI/OSC/C0/C1 strings, no links or
  unsafe HTML, no queue execution, no terminal input, no raw text in notices/
  list/accessibility labels/logs, and approval/action absence.
- Performance: maximum 32 candidate rows, one maximum-size inspected item,
  one-item browser retention, no polling, and semantic queue updates only.

## Documentation changes

- Update protocol/configuration documentation to protocol 13 and describe the
  exact on-demand read boundary.
- Update README and STATUS from metadata-only source rows to a real read-only
  queue list/inspector while preserving later limitations.
- Mark PC-046 complete and PC-047 next only after all evidence passes.
- Record source age as process-local and original text as ephemeral.
- Record exact tests, build sizes, runtime mismatch, browser boundary, and
  remaining PC-047 onward work in the changelog and completion sections.

## Rollout

- Development: bounded synthetic and hostile queue fixtures only.
- Integration: disposable configured queue file plus authenticated WebSocket
  and a live PTY canary.
- Canary: localhost operator review; remote Tailscale behavior remains a later
  independently gated slice.
- Production: none; Pacium Control remains pre-release.

## Open questions

- Queue priority and blocking/risk order require explicit source data. Until
  then, keep accepted config order rather than inventing urgency.
- Process-local first-seen provides honest current-run waiting evidence;
  durable age begins with durable provenance in PC-047/PC-049.
- A richer supported grammar may later populate reason, consequence, options,
  recommendation, or exact approval action. PC-046 shows absence explicitly.
- PC-047 owns question/approval controls and confirmation. PC-046 must remain
  incapable of producing a decision.

## Approval

- Product: one compact list and one right-panel detail surface improve oversight
  without adding a dashboard or replacing the terminal.
- Architecture: exact on-demand observer lookup reuses current PTY/config/queue
  ownership and introduces no database, generic reader, or speculative engine.
- Security: raw text crosses only an authenticated exact-item boundary, remains
  bounded/inert/ephemeral, clears on drift, and grants no authority.
