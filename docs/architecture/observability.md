# Observability

## Objective

Operators need visibility into both agent work and the health of Pacium Control itself. Product activity and platform telemetry are related but distinct.

## Three layers

### Domain observability

What users care about:

- run/task state;
- questions and approvals;
- decisions and acknowledgement;
- agent state and freshness;
- Git changes and checks;
- provider usage;
- host/session lifecycle.

This is stored as domain entities and events.

### Platform telemetry

What maintainers need:

- request latency and errors;
- state command latency;
- journal recovery counts;
- event stream lag;
- broker operation latency;
- terminal connections and buffer pressure;
- host-agent reconnects;
- adapter parse failures;
- disk usage;
- backup age;
- process CPU/memory/file descriptors.

### Diagnostics

Bounded, detailed material for debugging:

- version/capability reports;
- recent protocol errors;
- redacted provider payload samples;
- broker/tmux command traces under debug mode;
- state integrity reports;
- support bundle manifest.

Diagnostics may be sensitive and require owner access.

## Health model

Avoid one binary health light. Expose components:

- web/API;
- state coordinator;
- state directory integrity;
- broker;
- tmux server(s);
- each provider adapter;
- each host agent;
- backup;
- event streaming;
- disk capacity.

Each component reports:

```text
status: healthy | degraded | unavailable | unknown
since
lastCheck
summary
operatorAction
```

## Logging

Structured logs include correlation IDs and avoid raw secrets.

Recommended fields:

- timestamp;
- level;
- service/module;
- request/command/operation IDs;
- workspace/repository/run/session references;
- actor type and safe identifier;
- event name;
- duration;
- result/error code.

Do not log every terminal byte, complete prompt, environment variable, or provider credential payload by default.

## Metrics

Initial internal metrics:

- HTTP request rate/error/latency;
- state command rate/conflict/error/latency;
- event append latency;
- event-stream subscriber count and lag;
- broker request latency and failures;
- active terminal streams and write leases;
- tmux sessions by state;
- provider adapter health;
- host-agent heartbeat age;
- disk and backup age;
- question answer and acknowledgement latency.

Metrics can initially be exposed locally or through standard telemetry. Do not add a large monitoring stack before it is operationally justified.

## Tracing

Use correlation IDs across:

```text
browser action
→ API request
→ state command
→ broker/host operation
→ provider or tmux observation
→ committed event
→ browser update
```

Full distributed tracing may come later; the ID chain should exist from the beginning.

## Support bundle

An owner can generate a redacted diagnostics bundle containing:

- versions and capabilities;
- configuration shape without secrets;
- recent health transitions;
- state integrity report;
- journal status;
- recent error codes;
- backup status;
- selected redacted logs;
- no provider tokens or unrestricted terminal history.

The bundle manifest should list every included file.

## Alerts

Alert only on actionable platform conditions:

- state writes blocked;
- disk nearly full;
- broker unavailable beyond grace;
- host disconnected beyond policy;
- backup overdue or failed;
- repeated adapter parse failures;
- unauthorized terminal attempts;
- provider authentication expired;
- event delivery backlog growing.

Product notifications and maintainer alerts should not be conflated.
