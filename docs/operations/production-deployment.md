# Production deployment

> Superseded blueprint: VPS, Tailscale, and remote deployment are not part of the active product. See [local deployment](../architecture/deployment-topology.md).

This playbook describes the intended first production deployment. It is not a substitute for implementation-specific installation instructions once code exists.

## Preconditions

- A supported Ubuntu or equivalent Linux VPS.
- Tailscale installed and connected to the correct tailnet.
- A reviewed Tailscale access policy.
- Hetzner firewall configured with no public Pacium web/broker ingress.
- Dedicated Unix users and groups.
- Claude Code and Codex CLI installed for approved execution identities.
- Git, tmux, and required repository tools installed.
- Off-host backup destination available.
- A break-glass host administration path tested.

## Intended service users

Example only; implementation may refine ownership:

```text
pacium-web       Web/API and authoritative state
pacium-broker    tmux/Git/provider broker
pacium-exec      managed CLI sessions and worktrees
```

Avoid running Pacium services as root.

## Intended directories

```text
/etc/pacium/
/opt/pacium/releases/
/opt/pacium/current
/var/lib/pacium/state/
/var/lib/pacium/worktrees/
/var/lib/pacium/backups/
/run/pacium/
```

Set ownership and modes explicitly. Validate them at service startup.

## Network sequence

1. Bind web/API to `127.0.0.1` only.
2. Bind broker to a restricted Unix socket.
3. Configure Tailscale Serve to proxy HTTPS to the web/API loopback port.
4. Verify identity headers reach the application only through the trusted local path.
5. Verify the public VPS address cannot reach Pacium ports.
6. Verify tailnet users without membership are denied.
7. Verify an allowed user can authenticate and only see scoped resources.

## Deployment sequence

1. Review release evidence and known limitations.
2. Create a fresh state backup if upgrading.
3. Install release into a versioned directory.
4. Validate configuration without starting mutable services.
5. Validate provider/tmux/Git versions and capabilities.
6. Stop or drain web mutations if state migration requires.
7. Run state compatibility/migration in staging mode.
8. Start broker.
9. Start web/API and state coordinator.
10. Configure or refresh Tailscale Serve.
11. Run production smoke test.
12. Verify existing tmux sessions remain unaffected.
13. Verify backup timer and health reporting.
14. Record release, operator, time, and evidence.

## Initial bootstrap

The first owner should be created through an explicit one-time bootstrap mechanism that:

- is disabled after use;
- requires local host access or a one-time secret;
- records the verified Tailscale identity;
- does not leave a default password;
- creates an audit event.

## Provider authentication

Authenticate Claude Code and Codex under the intended execution Unix identity, not the web user. Confirm:

- CLI runs without desktop application dependency;
- credentials are stored outside Pacium state;
- file permissions are narrow;
- execution identity label is recorded;
- reauthentication/expiry procedure is documented;
- team use complies with the organization’s provider-account policy.

## Repository onboarding

For each repository:

1. clone or register canonical root;
2. confirm ownership and safe directory configuration;
3. configure default branch;
4. configure worktree root;
5. configure allowed verification commands;
6. configure member roles;
7. run a read-only inspection;
8. create and remove a test worktree;
9. run a canary verification command;
10. record repository-specific risks.

## Smoke test

- Authenticate through tailnet.
- Load health and workspace.
- Discover a canary tmux session.
- Open read-only terminal.
- Acquire and release a control lease.
- Send one harmless structured prompt.
- Create/answer/acknowledge a canary question.
- Inspect Git status in a canary repository.
- Verify provider adapter capability or explicit fallback.
- Verify state snapshot and backup age.

## Rollback

Rollback should preserve state and tmux sessions:

1. pause new mutations;
2. capture diagnostics;
3. back up current state;
4. stop web/API and broker as needed;
5. restore prior compatible application release;
6. restore prior state snapshot only if migration is not backward-compatible and after explicit validation;
7. start services;
8. reconcile tmux sessions;
9. run smoke test;
10. document impact.

Never delete worktrees or sessions merely to make rollback simpler.
