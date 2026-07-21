# Milestone 5 — Multi-host and hardening

## Goal

Operate Pacium reliably across the Hetzner VPS and additional machines, with production-grade recovery and security practices.

## Multi-host scope

- one-time host enrollment;
- host identity/key rotation;
- outbound authenticated channel;
- capability/version report;
- remote broker operations;
- source event sequence and resend queue;
- command idempotency and deadlines;
- host health/disconnect state;
- reconciliation after reconnect;
- host-scoped authorization;
- local attach support;
- optional local-machine helper.

## Hardening scope

- production systemd units;
- service users and file permissions;
- Tailscale Serve configuration validation;
- Hetzner firewall checklist;
- CSP and terminal isolation;
- backup timer and encrypted off-host destination;
- full restore drill;
- diagnostics/support bundle;
- disk and backup alerts;
- provider credential health;
- workspace emergency pause;
- VPS reboot recovery;
- security review and dependency inventory;
- performance and soak testing.

## Acceptance criteria

1. A remote host enrolls only once and is explicitly activated.
2. Revoked host cannot reconnect or execute commands.
3. Remote commands are deduplicated across reconnect.
4. Unknown outcomes are surfaced, not blindly retried.
5. Event sequence gaps are detected and reconciled.
6. Host disconnect leaves central state consistent and sessions last-known.
7. Reconnection correctly matches surviving sessions.
8. A laptop can disconnect without affecting VPS operation.
9. Production web/API is unreachable on public interfaces.
10. Backup is encrypted and stored off-host.
11. Restore succeeds on a separate clean machine.
12. VPS reboot recovery follows documented procedure.
13. Security checklist and threat model are reviewed.
14. Soak test meets target resource and latency budgets.
15. Support bundle excludes secrets and unrestricted terminal history.

## Production readiness note

Milestone completion does not mean zero risk. It means known risks, tested controls, recovery evidence, and a clear operating owner.
