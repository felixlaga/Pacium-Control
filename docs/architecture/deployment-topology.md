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

## Initial release

The packaged form may be:

- a CLI that starts the server and opens the browser; or
- a lightweight desktop wrapper around the same local web application.

The packaging decision does not change the localhost server or PTY architecture.

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

Remote mode requires the exact tailnet Origin, verified Serve user identity, an explicit operator allowlist, and the ephemeral Pacium token. Tailscale Funnel is never used.

## Startup requirements

- supported runtime or bundled runtime;
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
