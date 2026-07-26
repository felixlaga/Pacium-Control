# Local terminal runtime and optional tmux

## Direct PTY runtime

The local server is the terminal runtime for ordinary sessions.

Responsibilities:

- spawn explicit commands in validated working directories;
- manage PTY handles and process groups;
- stream bytes;
- apply resize;
- send interrupt and termination signals;
- observe exit;
- bound buffers;
- preserve terminal screen state across browser reconnect;
- clean up without leaking processes.

The browser never owns a PTY process.

## Session input

- One active browser input owner per session.
- Input frames are ordered and bounded.
- Reconnect does not retry uncertain input.
- Large paste is explicit and uses terminal paste semantics where supported.
- Application commands and terminal bytes are separate protocols.

## Optional tmux adapter

tmux is added after the direct PTY workspace is proven.

Capabilities:

- discover configured local tmux servers;
- list sessions explicitly;
- attach terminal I/O;
- launch a preset under tmux;
- reconnect after local-server restart;
- label capability and target clearly.

tmux attachment is never inferred from arbitrary process state and never required for ordinary use.

## Existing terminal applications

Pacium cannot adopt an arbitrary Terminal.app, iTerm, or other terminal-emulator pane. Existing sessions require an explicit shared runtime such as tmux or a future cooperative helper.

## Failure behavior

- Browser disconnect: process continues.
- WebSocket overflow: mark resync required; do not grow memory without limit.
- Direct local-server exit: direct PTY ends.
- tmux adapter loss: tmux session may continue; report disconnected.
- Signal timeout: preserve state and offer deliberate force termination.
- Unknown input outcome: do not replay.
