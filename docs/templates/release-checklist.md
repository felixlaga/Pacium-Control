# Release checklist: <version>

## Identity

- Commit/tag:
- Release owner:
- Package/platform:
- Protocol version:
- State schema versions:
- Supported Node/browser/PTY versions:
- Supported Claude/Codex versions:
- Optional tmux version:

## Source and build

- [ ] Clean tagged source
- [ ] Clean-clone install passes
- [ ] Format/lint/strict type checks pass
- [ ] Unit and contract tests pass
- [ ] Real PTY integration tests pass
- [ ] Browser and security tests pass
- [ ] Production/package build passes
- [ ] Dependency and secret scans pass
- [ ] No local state, terminal captures, credentials, caches, or machine paths
- [ ] Release artifacts and checksums recorded

## Terminal workspace

- [ ] Shell, Claude Code, and Codex launch
- [ ] Input, resize, interrupt, exit, and close
- [ ] Browser refresh preserves live PTYs
- [ ] Reconnect does not duplicate input
- [ ] Tabs, splits, focus, and keyboard workflows
- [ ] Bounded buffers under sustained output
- [ ] Direct PTY server-restart limitation is clear
- [ ] Optional tmux behavior verified when included

## Agent and Git

- [ ] Attention source/confidence/freshness is honest
- [ ] Needs-input/failure/completion behavior verified
- [ ] Git status and diff match direct Git evidence
- [ ] Verification presets are explicit and bounded
- [ ] Provider observer loss degrades safely

## Pacium mode

- [ ] General/Pacium toggle preserves terminal context
- [ ] Meta and Orchestrator targeting is explicit
- [ ] Queue observation does not mutate sources
- [ ] Question and approval flows remain distinct
- [ ] Decision delivery is deduplicated
- [ ] Conflict and unknown-delivery states are exercised

## Security

- [ ] Server binds only to loopback
- [ ] Hostile Origin and invalid token are denied
- [ ] Terminal title/link/OSC/clipboard fixtures pass
- [ ] Path and symlink tests pass
- [ ] Logs/state contain no terminal transcript or environment secrets
- [ ] Residual risks documented

## Product quality

- [ ] Milestone acceptance matrix complete
- [ ] Demo script passes
- [ ] UI recording/screenshots attached
- [ ] Accessibility checks complete
- [ ] Performance/soak evidence reviewed
- [ ] Known limitations documented
- [ ] Upgrade and uninstall preserve repositories and provider credentials

## Decision

- [ ] Release approved
- [ ] Release rejected
- [ ] Release approved with documented waivers

Approver and reason:
