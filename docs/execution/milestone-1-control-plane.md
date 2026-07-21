# Milestone 1 — Secure tmux control plane

## Goal

Observe and safely control real tmux sessions on one host through a tailnet-authenticated web application.

## Scope

### Broker

- local Unix-socket RPC;
- version/capability handshake;
- tmux control-mode adapter;
- session/window/pane discovery;
- tmux user-option metadata;
- PTY attachment and resize;
- bounded scrollback;
- per-pane input serialization;
- structured prompt delivery;
- process/session controls;
- restart reconciliation.

### Identity and authorization

- development auth for local work;
- production Tailscale identity mode;
- user and membership bootstrap;
- workspace/repository roles;
- session visibility policy;
- terminal grants;
- terminal write leases;
- audit events;
- immediate revocation.

### Web

- application shell;
- workspace switcher;
- session list and classification;
- session detail;
- terminal drawer;
- control owner display;
- connection/degraded states;
- command palette for attach and prompt;
- basic activity.

## Explicit non-scope

- complete Pacium runs/tasks;
- provider-native telemetry;
- automatic worktrees;
- multi-host;
- advanced review.

## Acceptance criteria

1. Existing tmux sessions are discovered and mapped to stable Pacium IDs.
2. Unknown sessions can be classified without renaming them manually.
3. Two authorized users can watch the same session.
4. Only one human can write under the default lease policy.
5. Lease expiry prevents further input server-side.
6. Unauthorized users cannot discover or attach to out-of-scope sessions.
7. The web process cannot access the tmux socket.
8. Terminal WebSocket grants are short-lived, single-use, and origin-bound.
9. Prompt delivery is serialized and reconnect-safe.
10. API/browser/broker restart does not terminate tmux sessions.
11. Broker restart rediscovers sessions and resumes observation.
12. Uncertain delivery becomes explicit `unknown`, not silent retry.
13. Terminal route has no third-party analytics or session replay.
14. Local attach instructions work as fallback.

## Demo

- Start two fake or safe real CLI sessions in tmux.
- Discover and classify both.
- Open one terminal from two browsers.
- Transfer control lease.
- Send a structured multiline prompt.
- Restart API and broker.
- Confirm sessions continue and prompt is not duplicated.
- Revoke one user and show terminal/grant invalidation.

## Security review

Required before exit:

- tmux socket ownership;
- broker RPC authentication;
- path/target validation;
- terminal origin/auth tests;
- lease race tests;
- CSP and browser dependency review;
- development-auth production guard.
