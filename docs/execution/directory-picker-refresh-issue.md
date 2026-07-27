# PC-078: Refresh the host working-directory picker

## Problem

PC-029 added a secure host-side directory browser, but its completion evidence
never exercised the real rendered workflow. The current interaction also has
four concrete recovery and speed gaps:

- an invalid initial typed path leaves the picker without a working default
  recovery action;
- browser-local recent-path reads or writes can throw and break opening or
  selecting a folder;
- navigating directly to a known absolute host path requires leaving the
  picker and editing the parent dialog;
- keyboard use is limited to generic Tab order even though directory browsing
  is a frequent launch action.

The picker must be refreshed without widening its read-only filesystem or
remote-access authority.

## Outcome

The operator can open a compact, Linear-inspired host folder surface, browse or
jump directly to a canonical absolute path, recover from stale or invalid
locations, and complete the workflow quickly by keyboard or pointer. Selection
updates only the parent terminal form; no terminal is launched until that form
is submitted.

## Scope

- Preserve the existing token-protected host directory endpoint and bounded
  directory-only response.
- Add an in-picker absolute host-path editor with deliberate navigation.
- Add documented keyboard behavior for path focus, result navigation, current
  folder confirmation, and modal exit.
- Make browser-local recent-path reads and writes fail soft.
- Make the server default location a real recovery path even when the initial
  listing never succeeds.
- Tighten accessible names, current-location evidence, loading/error copy, and
  narrow-layout behavior.
- Add rendered browser coverage for navigation, filtering, path jump,
  selection, recent reuse, recovery, focus, and responsive states.
- Synchronize the original PC-029 evidence and active status after completion.

## Non-scope

- Creating, renaming, moving, deleting, uploading, or previewing files or
  directories.
- Server-persisted favorites, directory caches, or search indexes.
- Recursive filesystem search.
- Browser-device folder access.
- Repository cloning or workspace-configuration editing.
- A generic filesystem API or remote shell endpoint.
- Changing Tailscale Serve configuration, grants, or identity semantics.

## Acceptance criteria

- [ ] The picker still browses only directories on the Pacium host.
- [ ] Local access uses the existing loopback Origin/token boundary and remote
      access uses the implemented exact Serve Origin/identity/token boundary.
- [ ] `Cmd/Ctrl+L` exposes and focuses a bounded absolute host-path editor;
      Enter requests that location and Escape returns to directory browsing.
- [ ] Invalid direct paths show a bounded error while Pacium default, known
      Home, valid recents, Back, and Retry remain honest recovery actions.
- [ ] Pacium default works even if the first requested path is invalid.
- [ ] Storage denial or quota failure cannot prevent the picker from opening or
      returning a selected canonical path.
- [ ] Arrow-key movement between visible directory rows and deliberate current
      folder confirmation are keyboard accessible without stealing terminal
      input outside the modal.
- [ ] Loading, empty, filtered-empty, truncated, inaccessible, disconnected,
      and successful states explain what happened and that running PTYs survive.
- [ ] The current canonical host path, repository markers, hidden-directory
      control, breadcrumbs, and typed-path fallback remain present.
- [ ] Desktop, 320 CSS px, 200% zoom, forced-colors, and reduced-motion browser
      evidence passes.
- [ ] Unit, semantic-render, transport/security, and full repository gates pass.

## User experience

The picker remains a focused layer over the new-terminal form. Navigation and
inactive chrome recede; the directory list and current host location receive
the strongest contrast.

The toolbar has parent navigation, breadcrumbs, and one explicit path-edit
action. `Cmd/Ctrl+L` opens the same action without creating a hidden shortcut.
Enter in the path editor navigates; it never launches a terminal. Folder rows
open on activation. `Cmd/Ctrl+Enter` confirms the currently displayed canonical
folder. Escape first exits path editing when applicable, otherwise it returns
to the new-terminal form with focus restored to Browse.

Errors preserve the typed host path, state that existing terminals are
unaffected, and keep safe recovery locations available. Recent paths remain
browser-local hints and are revalidated by the host whenever chosen.

## Architecture

- Systems and modules touched: directory-picker model/component/styles,
  terminal-creation integration, semantic tests, Playwright tests, active
  execution documentation.
- Systems of record: the host filesystem remains directory truth; the server
  owns canonical listing responses; browser storage owns only bounded recent
  path references.
- State transitions: open, load, browse, edit path, navigate, filter, recover,
  confirm, cancel.
- Protocol/schema impact: none expected; protocol 18 and the existing
  `/api/directories` contract remain authoritative.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0016.

## Security and privacy

- Authorization: retain exact request classification and ephemeral token
  checks before any directory read.
- Privilege: filesystem reads continue with only the invoking user's existing
  permissions.
- Secrets/logging: no file contents, environments, tokens, or directory
  listings are persisted or intentionally logged.
- Abuse/failure scenario: bounded absolute paths, stale recents, inaccessible
  locations, symlinks, enormous directories, storage exceptions, late
  responses, and disconnects fail without filesystem mutation or PTY impact.

## Reliability

- Idempotency: every directory request remains read-only.
- Timeouts/retries: no background retry; the operator chooses Retry or another
  location.
- Restart behavior: recents may survive in browser storage but are always
  revalidated; direct PTYs follow the existing server lifecycle.
- Unknown outcome: a failed listing never changes the parent working-directory
  field or launches a process.
- Migration/rollback: no durable server migration; the original absolute-path
  field remains the fallback if the refreshed picker is removed.

## Test plan

- Unit: recent storage failure, bounded recent ordering, breadcrumbs, keyboard
  action resolution, and path-editor transitions.
- Contract: retain existing strict directory-list schema coverage.
- Integration: retain local and remote authorized/denied HTTP coverage.
- Browser: path edit, parent/folder navigation, filtering, selection, recent
  reuse, invalid-path recovery, focus return, and no premature process launch.
- Failure/recovery: first-load invalid path, stale recent, storage exception,
  disconnected request, empty/truncated states.
- Security: no new request fields or endpoint authority; exact local/Serve
  transport tests remain green.

## Dependencies

- Blocked by: PC-029 and PC-077, both implemented.
- Blocks: provider observer work and packaging confidence because launch setup
  is the first daily-use interaction.

## Evidence required

- Before/after rendered screenshots.
- Focused unit and component results.
- Exact Playwright workflow results at desktop and narrow viewports.
- Full `pnpm verify` and `pnpm test:e2e`.
- Documentation that distinguishes implemented application behavior from
  manual accessibility and real-tailnet evidence.

## Open questions

- Directory favorites and server-owned workspace roots remain later
  configuration work unless daily use proves browser-local recents insufficient.
