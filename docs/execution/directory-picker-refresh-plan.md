# Implementation plan: PC-078 directory-picker refresh

- Issue: [PC-078 refresh the host working-directory picker](directory-picker-refresh-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/directory-picker-refresh`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `d84e2f93083f6699db57f3bcf81b7c44f01637c5`
- Target milestone: Milestone 1 daily-use polish
- Status: Complete

## Objective

Close the concrete recovery, storage, keyboard, and rendered-evidence gaps in
the implemented host directory picker while preserving its narrow read-only
filesystem authority and calm compact visual hierarchy.

## Existing behavior

- `GET /api/directories` locally and same-origin `POST /api/directories`
  through HTTPS return the same strict bounded `DirectoryListing`.
- The server canonicalizes an absolute requested path, lists directories only,
  marks immediate `.git` children, and reports truncation.
- The picker offers parent, breadcrumb, default, Home, recent, hidden, filter,
  Retry, Back, and current-folder confirmation controls.
- Recent paths use versioned browser-local JSON.
- The parent new-terminal form retains an editable absolute-path fallback and
  does not create a PTY until explicit submission.
- Existing Playwright coverage proves only modal open, initial focus, Escape,
  and focus restoration. PC-029 records rendered validation as pending.

Observed refresh gaps:

- The default control repeats an invalid initial path before any listing
  succeeds instead of requesting the server-owned default.
- unguarded `localStorage.getItem` and `setItem` can break opening or
  confirmation;
- a known absolute path cannot be entered within the browse surface;
- directory rows have no compact arrow-key traversal;
- semantic and browser tests do not exercise navigation, selection, recent
  reuse, invalid recovery, or narrow rendering.

## Proposed behavior

The existing modal remains the visual foundation. A restrained location-edit
control exposes the canonical host path only when requested. The visible
button and `Cmd/Ctrl+L` open it; Enter navigates and Escape returns to
breadcrumbs. `Cmd/Ctrl+Enter` confirms the currently loaded canonical folder.
The filter transfers ArrowDown focus into the result list, and directory rows
support ArrowUp/ArrowDown/Home/End traversal.

The server-owned default action calls the endpoint without a browser-supplied
path, so it can recover even from an invalid first request. Recent-path storage
is best-effort: read failure becomes an empty list and write failure never
blocks returning the selected canonical path.

## Architecture and boundaries

### Modules touched

- `apps/web/src/directory-picker-model.ts`: pure keyboard action resolution and
  failure-safe recent-path helpers.
- `apps/web/src/directory-picker.tsx`: path-edit, focus, navigation, recovery,
  and status behavior.
- `apps/web/src/styles.css`: compact location editor, focus, error, narrow,
  forced-color, and reduced-motion presentation.
- `apps/web/src/app.tsx`: selection focus restoration only if required.
- Existing unit, semantic-render, transport/security, and Playwright suites.
- PC-029/PC-078 execution docs, backlog, status, README, and changelog.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: none; the existing idempotent directory read remains.
- Idempotency: path navigation and Retry remain read-only.
- Migration: recent-path schema remains version 1; invalid or inaccessible
  browser storage degrades to an empty best-effort list.

### Protocol changes

- WebSocket protocol remains 18.
- `DirectoryListingSchema`, maximum path size, result cap, and
  `/api/directories` methods remain unchanged.
- No browser-supplied host, identity, command, repository root, or mutation
  field is added.

### Authorization and privilege

- `authorizeProtectedApi` continues to run before the directory resolver.
- Local reads require canonical loopback authority and the ephemeral token.
- HTTPS reads require exact Serve Host/Origin/login authority and the same
  token.
- The invoking OS user's ordinary filesystem permissions remain the maximum
  authority.

## Sequence

1. Commit the PC-078 issue and implementation plan separately.
2. Add pure recent-storage and keyboard-navigation behavior with unit tests.
3. Wire failure-safe recents and true default recovery into the picker.
4. Add the explicit host-path editor and keyboard/focus behavior.
5. Refine compact desktop/narrow styling and semantic render coverage.
6. Add a real Playwright workflow with isolated host directory fixtures where
   practical and explicit no-process-before-submit evidence.
7. Capture before/after screenshots and run focused browser accessibility
   states.
8. Run full verification, synchronize active documentation, and record exact
   evidence.
9. Fast-forward the verified branch into `dev` and push without squashing its
   small commits.

## Failure model

| Failure point                     | Expected state                                              | Recovery                                                        |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| Initial typed path is invalid     | Bounded unavailable state; no parent form or PTY change     | Pacium default, valid recent, or Back                           |
| Direct path is relative/missing   | Server-authored bounded error; requested text retained      | Edit path, default, Home when known, recent, or Retry           |
| Recent path is stale              | Same unavailable state; other recents remain                | Choose another location or return                               |
| Browser storage read fails        | Picker opens with no recents                                | Browse normally                                                 |
| Browser storage write fails       | Canonical selection still returns to the form               | Continue; recents are best-effort                               |
| Request resolves late             | Sequence guard ignores stale result                         | Current navigation remains authoritative                        |
| Connection/token becomes invalid  | Bounded browse error; existing PTYs and form values survive | Reconnect, Retry, or Back                                       |
| Directory is empty/filtered empty | Distinct explanatory empty state                            | Clear filter, show hidden, parent, path, or default             |
| Directory result is truncated     | Visible bounded warning                                     | Navigate more narrowly; filtering is only over returned entries |

## Compatibility

- Supported versions: current protocol 18 application.
- Fallback behavior: the parent absolute-path field remains editable and
  terminal creation still performs server-side path validation.
- Rollback: remove only the picker interaction changes; there is no server or
  durable-state migration.

## Test plan

- Unit: storage exceptions, serialization, deduplication, breadcrumbs,
  key-to-focus action resolution, path-edit action resolution.
- Property/fault: malformed recent JSON and bounded/relative paths retain
  current rejection behavior.
- Contract: existing strict listing schema and result ceiling.
- Integration: existing exact local and Serve authorization, token, method,
  body, Host, Origin, identity, and path errors.
- Browser: initial focus, location edit, parent/folder navigation, filter,
  hidden toggle, current-folder confirmation, parent form update, recent reuse,
  invalid-first recovery, Escape layers, and no early PTY launch.
- Security: re-run all remote request-classification and protected-read tests;
  no new endpoint or protocol authority.
- Performance: no recursive reads or new server work; browser row traversal is
  bounded by the existing 250-entry contract.

## Documentation changes

- Mark PC-078 and the original PC-029 rendered evidence honestly.
- Update active backlog, status, README behavior, and changelog.
- Keep real Tailscale canary, manual screen-reader review, and release evidence
  separate from automated browser results.

## Rollout

- Development: use the repository and disposable inaccessible/missing paths.
- Integration: exercise local and proxy-shaped HTTP tests.
- Canary: use locally before the later real Tailscale Serve canary.
- Production: not part of this slice; packaging remains later work.

## Open questions

- None blocking. Favorites, directory creation, recursive search, and
  workspace-root configuration remain explicitly deferred.

## Approval

- Product: the owner explicitly requested a modern, easier, sleek host working
  directory interaction and asked implementation to continue.
- Architecture: no protocol, process, persistence, or filesystem-ownership
  expansion.
- Security: all reads keep the implemented PC-077 authority classifier and
  PC-029 bounds.

## Completion evidence

- Pure state helpers fail soft on storage exceptions and deterministically
  resolve path, confirmation, filter, and result-row keyboard actions.
- The refreshed component keeps protocol 18 and `/api/directories` unchanged,
  requests the server-owned default without reusing an invalid browser path,
  preserves focus after authoritative navigation, and returns selection even
  when browser-local persistence is denied.
- The rendered desktop and 320px surfaces preserve the existing compact
  hierarchy while adding one explicit path editor and visible focus evidence.
- `pnpm verify` passed 114 test files and 705 tests. Production output was
  906.13 kB web JavaScript (239.50 kB gzip), 109.71 kB CSS (17.12 kB gzip),
  and 335.82 kB local-server JavaScript.
- `pnpm test:e2e` passed all 14 Chromium workflows, including the three new
  PC-078 workflows described by the issue completion evidence.
