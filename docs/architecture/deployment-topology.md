# Local deployment

## Development

```text
Developer machine
├── Pacium local server on 127.0.0.1
├── Browser
├── Local PTYs
├── Claude Code / Codex credentials owned by the user
├── Git repositories
├── Queue files
└── Optional local tmux
```

## macOS development package

PC-074 implements one Apple-silicon archive containing `Pacium Control.app`,
an exact `pacium` command link, installer, uninstaller, manifest, and checksum.
It packages the production server/browser assets and minimal arm64 patched
`node-pty` runtime. Node.js 24.18.x remains an explicit external prerequisite.

The launcher validates the runtime and fixed loopback URL, reuses only an exact
Pacium health signature, and opens the browser only after a new server listens.
The app is still the same foreground single process: closing the browser does
not end PTYs, while stopping the local server ends direct PTYs and detaches
Pacium-owned tmux clients according to their existing policy.

Installation is user-local and unprivileged. Application code is replaceable;
application metadata, repositories, provider stores, queue files, and external
tmux targets remain outside package ownership. The artifact is intentionally
unsigned and unnotarized until PC-076.

## Optional remote operation

```text
Tailnet browser
      ↕ HTTPS / WSS
Tailscale Serve
      ↕ loopback proxy
Pacium on 127.0.0.1
      ↕
PTYs / Meta / Orchestrator / queue files on the same host
```

Remote mode is implemented through two startup values: one canonical
`https://<node>.<tailnet>.ts.net` Origin and one non-empty exact-login
allowlist. Pacium still reports and listens only on `127.0.0.1`. Serve preserves
the exact tailnet Host and adds the verified login header; protected browser
transport additionally requires the exact Origin and ephemeral Pacium token.
Protocol 18 labels the current connection Local or Tailscale plus the verified
login.

Tailscale grants are required outside the application. Tailscale Funnel, direct
tailnet/LAN binding, another reverse proxy, and tagged-device-only access are
denied or unsupported. See the
[active Serve runbook](../operations/tailscale-serve.md).

## Startup requirements

- external supported Node.js 24.18.x runtime;
- writable local configuration directory;
- supported shell and PTY facilities;
- browser;
- provider CLIs only for their respective launch presets;
- Git only for repository inspection;
- tmux only for optional attachment.

## Unsupported deployment

- public network binding;
- server/VPS hosting;
- direct tailnet binding or Tailscale Funnel;
- multiple users;
- containerized remote shells;
- shared state directory;
- multi-host agents.

Those require future design and security approval.
