# Release checklist: <version>

## Identity

- Commit/tag:
- Release owner:
- Target environment:
- State format versions:
- Broker/host protocol versions:
- Supported tmux/Claude/Codex versions:

## Source and build

- [ ] Clean working tree and tagged commit
- [ ] Clean-clone install passes
- [ ] Formatting/lint/type checks pass
- [ ] Unit/property/contract tests pass
- [ ] Integration/browser/security tests pass
- [ ] Production build passes
- [ ] Dependency and secret scans pass
- [ ] No environment-specific traces or runtime state
- [ ] Release artifact checksum recorded

## Product

- [ ] Acceptance matrix complete
- [ ] Demo script passes
- [ ] UI evidence attached
- [ ] Accessibility checks complete
- [ ] Known limitations documented
- [ ] Metrics/pilot evidence reviewed

## State and compatibility

- [ ] Pre-upgrade backup complete
- [ ] Migration tested on representative copy
- [ ] Integrity validation passes
- [ ] Rollback path tested
- [ ] Projection rebuild tested
- [ ] Restore evidence current

## Security

- [ ] Threat model reviewed
- [ ] Network exposure verified
- [ ] Authorization matrix tested
- [ ] Terminal/broker changes reviewed
- [ ] Secrets/credentials policy reviewed
- [ ] Residual risk accepted

## Operations

- [ ] Deployment plan approved
- [ ] Rollback trigger and owner identified
- [ ] Canary selected
- [ ] Monitoring/health ready
- [ ] Backup destination healthy
- [ ] Incident contact available

## Post-deployment smoke

- [ ] Tailscale authentication
- [ ] Authorization denial
- [ ] Session discovery
- [ ] Read-only terminal
- [ ] Control lease
- [ ] Canary prompt
- [ ] Question/decision/acknowledgement
- [ ] Git evidence
- [ ] Provider adapter health
- [ ] Backup/state integrity

## Decision

- [ ] Release approved
- [ ] Release rejected
- [ ] Release approved with documented waivers

Approver and reason:
