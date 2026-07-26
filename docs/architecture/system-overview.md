# System overview

## Components

### Browser application

- React application shell;
- xterm terminal rendering;
- sessions sidebar, tabs, and splits;
- contextual inspector;
- command palette and keyboard model;
- Git, activity, and Pacium queue presentation.

### Local server

- loopback HTTP and WebSocket server;
- terminal session registry;
- PTY runtime;
- bounded headless terminal state;
- Git inspector;
- agent observers;
- Pacium queue adapter;
- minimal state store.

### External systems

- shell and operating-system processes;
- Claude Code and Codex CLI/runtime interfaces;
- Git repositories;
- optional tmux;
- existing Pacium queue files.

## Startup

1. `pacium` validates loopback configuration and local data directory.
2. Local server starts runtime services.
3. Browser opens with a local access token delivered through the approved launch path.
4. Browser performs a versioned capability handshake.
5. Server reports live sessions and bounded restoration state.
6. Browser restores workspace layout.

## Terminal flow

```mermaid
sequenceDiagram
    participant U as Operator
    participant B as Browser
    participant S as Local server
    participant P as PTY

    U->>B: Create terminal
    B->>S: session.create
    S->>P: Spawn preset in cwd
    P-->>S: Output bytes
    S-->>B: terminal.data
    U->>B: Type / resize
    B->>S: terminal.input / resize
    S->>P: Write / resize
```

## Reconnect flow

```mermaid
sequenceDiagram
    participant P as PTY
    participant S as Local server
    participant B as Browser

    B-xS: Browser disconnects
    P-->>S: PTY continues
    B->>S: Reconnect + known session epochs
    S-->>B: Live sessions + bounded snapshots
    B->>S: Attach
    S-->>B: New output only
```

## Process boundaries

There is one local application process initially. A separate broker is not used. The local server has the same operating-system authority as the invoking user and must remain loopback-only.

Remote access changes this boundary and requires a new ADR.
