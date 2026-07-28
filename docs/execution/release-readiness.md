# Release readiness

## Current decision

PC-076 completed the release audit with a **NO-GO** decision. Pacium remains a
working **Development snapshot** and must not be described as a signed,
notarized, owner-accepted, or published release.

The candidate-specific source of truth is the
[PC-076 release-readiness assessment](release-readiness-assessment.md).

## Verified development-package paths

- Apple-silicon macOS 14 or newer, with an unsigned and unnotarized app bundle.
- Ubuntu 24.04 x64, with an unsigned and non-distro-native user-local archive.
- Node.js 24.18.x and pnpm 11.17.0.
- Deterministic archives, strict manifests, checksums, native PTY canaries, and
  user-local install/upgrade/uninstall behavior.
- Full repository, lifecycle-soak, package, and Chromium automation on the
  supported targets.
- Package removal preserves Pacium metadata, repositories, queue files,
  provider stores, and external tmux targets.

These claims do not imply another host, architecture, ingress mode, provider
account, or publication channel.

## Mandatory gates for a future release

Every row must have reproducible evidence against one immutable candidate:

### Source and supply chain

- clean exact source and pinned toolchain;
- frozen install and complete verification;
- tracked-secret and package-inventory scans;
- current authorized dependency advisory audit;
- final supported-target CI on the candidate.

### Distribution

- Developer ID signing and notarization for the macOS artifact;
- quarantine/Gatekeeper exercise through the intended delivery channel;
- clean supported macOS account install and core workflow;
- exact artifact hashes and owner-approved delivery posture.

### Product and access

- real Claude Code and Codex canaries;
- real Tailscale Serve, grants, allowlist, Funnel/public/LAN denial, and
  revocation exercise when remote mode is included;
- manual screen-reader, visual, terminal-lifecycle, and sustained-use
  acceptance;
- explicit owner release acceptance.

Fixtures and automated approximations may support a row, but cannot replace
the real identity, account, device, or human evidence named by that row.

## Decision vocabulary

- `pass`: reproduced evidence satisfies the bounded gate.
- `fail`: reproduced evidence contradicts the gate.
- `blocked`: required authority or environment is unavailable.
- `not_applicable`: the gate does not apply to the candidate.
- `not_run`: the gate was deliberately not executed.

Any mandatory row that is `fail`, `blocked`, or `not_run` makes the decision
`NO-GO`. Completing an honest `NO-GO` audit is different from completing a
release.

## State compatibility

Pacium persists only application-owned versioned JSON/JSONL metadata. A future
release that changes a state schema must define source versions, atomic
migration, validation, unknown/newer-version behavior, backup where needed,
and rollback feasibility. Never overwrite the only copy of state to perform an
upgrade.

Current development-package uninstallers do not own or remove application
state.

## Rollback and pause triggers

Pause a release attempt when:

- candidate identity moves or an artifact hash/inventory changes unexpectedly;
- a security boundary, native PTY, package lifecycle, or state-preservation
  canary fails;
- duplicate terminal input, queue delivery, or decisions occur;
- direct PTY or external tmux ownership is represented dishonestly;
- remote reachability exceeds the exact operator allowlist;
- signing, notarization, recovery, manual review, or owner evidence is absent.

For current development packages, stop the exact running instance and use the
matching package uninstaller. Reinstall a previously verified matching archive
if needed; there is no automatic migration or update channel.

## Release declaration

A future release note must distinguish:

- implemented;
- tested locally;
- tested on hosted supported-target CI;
- tested on real provider/tailnet/account infrastructure;
- manually reviewed;
- owner accepted;
- known limitations.

Do not collapse these states into a single “production-ready” label.
