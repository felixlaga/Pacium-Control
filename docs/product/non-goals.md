# Product non-goals

## Initial non-goals

- Public remote access or Tailscale Funnel.
- Multi-user accounts, roles, or permissions.
- Multi-host terminal management.
- Public hosting or SaaS.
- Mobile-first operation.
- A database.
- A universal agent framework.
- A generalized runs/tasks/plans platform.
- Automatic worktree, merge, push, or pull-request orchestration.
- Provider token resale.
- Provider desktop application automation.
- Perfect semantic reconstruction of arbitrary terminal output.
- Unlimited terminal transcript retention.
- Silent attachment to arbitrary Terminal.app or iTerm panes.
- Mandatory tmux.

## Product boundaries

Pacium is not:

- a shell implementation;
- an IDE;
- a Git client replacement;
- a provider runtime;
- a container or process sandbox;
- a secrets manager;
- a general-purpose remote administration tool;
- an enterprise workflow system.

It is a focused interface around local PTYs, coding-agent attention, Git inspection, and the Pacium workflow.

## Future proposals

The accepted remote scope is the narrow single-operator Tailscale Serve path in ADR-0016. Multi-user, public, cross-host, or privileged features require new product evidence, an ADR, and a security redesign.
