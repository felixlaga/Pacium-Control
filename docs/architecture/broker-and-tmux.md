# Broker and tmux

## Purpose

The broker translates authorized Pacium operations into controlled interactions with tmux, PTYs, Git, and provider CLI processes. It exists because the web/API process must not hold direct access to tmux sockets or arbitrary host execution.

## Security posture

A tmux socket is a high-privilege capability. Anyone who controls it can generally inspect and manipulate all sessions on that server.

Therefore:

- run Pacium-managed sessions under a dedicated Unix identity or tmux server where practical;
- run the broker as a dedicated non-root user;
- authenticate and authorize every caller;
- expose a typed allowlist, not arbitrary shell execution;
- log structured operations, not every secret-bearing byte;
- validate roots, IDs, and paths independently of the web layer.

## tmux control mode

Use tmux control mode for machine-readable session discovery and asynchronous notifications.

Expected uses:

- list sessions, windows, and panes;
- observe create, rename, select, and close events;
- receive pane output notifications where appropriate;
- track attached clients;
- correlate Pacium IDs stored in tmux user options;
- issue constrained tmux commands.

The adapter should tolerate tmux version differences and retain a capability report.

## Stable identity

tmux names are mutable display attributes, not primary keys.

Pacium assigns an immutable `AgentSession` ID and may mirror metadata through user options such as:

```text
@pacium.id
@pacium.workspace
@pacium.repo
@pacium.run
@pacium.role
@pacium.provider
@pacium.owner
```

Unknown sessions are identified by host, tmux server, and stable target information available at discovery time, then classified by a user or launch manifest.

## Canonical session names

Underlying tmux names should be deterministic and shell-safe:

```text
pacium__checkout-api__orchestrator__claude__r24
pacium__web__worker-02__codex__r24
```

Display names remain human-oriented and may change without breaking identity.

## PTY terminal attachment

The broker attaches a PTY-compatible stream to the selected tmux pane/session and exposes it through an authenticated terminal transport.

Requirements:

- correct terminal dimensions and resize propagation;
- bounded output buffers;
- reconnect behavior;
- read-only observation independent of write control;
- terminal process exit detection;
- no assumption that browser connection lifetime equals session lifetime;
- strict separation between terminal bytes and application event data.

## Input arbitration

There are at least three input sources:

1. the current human terminal controller;
2. structured prompts from Pacium;
3. provider adapter control messages.

The broker serializes writes per pane. Structured prompt delivery must not interleave with human paste or another system prompt.

A queue entry records:

- operation ID;
- source;
- target;
- payload hash;
- enqueue time;
- lease/policy context;
- delivery attempt and result.

## Prompt delivery

Do not construct fragile shell-quoted `send-keys` commands from arbitrary user text.

Preferred properties:

- literal bytes or tmux buffer mechanism;
- explicit newline behavior;
- multiline support;
- maximum size policy;
- payload hashing;
- optional provider-aware submission;
- observation/acknowledgement when possible;
- idempotent state outside tmux.

The broker cannot always prove semantic acceptance from terminal bytes alone. Delivery and acknowledgement remain separate states.

## Launch profiles

A launch profile defines an approved way to create a session:

- Unix execution identity;
- host;
- repository and worktree;
- working directory;
- environment allowlist;
- provider CLI and arguments;
- tmux server/session/window layout;
- hook/status configuration;
- resource limits where supported;
- run/session metadata.

Launch profiles are typed configuration, not arbitrary commands supplied by the browser.

## Process controls

Supported controls may include:

- send interrupt;
- request graceful stop;
- terminate pane/session;
- restart from manifest;
- detach clients;
- rename or reclassify;
- pause new prompt delivery.

Destructive operations require stronger authorization and explicit UI consequences.

## Git operations

Broker Git operations are rooted in registered repositories and worktree directories. Paths are canonicalized and checked against allowlists.

Initial allowlisted actions:

- inspect repository identity/status;
- resolve current branch and commit;
- list changed files and diff stats;
- create worktree from approved base;
- remove safe worktree;
- run configured verification commands;
- collect commits and patch evidence.

Merge, rebase, push, and pull-request actions require explicit policy and separate review.

## Broker protocol

Protocol properties:

- local Unix socket on the primary host;
- authenticated host channel for remote brokers;
- version handshake and capability negotiation;
- typed requests and responses;
- request IDs and deadlines;
- bounded payload sizes;
- streaming channels for terminal and observations;
- explicit error codes;
- no implicit trust of the caller’s authorization claim;
- audit correlation IDs.

## Failure behavior

- Broker restart: tmux sessions continue; broker rediscovers and reconciles.
- tmux server unavailable: associated sessions become disconnected; state remains.
- terminal client disconnect: lease expires or enters short grace; session continues.
- input delivery uncertainty: mark unknown and require operator review; do not blindly retry.
- Git command timeout: preserve worktree and capture bounded diagnostics.
- version mismatch: disable unsupported operations and expose degraded capability.
