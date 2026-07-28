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

PC-073 implements one operator-invoked, response-only version-1 diagnostics
snapshot. The protected `/api/diagnostics` read projects already loaded
application state; it performs no refresh, filesystem read, provider probe,
terminal operation, command, durable write, upload, or background poll.

The screen and exact preview include:

- application and dependency versions;
- platform and PTY capability;
- session metadata without terminal contents;
- component health;
- recent bounded error codes;
- queue source metadata without secrets;
- optional tmux capability;
- redaction manifest.

Session identities are export-local labels. Queue and provider evidence is
aggregate or fixed-code metadata rather than raw content. The structural
allowlist omits terminal input/output/titles, source identities, PIDs, argv,
paths, Git content, queue contents/decisions, provider content/fields,
environments/credentials, host/operator identity, and relaunch metadata.

The operator must preview the exact inert JSON before the browser-local
download is enabled. Pacium does not create or retain a server-side support
file. A failed explicit refresh keeps the prior snapshot visibly stale.
