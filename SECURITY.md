# Security

Pacium Control is a remote operations surface over powerful developer tools. Security is part of the product architecture, not a deployment afterthought.

## Security goals

1. Only authorized tailnet users can access the application.
2. Users see and control only permitted workspaces, repositories, hosts, and sessions.
3. The web process cannot directly control tmux or arbitrary host processes.
4. Terminal access is explicit, narrow, attributable, and revocable.
5. Provider credentials remain outside Pacium durable state.
6. Human decisions and privileged actions are auditable.
7. A compromised browser session has bounded authority.
8. State corruption, replay, and duplicate delivery are detectable and recoverable.
9. Public network exposure is absent by default.
10. Security degradation is visible rather than silently permissive.

## Threat model

### Protected assets

- source repositories and uncommitted changes;
- provider credentials and subscription access;
- shell access to execution hosts;
- deployment and infrastructure credentials;
- terminal output that may contain secrets;
- human decisions and approval policies;
- audit history;
- state files and backups;
- Tailscale identity headers and application sessions.

### Adversaries and failure sources

- an unauthorized tailnet member;
- an authorized user exceeding their intended role;
- a malicious or compromised browser;
- cross-site WebSocket or request abuse;
- a compromised coding agent or prompt injection;
- an overbroad approval policy;
- a vulnerable dependency;
- a compromised host agent;
- accidental secret logging;
- stale credentials or revoked users;
- filesystem tampering or partial writes;
- misconfigured public firewall or reverse proxy.

## Network boundary

Production deployment should use Tailscale Serve as the normal HTTPS ingress. The web/API process binds to loopback. Public Hetzner firewall rules should not expose the application or broker ports.

The application must not trust arbitrary incoming identity headers. It should accept verified identity only from the configured local Tailscale proxy boundary and reject production startup when that boundary is inconsistent.

A separate break-glass administration path may exist, but it must be narrow, documented, and tested.

## Identity and authorization

### Identity

Tailscale user identity is mapped to a Pacium user. A source IP is a device address, not a person.

### Authorization

Authorization is evaluated for every server-side action using:

- workspace membership;
- repository scope;
- host scope where required;
- role;
- action type;
- object state;
- approval or terminal lease where applicable.

Suggested roles:

| Role | Typical authority |
|---|---|
| Viewer | Read structured state and redacted evidence |
| Operator | Send structured prompts and operate allowed sessions |
| Approver | Answer assigned questions and approve permitted action classes |
| Owner | Manage access, raw terminal, policies, destructive controls |

Roles are a starting point, not a substitute for object-level policy.

## Privilege separation

### Web/API process

Must not have:

- tmux socket access;
- provider credential files;
- unrestricted repository write access;
- arbitrary shell execution;
- root privileges.

### State coordinator

May write only within the configured Pacium state directory. It validates schemas, authorization context, revisions, and idempotency.

### Broker

Runs as a dedicated non-root user. It accesses only designated tmux servers, repository roots, worktree roots, and approved tools. Its RPC protocol is typed and allowlisted.

### Execution identities

Provider credentials belong to explicit execution identities. Operator identity, approver identity, and execution identity are separately recorded.

## tmux security

Access to a tmux socket is effectively control over every session in that tmux server. Therefore:

- use a dedicated tmux server or Unix identity for Pacium-managed sessions where practical;
- do not expose the socket to the web process;
- do not mount it into broad containers;
- route operations through the broker;
- treat session classification as security-sensitive;
- avoid mixing highly sensitive unrelated shells into the same managed tmux server.

## Browser terminal security

The terminal route is high risk because page JavaScript can observe output and keystrokes.

Requirements:

- self-host all JavaScript, fonts, and styles used on the terminal page;
- no analytics, session replay, advertising, or chat widgets;
- strict Content Security Policy;
- secure, HTTP-only, same-site cookies;
- short-lived, single-use terminal grants;
- independent WebSocket authentication and origin checks;
- expiring terminal write leases;
- output treated as untrusted content;
- no unsafe HTML insertion from terminal titles or hyperlinks;
- explicit user-visible control owner;
- immediate revocation on membership or lease change;
- bounded scrollback retention;
- secret-aware logging and optional redaction.

## Agent and prompt-injection risk

Coding agents process untrusted repository content. A malicious file can attempt to influence an agent into requesting or performing unsafe actions.

Controls:

- least-privilege worktree and command scope;
- structured approval requests with exact action context;
- no blanket “allow all” policy;
- run-scoped and expiring grants;
- independent validation of broker operations;
- visible provenance for instructions and repository content;
- human review for high-risk commands;
- no agent ability to alter its own authorization policy.

## Secrets

Pacium state stores references and metadata, not secrets.

Never persist:

- provider access tokens;
- Tailscale auth keys;
- SSH private keys;
- cloud credentials;
- full environment dumps;
- password input;
- unredacted terminal streams indefinitely.

Use operating-system permissions, provider credential stores, or dedicated secret tooling. Backups exclude credential material.

## Questions and approvals

A question is not permission. An approval is not a general conversation.

Approval records must include:

- requested action;
- host;
- repository and worktree;
- tool or command;
- reason;
- risk;
- scope and duration;
- approver;
- decision;
- execution result.

Policy-derived approval must record the exact policy revision used.

## Audit

Audit events should include:

- actor user;
- requesting agent/session;
- execution identity;
- workspace, repository, run, and host;
- action type;
- target;
- timestamp;
- result;
- reason or decision;
- relevant policy revision;
- payload hash where retaining raw payload is unsafe.

Audit history is append-only. Redaction must preserve evidence that redaction occurred.

## Filesystem state security

- State directory owner and mode are validated at startup.
- Symlink traversal is forbidden.
- Paths are constructed from validated IDs, not user input.
- Writes use atomic replacement.
- Event lines include integrity fields or are covered by snapshot manifests.
- Backups are checksummed and optionally encrypted.
- Restore validates format version and references before activation.
- Unknown or corrupt files are quarantined.
- Materialized projections can be deleted and rebuilt.

## Supply chain

- Lock dependency versions.
- Use supported runtimes.
- Review high-risk terminal and WebSocket dependencies.
- Generate a software bill of materials for releases.
- Run dependency and secret scanning in CI.
- Do not execute arbitrary install scripts without review.
- Reproducible clean-clone builds are a release gate.

## Incident response

Security incidents follow [the incident response playbook](docs/operations/incident-response.md). Immediate actions may include:

- pause workspace coordination;
- revoke user membership;
- revoke terminal grants;
- stop host-agent routing;
- rotate provider credentials;
- preserve state and audit evidence;
- isolate affected tmux servers or hosts;
- restore from verified backup;
- document impact and corrective action.

## Reporting

Until a formal security contact exists, report security issues privately to the repository owner. Do not open a public issue containing exploit details, credentials, or sensitive host information.
