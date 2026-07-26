# Reliability and recovery

## Objective

Keep terminal behavior predictable across browser failure, surface process loss honestly, and avoid corrupting local metadata or queue files.

## Failure domains

### Browser

- PTYs continue.
- Browser reconnects using protocol and session epochs.
- Bounded terminal state restores visible context.
- Uncertain input is not replayed.

### WebSocket

- PTYs continue.
- Slow-client buffers stay bounded.
- Overflow produces an explicit resync state.
- Duplicate connections do not duplicate input ownership.

### Local server

- Direct PTYs end when their owner process exits.
- Optional tmux-backed sessions may continue.
- On restart, the UI distinguishes ended direct sessions from rediscovered tmux sessions.
- Relaunch creates a new process attempt with clear lineage.

### PTY child process

- Exit code or signal is recorded in current process memory and activity metadata where safe.
- Scrollback remains visible until the session is closed.
- Cleanup targets the correct process group.
- Force termination is deliberate.

### Git inspector

- Terminal remains usable.
- Inspector reports bounded error and retry.
- No cached result is shown as current without freshness.

### Queue adapter

- Parse failure never executes or rewrites input.
- Ambiguous edits create conflict.
- Decision delivery uses stable identity and no blind retry.
- Original queue files remain recoverable.

### Local state

- Atomic replacement preserves prior valid files.
- Invalid optional caches are disposable.
- Invalid configuration fails visibly.
- Provider credentials and repositories remain outside Pacium state.

## Reconnect invariants

- Browser connection ID is not terminal session ID.
- PTY session epoch changes only when the process instance changes.
- Client snapshot version identifies the visible state restored.
- New output after snapshot is ordered.
- Terminal input has no automatic retry.

## Relaunch manifest

May include:

- launch preset;
- cwd;
- workspace/repository reference;
- agent classification;
- safe environment-key allowlist;
- optional provider resume reference;
- runtime kind.

It never includes provider tokens, password input, or a complete environment.

## Required drills

- refresh with active shell;
- browser crash;
- WebSocket loss during output;
- slow client and overflow;
- local-server exit with direct PTY;
- local-server restart with optional tmux session;
- interrupt and force termination;
- corrupt local JSON;
- queue rewrite and competing answer;
- Git command timeout;
- repeated create/close leak test.
