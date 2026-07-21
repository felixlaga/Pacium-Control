# Security review checklist

Use this checklist for security-sensitive pull requests and milestone gates.

## Identity

- [ ] Production identity comes only from the trusted Tailscale ingress.
- [ ] Source IP is not used as a person identifier.
- [ ] Unknown tailnet users do not receive automatic membership.
- [ ] Revocation invalidates sessions, grants, and leases.
- [ ] Development auth cannot be enabled in production accidentally.

## Authorization

- [ ] Every server-side action checks authorization.
- [ ] Workspace, repository, host, session, and object state are considered.
- [ ] Enumeration endpoints do not leak out-of-scope resources.
- [ ] Owner-only and approval actions are tested.
- [ ] Error messages do not disclose hidden objects.

## Broker and host

- [ ] Web process has no tmux socket access.
- [ ] Broker runs non-root with narrow filesystem access.
- [ ] RPC is authenticated and versioned.
- [ ] No generic arbitrary shell endpoint exists.
- [ ] Paths are canonicalized and root-checked.
- [ ] Symlink escape is tested.
- [ ] Remote host commands use IDs, deadlines, and deduplication.

## Terminal

- [ ] Terminal grants are short-lived and single-use.
- [ ] WebSocket validates origin and authorization.
- [ ] Read-only and write authority are separate.
- [ ] Write lease is enforced server-side and expires.
- [ ] Revocation interrupts input promptly.
- [ ] Terminal route uses self-hosted assets and strict CSP.
- [ ] No analytics/session replay exists on terminal route.
- [ ] Output, titles, links, clipboard sequences are untrusted.
- [ ] Scrollback retention is bounded.

## Questions and approvals

- [ ] Questions do not grant permission.
- [ ] Approval shows exact action, host, repository/worktree, risk, scope, and duration.
- [ ] Policy matching is least-privilege and revisioned.
- [ ] Agents cannot modify their own authorization.
- [ ] Expired provider callbacks cannot receive a late approval for a changed action.
- [ ] High-risk actions require appropriate role and confirmation.

## State

- [ ] Only state coordinator writes authoritative files.
- [ ] File permissions and owner are checked.
- [ ] IDs cannot become paths without validation.
- [ ] Writes are atomic.
- [ ] Multi-file mutation has recovery semantics.
- [ ] Corrupt data is quarantined, not ignored.
- [ ] Backups exclude secrets and are checksummed.
- [ ] Restore is validated before activation.

## Secrets and logging

- [ ] No provider tokens or SSH/Tailscale keys enter state.
- [ ] Environment dumps are not logged.
- [ ] Prompts/terminal output are retained only under explicit policy.
- [ ] Logs use hashes/metadata where raw payload is sensitive.
- [ ] Support bundle has an inclusion manifest and redaction.
- [ ] Secret scanning passes.

## Browser/application

- [ ] Secure cookies and CSRF controls exist.
- [ ] Content Security Policy is reviewed.
- [ ] User-generated/terminal/provider content is escaped.
- [ ] Dependency additions are reviewed for supply-chain risk.
- [ ] Sensitive actions cannot be clickjacked or triggered cross-origin.
- [ ] Mobile notifications reveal minimal lock-screen content.

## Deployment

- [ ] Web/API binds to loopback in production.
- [ ] Broker is Unix-socket/local only unless explicitly designed otherwise.
- [ ] Public external scan cannot reach Pacium.
- [ ] Break-glass access is separate and tested.
- [ ] Service users and directory modes are correct.
- [ ] Backup and credential rotation owners are known.

## Evidence

- [ ] Threat model updated if boundary changed.
- [ ] Tests demonstrate negative cases.
- [ ] Exact versions and configuration are recorded.
- [ ] Residual risk is documented and accepted by authorized owner.
