# PC-029: Modern host working-directory picker

## Problem

Creating a terminal currently requires typing an absolute path. That is slow, error-prone, visually dated, and especially confusing when the browser reaches Pacium remotely because a browser-native directory picker would browse the client device rather than the Pacium host.

## Outcome

The operator can browse and select an accessible directory on the Pacium host through a compact, sleek repository-oriented picker. The final canonical path remains visible and editable, and the same interaction works locally or through the accepted Tailscale Serve path.

## Scope

- Add a token-protected read-only directory-list API.
- Canonicalize the requested directory on the Pacium host.
- Return directories only, with bounded results and repository markers.
- Add breadcrumb, parent, default-location, and home navigation.
- Add client-side name filtering and a hidden-directory toggle.
- Retain a short browser-local list of recently selected directories.
- Keep typed absolute-path entry as a deliberate fallback.
- Integrate the picker into the new-terminal dialog.
- Show loading, empty, truncated, inaccessible, and retry states.

## Non-scope

- Reading or previewing file contents.
- Creating, renaming, moving, or deleting directories.
- Uploading browser-local directories.
- Persisting directory listings on the server.
- Multi-host browsing from one Pacium instance.
- Repository cloning.

## Acceptance criteria

- [x] The picker browses the Pacium host, not the browser device.
- [x] An unauthenticated, wrong-Origin, or malformed request cannot list directories.
- [x] Paths are canonicalized and non-directories fail without leaking stack traces.
- [x] Results contain directories only and are deterministically bounded and sorted.
- [x] Breadcrumb, parent, home, and default-location navigation are implemented.
- [x] Repository directories are visually distinguishable without executing repository content.
- [x] Filtering and hidden-directory visibility are controllable.
- [x] Selecting a directory updates the canonical working-directory field.
- [x] Recent selections contain only bounded directory paths and remain browser-local.
- [x] Typed absolute-path entry remains available.
- [x] Resolver, transport, HTTP boundary, and UI state logic have deterministic tests.
- [x] The full repository verification gate passes.

## User experience

The picker opens as a focused command surface above the terminal-creation dialog. A compact location rail shows Home, Pacium default, and recent directories. Breadcrumbs expose the current hierarchy. The directory list uses restrained repository indicators, keyboard-friendly rows, and concise empty/error states.

The picker never implies that a directory exists on the browser device. Copy identifies it as the Pacium host. Selecting “Use this folder” returns the canonical host path to the creation dialog.

## Architecture

- Systems and modules touched: shared API schemas, local HTTP server, directory resolver, web transport, creation dialog, picker component, CSS, tests.
- Systems of record: the host filesystem owns directory truth; browser local storage owns recent path references.
- State transitions: open, load, navigate, filter, select, confirm, retry, cancel.
- Protocol/schema impact: additive HTTP response schemas; WebSocket protocol version unchanged.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0016.

## Security and privacy

- Authorization: exact allowed Origin and ephemeral access token are required.
- Privilege: reads run with the invoking user's existing filesystem permissions.
- Secrets/logging: no file contents, environment values, tokens, or directory listings are durably logged.
- Abuse/failure scenario: oversized paths, inaccessible locations, symlink resolution, enormous directories, and stale recent paths fail or truncate deterministically.

## Reliability

- Idempotency: repeated listing has no mutation.
- Timeouts/retries: local reads expose a manual retry; no blind background loop.
- Restart behavior: recent paths may remain in browser storage but are revalidated on navigation.
- Unknown outcome: a failed listing leaves the typed path and running PTYs untouched.
- Migration/rollback: remove the additive endpoint and picker; typed path entry continues to work.

## Test plan

- Unit: canonical directory resolution, sorting, repository markers, truncation, invalid paths.
- Contract: directory response schema and bounds.
- Integration: authorized/unauthorized HTTP listing.
- Browser: open picker, navigate, filter, select, create, reopen recent path.
- Failure/recovery: inaccessible and deleted recent directories, empty directory, truncated result.
- Security: missing token, wrong token, hostile Origin, non-directory path, no file-content response.

## Dependencies

- Blocked by: initial loopback security and bootstrap token.
- Blocks: workspace configuration, Pacium repository roots, verification presets, and remote operator usability.

## Evidence required

- Resolver and HTTP integration results.
- Transport/UI state tests.
- Rendered workflow evidence when a browser backend is available.
- Full `pnpm verify`.

## Evidence

- `pnpm verify` passed on 2026-07-27: formatting, lint, type checking, 13 test files with 45 tests, and both production builds.
- The development web root and direct local-server health endpoint returned HTTP 200.
- Rendered workflow and accessibility evidence remain pending because no browser backend was available in the implementation environment.

## Open questions

- Directory creation can be considered later if real use shows that selecting existing folders is insufficient.
