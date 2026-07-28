# Implementation plan: Clean agent activity cards

- Issue: [PC-063](agent-activity-cards-issue.md)
- Owner: Codex
- Agent/session: primary implementation agent
- Branch: `codex/agent-activity-cards`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `f7c1148548fcbd7d9fd2938fac93696820a77df0`
- Target milestone: Epic 5 / PC-063
- Status: In progress

## Objective

Turn the selected session's generic recent-fact rows into compact,
source-navigable supervision cards, while providing an explicit bounded
browser-local terminal fallback whenever provider evidence is not ready. Keep
the terminal primary and every status honest about source and confidence.

## Existing behavior

- Protocol 21 carries strict bounded Claude/Codex activities, safe typed
  extensions, provider health/capabilities, attention, and freshness.
- `buildRecentActivity` combines at most seven provider, process, Git, and
  verification facts but gives each only source/title/detail/time strings.
- `RecentActivityPanel` renders every fact with the same generic list-row
  treatment and no direct source navigation.
- The rendered xterm surface owns a bounded parsed buffer and exposes only
  clear/focus/write/snapshot methods. Activity never reads terminal text.
- Browser refresh reconstructs terminal state from the existing bounded server
  snapshot. No activity or excerpt state is durable.

## Proposed behavior

Each `ActivityFact` gains a strict browser-only presentation kind and one source
target. The component derives restrained semantic tone and a short type label
from that kind, renders safe metadata as individual compact spans, and offers
one target action:

```text
provider/process -> Terminal
Git working tree -> Changes
Git commit -> History
verification -> Checks
```

Provider facts retain only existing fixed summaries and typed safe extension
fields. Prompt, message, plan, question, approval, command, output, diff, path,
and request content remain absent.

`TerminalSurfaceHandle.readRecentText()` reads the latest parsed xterm buffer
only after a button click. A pure helper selects at most four newest non-empty
lines and 800 Unicode characters, returning ready/empty evidence with a
truncation flag. The Activity component offers this fallback only when the
provider source is absent, unavailable, degraded, failed, unsupported, or
stale. It stores the returned excerpt only in component state and invalidates
it when a key derived from selected session, connection state, and provider
observation changes.

## Architecture and boundaries

### Modules touched

- `apps/web/src/recent-activity-model.ts`: presentation kinds, metadata, source
  targets, and fallback eligibility.
- `apps/web/src/recent-activity.tsx`: card timeline, source actions, and
  explicit fallback state.
- `packages/terminal-ui/src/terminal-excerpt.ts`: pure excerpt bounds.
- `packages/terminal-ui/src/terminal-surface.tsx`: read-only recent-buffer
  handle.
- `apps/web/src/app.tsx`: existing-tab/source navigation and terminal read.
- Existing web CSS, focused unit/semantic tests, and Playwright Activity flow.

### Data/state changes

- Entity/schema changes: none; card and excerpt models are disposable browser
  projections.
- Commands/events: none; source actions select existing UI surfaces and
  terminal fallback makes no transport call.
- Idempotency: repeated capture replaces one bounded component value.
- Migration: none.

### Protocol changes

- Protocol remains 21.
- No terminal bytes, excerpt, card state, source action, or provider content is
  added to client/server messages.

### Authorization and privilege

- Existing selected-session and inspector state owns navigation.
- `TerminalSurfaceHandle` can expose only bounded parsed text, never raw
  process access, input, environment, filesystem, or shell execution.
- The callback has no path, command, provider request, or terminal-input
  parameter.
- React text rendering remains the only excerpt consumer.

## Sequence

1. Commit the PC-063 issue and plan separately.
2. Add strict activity presentation kinds, targets, metadata, and model tests.
3. Add the pure terminal-excerpt bounder and tests.
4. Expose the read-only bounded xterm buffer method.
5. Render compact semantic cards with source actions.
6. Add explicit fallback capture, empty/unavailable/hide, and invalidation
   states.
7. Wire existing terminal focus and inspector-tab navigation.
8. Add compact, light/dark, forced-color, reduced-motion, narrow, and zoom
   styling/evidence.
9. Add a browser workflow for source navigation and fallback without terminal
   mutation.
10. Synchronize docs, run every gate, fast-forward `dev`, and push while
    preserving the small commits.

## Failure model

| Failure point                     | Expected state                                                    | Recovery                                 |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| No selected session               | Existing teaching empty state                                     | Select or create a terminal              |
| Provider ready                    | Native/hook cards; fallback hidden                                | Use card Terminal action for raw context |
| Provider unavailable/stale        | Honest source status plus optional fallback button                | Capture explicitly or inspect terminal   |
| Terminal surface not rendered     | Fallback unavailable; PTY/session state unchanged                 | Open the session terminal and retry      |
| Terminal buffer has no text       | Explicit empty fallback                                           | Wait for output or use the terminal      |
| Hostile terminal text             | Bounded inert preformatted text only                              | Hide the excerpt                         |
| Session/evidence/connection drift | Captured excerpt clears before a different boundary can render it | Capture again from the current boundary  |
| Source-action target unavailable  | Existing inspector/terminal state remains; no lifecycle mutation  | Use another source or restore connection |
| Browser refresh                   | Excerpt disappears; PTY/snapshot restoration remains unchanged    | Explicitly capture again                 |

## Compatibility

- Supported versions: existing protocol-21 browser/server pair and xterm 6
  parsed-buffer API.
- Fallback behavior: the current generic evidence remains readable if semantic
  tone is unavailable; the terminal remains independently usable if capture is
  unavailable.
- Rollback: remove browser-only presentation/fallback fields and the read
  handle; no server or persisted-state rollback.

## Test plan

- Unit: every provider activity kind, process/Git/check kinds, tones, targets,
  metadata, deterministic ordering, bounds, fallback eligibility, excerpt line
  and Unicode ceilings.
- Property/fault: blank lines, wrapped-width text, hostile HTML/ANSI-like
  strings, long Unicode, missing buffers, and simultaneous facts.
- Contract: protocol 21 and provider raw-content exclusion regressions.
- Integration: no new server path; existing provider/session/Git/check suites
  remain regression evidence.
- Browser: Activity cards, Terminal/Changes/History/Checks actions, explicit
  fallback capture/hide, unchanged PTY selection, reconnect clearing, 320 CSS
  px, 200% zoom, forced colors, and reduced motion.
- Security: no automatic terminal read, no storage/logging/network mutation,
  inert text, and no question/approval action.
- Performance: seven cards maximum, one four-line/800-character excerpt, no
  polling or background terminal scans.

## Documentation changes

- Mark PC-063 complete only after exact evidence passes.
- Update `STATUS.md`, `README.md`, `CHANGELOG.md`, and the implementation
  backlog.
- Retain PC-064 degradation and PC-065 relaunch boundaries explicitly.

## Rollout

- Development: pure deterministic models and semantic rendering fixtures.
- Integration: current local browser/server with real PTY fallback fixture.
- Canary: existing localhost Playwright terminal workflow; no provider prompt.
- Production: none; packaging and real Tailscale release gates remain later
  milestones.

## Open questions

- A future provider-safe content contract may add bounded message summaries.
  PC-063 deliberately does not infer or expose that content.

## Approval

- Product: PC-063 is the next accepted backlog item and directly improves
  simplicity, organization, and oversight.
- Architecture: terminal remains primary; cards are disposable projections and
  fallback is explicitly non-authoritative.
- Security: no new network/process authority, no automatic read, strict
  browser-only bounds, inert rendering, and no persistence.
