# Testing strategy

## Philosophy

Pacium owns interactive local processes. Testing must cover byte ordering, process lifecycle, browser reconnect, focus, terminal compatibility, bounded memory, Git truth, queue conflict, and the localhost security boundary.

## Unit tests

- session and connection state reducers;
- attention source/confidence/freshness;
- protocol validation;
- configuration and path validation;
- command-palette ranking;
- queue parsing and identity;
- Git output normalization;
- buffer and retention policies.

## Contract tests

- browser/local-server handshake;
- protocol version mismatch;
- create/attach/input/resize/interrupt/close messages;
- terminal stream framing and bounds;
- typed errors;
- reconnect epochs and snapshots;
- agent observer events;
- queue decision delivery.

## PTY integration tests

Use real PTYs on supported platforms:

- shell launch;
- stdin/stdout/stderr behavior;
- resize;
- Unicode and IME-relevant byte sequences;
- alternate screen;
- mouse mode;
- bracketed paste;
- signals and process groups;
- normal and abnormal exit;
- child process cleanup;
- high output and backpressure.

## Browser tests

- create terminal;
- terminal focus and escape chord;
- input and resize;
- refresh and reconnect;
- tabs and splits;
- session switching and unread state;
- keyboard-only operation;
- inspector selection without focus theft;
- Git diff;
- Pacium toggle and queue answer;
- terminal security fixtures.

## Git fixture tests

- clean, modified, staged, untracked, conflicted, detached, renamed, deleted, binary, large, and non-repository states;
- command timeout and bounded output;
- verification result tied to observed commit/worktree state.

## Queue tests

- partial writes;
- debounce/stability;
- truncation and reorder;
- duplicate content;
- same content in different sources;
- competing answers;
- ambiguous question/approval;
- delivery unknown;
- restart deduplication;
- source content treated only as data.

## Security tests

- non-loopback bind rejection;
- hostile or missing Origin;
- missing/invalid local token;
- oversized WebSocket messages;
- terminal title, OSC, hyperlink, clipboard, and HTML injection;
- path traversal and symlink behavior;
- environment and log secret scans;
- queue command injection;
- duplicate input ownership.

## Recovery tests

- browser refresh;
- browser crash;
- WebSocket disconnect during input/output;
- slow client and buffer overflow;
- local-server exit;
- direct PTY ended state;
- optional tmux reconnect;
- corrupt JSON;
- Git inspector failure;
- provider observer failure.

## Performance and soak

- interactive input latency;
- sustained large output;
- twenty idle terminals;
- several active terminals;
- repeated create/close cycles;
- repeated reconnect;
- split-pane resize churn;
- long-running agent sessions;
- memory, CPU, and file-descriptor bounds.

Set budgets from intended personal workload and record them in milestone evidence.

## Determinism

Control clock, IDs, protocol sequence, fake PTY output, repository fixtures, queue content, and provider events. Avoid arbitrary sleeps; wait for observable states with deadlines.

## Release gates

- clean install;
- format, lint, strict type, unit and contract tests;
- real PTY integration;
- browser critical workflows;
- security tests;
- production build;
- soak baseline;
- documentation and status validation;
- known limitations.
