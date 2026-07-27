# Implementation plan: Modern host working-directory picker

- Issue: [PC-029](directory-picker-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/directory-picker-tailnet-contract`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `aef86931a180a4a66aa08c9a6f8575a3b422f2c5`
- Target milestone: Milestone 1
- Status: Implemented and browser-validated through PC-078

## Objective

Replace raw-path-only terminal creation with a fast host-side directory picker that remains accurate through local and Tailscale-proxied browsers without adding filesystem mutation or broad shell execution.

## Existing behavior

- The new-terminal dialog contains a required absolute-path text input.
- The local server canonicalizes that path only when creating a PTY.
- The browser receives an ephemeral token during bootstrap and uses it for WebSocket access.
- No authenticated HTTP API exists beyond bootstrap.

## Proposed behavior

The browser uses the bootstrap token to request bounded directory summaries from the Pacium host. The server canonicalizes the requested location, returns child directories and repository markers, and never returns file contents. A focused picker presents navigation, filtering, hidden-directory control, and recent browser-local selections before returning the canonical path to the existing creation form.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: directory-list schemas.
- `apps/local-server`: directory resolver and protected HTTP route.
- `apps/web/src/transport.ts`: authenticated directory request.
- `apps/web`: picker state, rendering, recent paths, and styles.
- Test modules at each boundary.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: additive idempotent `GET /api/directories`.
- Idempotency: listing has no side effects.
- Migration: browser-local recent path version 1; malformed state becomes empty.

### Protocol changes

- WebSocket protocol remains version 2.
- Add bounded HTTP directory-entry and directory-list schemas.
- Bearer token uses the existing ephemeral bootstrap secret.

### Authorization and privilege

- Require loopback-safe Host, exact configured Origin, and constant-time token validation.
- Filesystem reads inherit the Pacium host user's permissions.
- Return names, canonical paths, directory/repository flags, and truncation only.

## Sequence

1. Record ADR-0016 and align active scope.
2. Add the issue and implementation plan.
3. Add shared directory-list schemas.
4. Implement and test canonical bounded directory resolution.
5. Add and test the protected HTTP route.
6. Add authenticated web transport and picker state.
7. Build the compact directory-picker UI.
8. Run browser workflow when available.
9. Run full verification and synchronize status.
10. Commit and integrate the slice.

## Failure model

| Failure point                 | Expected state                                 | Recovery                             |
| ----------------------------- | ---------------------------------------------- | ------------------------------------ |
| Token or Origin invalid       | HTTP 403; no filesystem read                   | Reconnect through Pacium             |
| Path missing or not directory | Bounded 400 response                           | Return to recent/default location    |
| Directory unreadable          | Bounded 400 response; typed path remains       | Navigate elsewhere or retry          |
| Directory has many children   | Stable capped response with truncated flag     | Filter or navigate more specifically |
| Recent path was deleted       | Error state without removing other recent rows | Remove or choose another path        |
| Browser disconnects           | Picker stops loading; PTYs survive             | Reconnect and retry                  |

## Compatibility

- Supported versions: current web application and protocol version 2.
- Fallback behavior: the absolute-path input remains fully usable.
- Rollback: remove the picker/API; no PTY or server state migration.

## Test plan

- Unit: resolver, bounds, sorting, repository detection, recent-state parsing.
- Property/fault: malformed and oversized paths never escape validation.
- Contract: response schema.
- Integration: authorized and denied HTTP requests.
- Browser: navigation, filter, hidden toggle, select, create, recent reopen.
- Security: token/Origin/Host checks happen before directory reads.
- Performance: cap entries and avoid file-content reads.

## Documentation changes

- Update status, README, backlog, changelog, and evidence.
- Preserve ADR-0016 remote-access boundaries.

## Rollout

- Development: browse the repository parent and temporary fixtures.
- Integration: isolated temporary directory tree.
- Canary: local use before Tailscale exposure.
- Production: not part of this slice.

## Open questions

- None blocking the read-only picker.

## Approval

- Product: explicitly requested by the owner.
- Architecture: host-side browsing is required for remote browser correctness.
- Security: endpoint is read-only, token-protected, Origin-bound, and bounded.

## Completion evidence

- `pnpm verify` passed on 2026-07-27 with 13 test files and 45 tests.
- The resolver, shared schema, protected HTTP route, browser transport, and picker-state boundaries are covered by deterministic tests.
- The development UI and direct `/api/health` endpoint returned HTTP 200.
- PC-078 subsequently passed three dedicated Chromium workflows for the
  rendered navigation, recovery, storage-denial, focus, responsive, zoom,
  forced-colors, and reduced-motion boundary.
