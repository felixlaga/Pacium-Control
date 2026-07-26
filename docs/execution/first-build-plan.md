# Implementation plan: First real local terminal

- Issue: [PC-001/PC-004/PC-011/PC-014/PC-015](first-build-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `main` (current assigned checkout; Git commands blocked by the unaccepted Xcode license)
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `bfc6fd74240186bdf873a43a01a0158ba22d1b9b`
- Target milestone: Milestone 0 and first Milestone 1 slice
- Status: Implemented locally; clean Node.js 24 and browser validation pending

## Objective

Prove the application’s central technical and product loop with one real local PTY rendered in the final shell.

## Existing behavior

The repository began this plan without product code. The current checkout now contains the planned monorepo, frontend, local server, direct-PTY runtime, shared transport contracts, and initial test suite.

## Proposed behavior

The operator runs the documented development command, opens the localhost app, creates a shell terminal in a chosen working directory, uses it interactively, refreshes the browser, reconnects to the still-running PTY, and closes it safely.

## Architecture and boundaries

### Modules

```text
apps/web
  application shell
  terminal route
  local transport client

apps/local-server
  loopback HTTP/WebSocket startup
  terminal session service
  PTY adapter
  local access-token validation

packages/contracts
  protocol schemas and types

packages/terminal-ui
  xterm lifecycle and focus integration

packages/test-utils
  fake PTY, deterministic clock/IDs, browser helpers
```

### State

- In-memory terminal-session registry.
- Bounded headless terminal state per live session.
- No durable session restoration in this slice.
- No database or generalized event store.

### Protocol

Initial messages:

```text
server.welcome
session.create
session.created
terminal.attach
terminal.snapshot
terminal.data
terminal.input
terminal.resize
terminal.interrupt
session.exited
session.close
error
```

Every application message has a protocol version, request or event identity, bounded payload, and typed error behavior. Raw terminal data uses a dedicated frame/channel.

### Authorization and privilege

- Listen on loopback only.
- Validate allowed browser Origin.
- Require a local access token for WebSocket and mutation requests.
- Run the PTY as the invoking user.
- Validate working directory existence and type.
- Do not inherit or persist an unbounded environment dump.

## Sequence

1. Record the base commit and verify the approved toolchain prerequisites.
2. Create monorepo packages and shared commands.
3. Add CI and deterministic fixtures.
4. Define shared protocol schemas and contract tests.
5. Start loopback HTTP/WebSocket server with welcome/capability handshake.
6. Build the final-form three-panel application shell with minimal tokens.
7. Implement PTY create, output, input, resize, interrupt, exit, and cleanup.
8. Integrate xterm and focus-safe keyboard behavior.
9. Decouple PTY ownership from browser connections.
10. Add bounded headless state and reconnect handshake.
11. Complete failure, security, browser, and PTY integration tests.
12. Record evidence and update status without claiming later milestone behavior.

## Failure model

| Failure point           | Expected state                      | Recovery                                               |
| ----------------------- | ----------------------------------- | ------------------------------------------------------ |
| Invalid cwd             | No PTY created                      | Typed error; retain form values                        |
| PTY spawn failure       | Session marked failed               | Show bounded diagnostics; allow retry                  |
| WebSocket disconnect    | PTY remains live                    | Reconnect and restore bounded screen                   |
| Slow browser            | PTY remains live; buffer bounded    | Drop/resync according to explicit overflow state       |
| Input outcome uncertain | No automatic replay                 | Resume from new input only                             |
| PTY exits               | Exit code/signal recorded in memory | Keep terminal visible; allow relaunch or close         |
| Browser closes          | PTY remains live                    | Reopen app and attach                                  |
| Local server exits      | Direct PTY ends                     | Report limitation; durable restart is later tmux scope |
| Close cleanup times out | Session enters closing/failed       | Offer explicit force termination                       |

## Compatibility

- Supported platforms: decide before implementation.
- Supported browsers: current evergreen browser baseline.
- Fallback: clear unsupported-platform or PTY-startup error; no fake terminal.
- Rollback: remove the code slice without application-state migration because no durable product state exists yet.

## Test plan

- Unit: configuration, state reducer, path validation, frame limits, error mapping.
- Property: random valid/invalid message sequences never cross session identities.
- Contract: version mismatch, malformed messages, ordering, reconnect epoch, bounded terminal frames.
- Integration: real PTY shell, input/output, resize, Unicode, alternate screen, interrupt, exit, cleanup.
- Browser: create, focus, input, refresh, reconnect, resize, exit, close.
- Security: loopback, Origin, token, path, terminal title/link/OSC/clipboard fixtures.
- Performance: sustained output and bounded buffer measurement.

## Documentation changes

- Update `STATUS.md` only with verified behavior.
- Add supported development commands.
- Record PTY and browser support.
- Record direct-PTY server-restart limitation.
- Add a short architecture diagram if implementation changes the planned boundary.

## Rollout

- Development: real local shell under an isolated temporary directory.
- Integration: run the full slice on the supported platform matrix.
- Canary: personal non-sensitive repository and shell workflow.
- Release: not part of this slice.

## Implementation decisions

- Use [the approved initial toolchain and platform](toolchain-and-platform.md).
- Treat the headless restoration approach as a bounded implementation spike within this slice.

## Approval

- Product: Direction approved; first-slice UX requires review.
- Architecture: Initial stack approved in [toolchain-and-platform.md](toolchain-and-platform.md); real PTY and reconnect behavior demonstrated on the current machine, pinned Node.js 24 still pending.
- Security: Loopback, Origin, token, path, schema, and message bounds implemented; terminal-content and browser review pending.

## Evidence from the current checkout

Recorded 2026-07-26:

- `pnpm typecheck`: passed across six workspace projects.
- `pnpm lint`: passed.
- `pnpm test`: 6 files and 17 tests passed.
- Real PTY integration: `/bin/zsh` emitted the expected marker and exited normally.
- Transport reconnect integration: a PTY remained registered after the first WebSocket disconnected and returned its snapshot to a second connection.
- `pnpm build`: Vite web bundle and tsup server bundle completed.
- `pnpm dev`: Vite and the source server started together; the UI and proxied health route returned 200.
- Built server: started on `127.0.0.1:4174`; health returned 200 and a hostile bootstrap Origin returned 403.

Still required:

- repeat install and all gates on pinned Node.js `24.18.x`;
- browser create, focus, input, resize, refresh, reconnect, exit, and close evidence;
- terminal escape/link/clipboard, sustained-output, overflow, and accessibility cases;
- `git diff --check` after the machine’s Xcode license is accepted.

The current xterm snapshot implementation uses proposed headless buffer APIs. That dependency is accepted for the spike only and is a review point before the first release.
