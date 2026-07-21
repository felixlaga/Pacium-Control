# Deployment topology

## First production topology

The initial production deployment is one Hetzner VPS connected to the team tailnet.

```text
Internet
  │
  ├── no public Pacium web port
  │
Tailnet
  │
  ▼
Tailscale Serve
  │ HTTPS + verified identity
  ▼
127.0.0.1:Pacium Web/API
  ├── state coordinator → /var/lib/pacium/state
  └── Unix socket → Pacium broker
                      ├── tmux server
                      ├── repositories/worktrees
                      ├── Claude Code CLI
                      └── Codex CLI/App Server
```

## Services

Suggested systemd units:

- `pacium-web.service`
- `pacium-broker@<execution-identity>.service`
- optional `pacium-host-agent.service`
- `pacium-backup.timer` and service
- `pacium-healthcheck.timer` where useful.

Services run under dedicated non-root users.

## Filesystem layout

Suggested production paths:

```text
/etc/pacium/                 non-secret configuration
/var/lib/pacium/state/       authoritative coordination state
/var/lib/pacium/backups/     local encrypted/staged backups
/var/lib/pacium/worktrees/   managed Git worktrees
/var/log/pacium/             bounded service logs if not journal-only
/run/pacium/                 Unix sockets and runtime grants
/opt/pacium/                 deployed application release
```

Provider credentials remain under execution-user homes or approved stores, not `/var/lib/pacium/state`.

## Network

- Web/API binds to loopback.
- Broker listens on a Unix socket, not TCP by default.
- Tailscale Serve provides HTTPS.
- Hetzner firewall drops unneeded inbound traffic.
- SSH or Tailscale SSH is a separate break-glass path.
- Host agents initiate outbound tailnet connections.
- Codex App Server remains local to its adapter/broker.

## Unix identities

A practical starting model:

```text
pacium-web       web/API and state access
pacium-broker    broker for designated tmux server
pacium-exec      provider CLIs and managed repositories
```

A stricter model may use one broker/execution identity per provider account or trust domain. Exact ownership depends on tmux and repository operations, but the web user should never receive direct execution credentials.

## Configuration

Configuration should be explicit and validated at startup:

- environment mode;
- bind addresses;
- trusted Tailscale proxy mode;
- state directory;
- broker socket;
- allowed repository/worktree roots;
- provider launch profiles;
- retention;
- backup destination;
- log level;
- development-auth prohibition in production.

Secret values use environment files with restrictive permissions or a secret manager; configuration documentation should identify which values are sensitive.

## Deployment strategy

Prefer immutable release directories and a current symlink:

```text
/opt/pacium/releases/<version>/
/opt/pacium/current -> releases/<version>
```

Upgrade sequence:

1. backup state;
2. validate new release and compatibility;
3. stop accepting new mutations if migration requires;
4. deploy new release;
5. run state migration/recovery checks;
6. restart web and broker in controlled order;
7. verify existing tmux sessions remain;
8. run smoke tests;
9. retain prior release for rollback.

## Containers

Containers are optional, not required. The broker’s interaction with Unix users, PTYs, tmux sockets, and repository roots may be simpler as a native systemd service. Do not containerize solely for fashion.

## Future topology

Multi-host support adds host agents, not a public control plane. Multiple web/API nodes are not an early goal because they complicate the single-writer state model. If availability requirements later demand failover, design a deliberate leader and replicated state mechanism rather than mounting the same state directory read-write from several processes.
