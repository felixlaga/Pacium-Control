# Observability

## Objective

Help the operator understand sessions and help maintainers diagnose the local application without creating a secret-bearing transcript system.

## Product observability

- live/ended process state;
- attention state with source and freshness;
- unread meaningful activity;
- repository and Git changes;
- verification result;
- queue item and decision lifecycle;
- provider observer health.

## Platform health

Components:

- local server;
- browser transport;
- PTY runtime;
- terminal buffers;
- Git inspector;
- Claude observer;
- Codex observer;
- queue watcher;
- optional tmux adapter;
- local state.

Each reports:

```text
healthy | degraded | unavailable | unknown
since
summary
operatorAction
```

## Logging

Useful fields:

- timestamp;
- level;
- module;
- request/session ID;
- event type;
- duration;
- bounded result/error code.

Do not log raw terminal bytes, password input, full prompts, complete environment data, provider tokens, or unrestricted queue contents by default.

## Metrics

Initial local metrics:

- active PTYs;
- PTY create/exit failures;
- WebSocket reconnects and buffer overflow;
- output/input throughput;
- terminal buffer size;
- event-loop delay;
- CPU, memory, and file descriptors;
- Git inspection latency/errors;
- queue parse/delivery conflicts;
- provider observer failures.

Metrics remain local until a future remote-observability design is approved.

## Diagnostics

An explicit diagnostics screen or export may include:

- application and dependency versions;
- platform and PTY capability;
- session metadata without terminal contents;
- component health;
- recent bounded error codes;
- queue source metadata without secrets;
- optional tmux capability;
- redaction manifest.

The operator previews export contents before saving.
