# Implementation plan: Consistent session actions

- Issue: [PC-024](session-actions-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/session-actions`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `73c01de3c34d133fdd27e2d0db7ca10f4cfe4f8a`
- Target milestone: Milestone 1
- Status: Implemented; rendered browser validation pending

## Objective

Complete routine session management through one compact action model while preserving the distinction between browser views, session metadata, signals, new process creation, and termination.

## Existing behavior

- Creation, interrupt, forced close, tab close, and pane close exist.
- Session summaries retain preset, cwd, dimensions, display name, state, and canonical repository context.
- No rename or host reveal protocol exists.
- Duplicate and relaunch can reuse the typed create operation without adding arbitrary command input.

## Proposed behavior

Add typed `session.rename` and `session.revealRepository` commands. Rename mutates only the server-owned display name. Reveal resolves no browser input: it uses the canonical repository root already associated with the session and a fixed platform adapter.

The browser derives deterministic action availability from the session state. Duplicate creates a new session with a distinct name. Relaunch creates a successor only when the prior PTY is no longer live. A shared action menu makes all consequences explicit.

## Architecture and boundaries

- Contracts: additive rename/reveal commands and protocol-version update.
- Server: session-manager metadata mutation and injected host reveal capability.
- Browser transport: typed rename/reveal methods.
- Browser model: action availability and duplicate naming.
- UI: action menu, rename dialog, pane and context entry points.
- State: no new durable state.

## Sequence

1. Add issue and plan.
2. Add protocol commands and contract tests.
3. Add session-manager rename/reveal behavior and tests.
4. Add fixed host reveal adapter and platform tests.
5. Add browser action model and tests.
6. Add transport methods.
7. Add shared menu and rename dialog.
8. Wire header, pane, and sidebar context entry points.
9. Run browser validation when available.
10. Run full verification, synchronize evidence, merge, and push.

## Failure model

| Failure point                 | Expected state                                       | Recovery                                    |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Rename target missing         | Typed not-found error; old name survives             | Refresh sessions                            |
| Rename value invalid          | Protocol error before mutation                       | Retain and edit dialog value                |
| Reveal has no repository      | Typed no-repository error                            | Copy cwd instead                            |
| Host reveal executable fails  | Typed retryable host-action error                    | Copy path and open manually on the host     |
| Duplicate spawn fails         | Source session and view remain unchanged             | Retry with the retained launch fields       |
| Relaunch source is still live | Action disabled; server receives no destructive call | Use Duplicate or explicitly terminate first |
| Clipboard denied              | Path remains visible; bounded notice                 | Select/copy from inspector                  |
| Browser refresh during menu   | Menu closes; PTY state is unchanged                  | Reopen actions                              |

## Compatibility

- Browser and server protocol advance together.
- Older browser/server pairs fail at the existing version handshake.
- Rollback removes additive commands and menu entries without session-state migration.

## Security

- Rename is bounded metadata only.
- Reveal accepts a session ID, not a path.
- Canonical repository roots come from server discovery.
- Fixed `open`/`xdg-open` argument arrays are spawned without a shell.
- Duplicate/relaunch reuse fixed server-owned presets and do not replay environment dumps.

## Verification

- Focused unit, contract, manager, adapter, and component tests.
- Existing PTY and reconnect suites.
- Full format, lint, type, test, and build gate.
- Runtime health smoke.
- Rendered interaction evidence when a browser backend is available.

## Result

- Protocol version 3 adds strict `session.rename` and `session.revealRepository` commands.
- The server owns rename state and resolves reveal targets only from canonical repository metadata.
- The host adapter launches a fixed platform executable and argument array without a shell.
- One shared browser action model and menu now serves the header, pane headers, sidebar rows, and tabs.
- Duplicate and ended-session relaunch create new PTYs without mutating the source session.
- `pnpm verify` passed on 2026-07-27 with 18 test files and 70 tests.
- Both loopback development services passed direct HTTP smoke checks.
- Rendered pointer, keyboard, dialog-focus, and accessibility validation remains open because no browser backend was available.
