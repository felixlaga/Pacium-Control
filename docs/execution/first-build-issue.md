# PC-001/PC-004/PC-011/PC-014/PC-015: First real local terminal

## Problem

The repository contains no executable application. The product direction cannot be validated until a browser can operate one real local PTY safely.

## Outcome

From a clean clone, the operator starts the development application, creates one shell terminal in an explicit working directory, interacts with it in the browser, refreshes the page without killing the process, reconnects, and closes it safely.

## Scope

- Establish the minimum monorepo packages required by the slice.
- Pin the initial toolchain.
- Create the local HTTP/WebSocket server bound to loopback.
- Define the minimum versioned session and terminal contracts.
- Launch one PTY.
- Render it with xterm.
- Support ordered input, output, resize, interrupt, exit, reconnect, and close.
- Retain bounded visible terminal state across browser refresh.
- Add the application shell and minimal Linear-inspired tokens needed for the real screen.
- Add deterministic tests and documented commands.

## Non-scope

- Multiple simultaneous sessions in the UI.
- Splits.
- Git inspection.
- Agent status.
- Pacium mode.
- tmux.
- packaging.
- remote access.

## Acceptance criteria

- [ ] A clean clone installs and runs with documented commands.
- [ ] The server binds only to `127.0.0.1`.
- [ ] The browser creates a PTY in an explicit validated directory.
- [ ] Input and output work for an interactive shell.
- [ ] Resize reaches the PTY.
- [ ] Interrupt targets the correct process group.
- [ ] Browser refresh does not terminate the PTY.
- [ ] Reconnect restores bounded visible state without replaying input.
- [ ] Normal exit and forced close are visually distinct.
- [ ] Terminal output cannot inject application HTML.
- [ ] Buffer and WebSocket message sizes are bounded.
- [ ] Unit, contract, PTY integration, browser, and security tests pass.
- [ ] Documentation records supported platform and limitations.

## User experience

The initial screen uses the final application hierarchy:

- subdued session sidebar;
- dominant terminal canvas;
- optional collapsed context panel;
- compact top bar;
- visible connection/process status;
- deliberate close action;
- clear empty, creating, live, reconnecting, exited, and failed states.

Terminal focus is obvious. Application shortcuts do not leak into terminal input. A documented escape chord returns focus to the application.

## Architecture

- Systems and modules touched: web, local server, contracts, terminal UI, test utilities.
- Systems of record: PTY process for live session; bounded headless terminal state for reconnect presentation.
- State transitions: creating → live → reconnecting or exited → closed.
- Protocol impact: initial versioned welcome, create, attach, data, resize, interrupt, exit, and close messages.
- Relevant ADRs: ADR-0001, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Validate loopback binding, Origin, local token, working directory, and message bounds.
- Treat terminal output, titles, links, OSC, and clipboard operations as untrusted.
- Do not log terminal bytes or complete environments.
- Run child processes with the invoking user’s privileges.

## Reliability

- Browser connections do not own PTYs.
- Reconnect uses a session epoch and bounded screen snapshot.
- Input has no automatic retry after uncertain delivery.
- Server exit ends the direct PTY and is documented honestly.
- Cleanup targets the session process group and is tested.

## Test plan

- Unit: state transitions, configuration, path and message validation.
- Contract: protocol version, malformed messages, ordering, and bounds.
- Integration: PTY input/output, resize, interrupt, exit, process-group cleanup, Unicode, alternate screen.
- Browser: create, focus, type, resize, refresh, reconnect, exit, close.
- Failure/recovery: WebSocket loss, slow client, PTY spawn failure, browser refresh, server exit.
- Security: Origin, token, non-loopback bind, terminal injection, path validation.

## Dependencies

- Blocked by: accepting the Xcode license and confirming the native build prerequisite on the development machine.
- Blocks: all later terminal, agent, Git, and Pacium work.

## Evidence required

- exact clean-install and verification commands;
- browser recording of the full slice;
- PTY integration results;
- reconnect/duplicate-input result;
- loopback and Origin test result;
- memory/buffer limit measurement;
- known limitations.

## Implementation decisions

- Use [the approved initial toolchain and platform](toolchain-and-platform.md).
- Validate the selected headless terminal restoration approach inside this slice.
