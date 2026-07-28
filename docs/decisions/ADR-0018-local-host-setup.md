# ADR-0018: Allow one local-only fixed host setup flow

- Status: Accepted
- Date: 2026-07-28
- Owners: Felix
- Owner approval: Explicit product direction in the 2026-07-28 implementation session
- Amends: [ADR-0016](ADR-0016-tailscale-serve-access.md)

## Context

ADR-0016 leaves Tailscale Serve configuration to the operator. PC-079 also
requires startup environment values for the tmux socket and Meta target. That
is secure but does not meet the owner's requirement: the primary remote
terminal still needs shell setup.

Pacium can own a narrower flow because it runs on the same host and with the
same OS-user authority as tmux. Tailscale provides local machine-readable
status, a fixed Serve command, and an approval URL when consent is missing.
General browser-to-shell configuration remains unsafe.

## Decision

Pacium may provide one host setup flow with these boundaries:

- Setup reads and mutations are accepted only from an authenticated loopback
  Pacium connection. Tailscale-proxied requests are denied.
- Pacium discovers only the invoking user's default tmux server through a
  fixed no-shell command. The browser selects one published session ID; it
  never supplies a socket, name, executable, host, or arguments.
- Pacium reads bounded fields from `tailscale status --json` to derive the
  current node's canonical `*.ts.net` origin and owner login.
- Enabling remote access invokes only the discovered Tailscale executable with
  fixed `serve --bg --yes 4174` arguments.
- Pacium refuses to overwrite a non-empty Serve configuration it cannot prove
  belongs to this exact flow.
- If consent is required, Pacium may return one bounded canonical HTTPS URL on
  `login.tailscale.com`. It never receives credentials or claims approval.
- Successful setup is stored as one private versioned secret-free atomically
  replaced JSON file in the existing Pacium data directory, including the
  fixed loopback port so a later port override cannot silently reuse it.
- Pacium remains bound to `127.0.0.1`. Funnel, public access, SSH, arbitrary
  commands, privilege escalation, and password handling remain prohibited.

## Consequences

### Positive

- Initial configuration becomes a local wizard instead of shell instructions.
- Future remote use is reduced to opening the tailnet URL.
- Browser authority remains identity-only and server-published.

### Negative

- Pacium performs one bounded Tailscale mutation and must maintain strict
  timeout, output, existing-config, persistence, and rollback behavior.
- First setup still requires local access to Pacium on the host.
- Tailscale installation, daemon state, permissions, grants, and consent can
  still block completion.

### Neutral / operational

- Existing environment configuration remains an explicit override.
- Removing setup state returns the next startup to explicit/local defaults;
  disabling Serve remains a distinct deliberate action.

## Alternatives considered

### Keep command-only setup

Rejected by the owner because it makes the primary workflow needlessly
operational.

### Accept arbitrary commands or SSH details from the browser

Rejected because it creates a generic browser-to-shell boundary.

### Configure setup from a remote connection

Rejected because remote access must not redefine its own Origin, allowlist,
tmux target, or ingress.

## Security and privacy impact

Every request requires the ephemeral token, exact local Origin/Host, and
loopback request classification. Persisted state contains a socket path, tmux
session name, tailnet origin, and login but no token, credential, terminal
content, environment, or Tailscale state key. Output is bounded and reduced to
allowlisted fields and recovery copy.

## Migration and rollback

Environment values override persisted setup. A failed write after a newly
created Serve mapping triggers one fixed best-effort disable; an unknown
rollback is reported explicitly. Removing the setup file and disabling the
exact mapping restores the ADR-0016 command-owned path.

## Validation

- Unit tests cover status projection, approval-link filtering, fixed argv,
  existing Serve refusal, persistence, and rollback.
- HTTP tests prove remote denial and local token/Origin/body enforcement.
- Real isolated tmux and fake-Tailscale tests cover discovery and apply.
- Chromium covers keyboard/pointer setup, consent, errors, ready URL, and Meta
  focus.

## Reconsideration trigger

Arbitrary Tailscale options, another ingress, sudo/password handling, multiple
tmux sockets, remote setup, or multi-user access require a new ADR.
