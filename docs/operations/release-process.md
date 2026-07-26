# Release process

> Historical blueprint: this process targets the superseded server product. A local packaging process belongs to Milestone 5.

## Purpose

Release discipline prevents a fast-moving, agent-built repository from accumulating invisible deployment and compatibility risk.

## Release preparation

1. Select a candidate commit.
2. Freeze new unrelated merges.
3. Update changelog and known limitations.
4. Confirm state schema compatibility and migration.
5. Run full release gates from a clean clone.
6. Build immutable release artifact.
7. Generate dependency inventory/SBOM when implementation supports it.
8. Back up production state.
9. Review deployment and rollback plan.
10. Obtain required product/security approval.

## Versioning

Use semantic versioning once executable software exists, with prerelease tags while compatibility is evolving.

- Patch: compatible fixes.
- Minor: compatible feature additions.
- Major: intentional breaking contract/state changes.

State format and protocol versions may evolve separately and should be listed in release notes.

## Release artifact

A release artifact should contain only required runtime assets and metadata:

- built application;
- version/commit;
- state/protocol compatibility;
- dependency inventory;
- migration tools;
- license notices;
- checksums/signature where adopted.

It should not contain source worktrees, secrets, `.env`, local state, test credentials, or build-machine paths.

## Pre-deployment review

Checklist:

- target host and environment;
- current and target version;
- current state format;
- backup revision;
- provider/tmux compatibility;
- expected service interruption;
- rollback trigger and owner;
- canary session/repository;
- public reachability check;
- incident contact.

## Deployment

Follow [production deployment](production-deployment.md). Preserve existing tmux sessions unless the release specifically and explicitly requires otherwise.

## Post-deployment verification

- health components;
- Tailscale authentication;
- authorization denial tests;
- session discovery;
- read-only terminal;
- control lease;
- canary question/decision/acknowledgement;
- Git evidence;
- provider adapter health;
- event stream reconnect;
- backup status.

## Rollout strategy

Early versions should deploy to:

1. development environment;
2. integration VPS;
3. production canary workflow;
4. full internal daily use.

Do not hide a high-risk migration inside a broad feature release.

## Release notes

Include:

- user-visible changes;
- architecture/protocol/state changes;
- security changes;
- supported provider/tmux/runtime versions;
- migration actions;
- rollback constraints;
- known limitations;
- validation performed;
- items not validated in production.

## Aftercare

Monitor for a defined period:

- state errors;
- broker/terminal disconnects;
- duplicate/unknown operations;
- provider parse errors;
- authorization failures;
- memory/disk/event lag;
- user-reported workflow regressions.

Then close the release with a short evidence record and follow-up issues.
