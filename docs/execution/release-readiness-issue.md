# PC-076: Run release readiness

## Problem

Pacium has two verified development packages and broad automated coverage, but
it is not a release artifact. Existing evidence comes from this development
account and a hosted Ubuntu runner. Developer ID signing/notarization,
fresh-account macOS installation, a real Tailscale Serve/grants/revocation
exercise, manual screen-reader and sustained-use review, and owner acceptance
have not occurred.

Calling the current package release-ready would collapse implemented,
automated, clean-environment, externally verified, manually reviewed, signed,
and owner-accepted states into one unsupported claim. Conversely, leaving the
remaining gate as an informal list makes it difficult to reproduce the
available evidence or identify the exact blockers.

## Outcome

Produce one exact-source, reproducible release-readiness assessment with a
clear `GO` or `NO-GO` decision. Automatable source, build, test, package,
security, performance, accessibility, installation, rollback, and
documentation checks run to completion. External/manual gates are accepted
only from real evidence and otherwise remain explicit blockers.

PC-076 is complete when the assessment itself is complete and integrated. A
`NO-GO` result keeps Pacium at the development-snapshot class and is not a
failed implementation task.

## Scope

- Define the exact candidate source, supported targets, release class, and
  decision vocabulary.
- Add one bounded release-preflight command for repository/runtime/package
  hygiene and scalar evidence.
- Reproduce a clean exact-source macOS install from a Git archive with frozen
  dependencies and no inherited working-tree build output.
- Run supported macOS full verification, soak, package verification, and all
  Chromium workflows.
- Reuse exact green Ubuntu 24.04 x64 workflow evidence for the integrated
  candidate and rerun it if the candidate changes.
- Inspect application/package contents for forbidden runtime state, secrets,
  environments, credentials, transcripts, queues, repositories, and host
  identity.
- Run dependency, tracked-secret, loopback/Origin/token/path/terminal-injection,
  package-safety, accessibility-automation, and performance evidence.
- Record package hashes, sizes, file counts, runtime matrix, rollback, state
  preservation, and known limitations.
- Audit live availability of Developer ID/notarization, clean-account,
  Tailscale Serve/grants/public/revocation, real provider, manual
  accessibility/sustained-use, and owner-decision evidence without inventing
  results.
- Synchronize status, roadmap, release checklist, security checklist,
  operations, and changelog with the final decision.

## Non-scope

- Creating or purchasing an Apple Developer identity, changing account
  membership, or submitting an unsigned artifact to notarization.
- Enabling Tailscale Serve, changing grants, exposing Pacium to the tailnet,
  revoking users, or testing from another person/device without explicit
  operator authority and available identities.
- Creating/deleting an operating-system user, changing the Xcode license, or
  altering provider credentials.
- Publishing a GitHub release, tag, package, website, Homebrew formula, Linux
  repository, or auto-update channel.
- Adding another host, distribution, architecture, ingress, database, service,
  telemetry, crash reporter, or generalized release platform.
- Declaring real-provider, screen-reader, daily-use, public-reachability, or
  production evidence from fixtures or automated approximations.

## Acceptance criteria

- [x] The assessment identifies one immutable candidate commit and separates
      `pass`, `fail`, `blocked`, `not applicable`, and `not run`.
- [x] A bounded preflight fails closed on the wrong runtime/host, dirty source,
      forbidden tracked/runtime artifacts, missing manifests/checksums, or
      unsupported package claims and emits no sensitive content.
- [x] An isolated exact-source macOS archive completes a frozen install and the
      supported full verify, soak, package, and Chromium gates without using
      working-tree build output.
- [x] Exact Ubuntu 24.04 x64 full verify, soak, package, Chromium, and artifact
      evidence is green for the candidate source.
- [x] Package manifests/checksums and independent inventory checks show only
      recognized code/assets/native runtime and exclude secrets, environments,
      transcripts, repositories, queue/provider/state content, and host
      identity.
- [x] Loopback, Origin, token, path, terminal-content, queue-data, package
      lifecycle, and diagnostics-redaction security evidence passes.
- [x] Automated keyboard, narrow-layout, zoom, forced-colors, reduced-motion,
      terminal-focus, reconnect, tmux, Pacium, and performance/soak evidence
      passes with exact counts/budgets.
- [x] Signing/notarization, clean-account, real-tailnet, real-provider, manual
      screen-reader/visual/sustained-use, and owner acceptance are supported
      only by actual evidence or recorded as blockers.
- [x] The decision matrix states one honest release class, exact limitations,
      rollback triggers, preservation boundaries, and next authority required.
- [x] All source-of-truth documentation agrees, the task branch is clean, the
      final exact head is green, and integration into `dev` is fast-forward
      only.

## User experience

PC-076 adds no decorative product surface. The operator receives one concise
release assessment and a reproducible preflight command. Every row explains
what was tested, the evidence source, what survived a failure, and the next
action.

A blocked manual or provider gate is not presented as an application error.
The installed development packages remain usable within their documented
boundaries. `NO-GO` means “do not publish or call this a release,” not “delete
the working local product.”

## Architecture

- Systems and modules touched: release-preflight script/tests, root scripts,
  release assessment/checklists, package/runbook/status/changelog documents.
- Systems of record: Git owns candidate source; package manifests/checksums own
  artifact inventory; PTYs/providers/queues/tmux/Tailscale remain external
  truth; the assessment records evidence references only.
- State transitions: development candidate -> evidence collection -> GO/NO-GO
  decision. There is no application-state or release-publication transition.
- Protocol/schema impact: none; protocol remains 24 and application state
  schemas remain unchanged.
- Relevant ADRs: ADR-0013 through ADR-0017.

## Security and privacy

- Authorization: no new HTTP/WebSocket, shell, package, Tailscale, or provider
  authority.
- Privilege: preflight and local gates run as the current user; no `sudo`,
  account creation, keychain mutation, signing, notarization, or tailnet
  mutation.
- Secrets/logging: reports contain fixed status/scalar/hash/path-class metadata
  only. Identity names, tokens, environments, terminal bytes, source content,
  credentials, and host-specific paths are excluded.
- Abuse/failure scenario: a missing external prerequisite produces `blocked`;
  a failing automated gate produces `fail`; neither is converted to `pass` or
  bypassed to obtain a release claim.

## Reliability

- Idempotency: preflight and evidence collection are read-only except for
  generated temporary build/install directories that are removed.
- Timeouts/retries: all process, package, browser, network-audit, and hosted
  workflow steps use existing or explicit bounds; infrastructure failures are
  distinguished and may be retried without weakening a gate.
- Restart behavior: browser refresh/reconnect and optional tmux restoration are
  exercised; direct PTYs remain honestly tied to the local server.
- Unknown outcome: unavailable signing, remote identity, provider account, or
  manual reviewer evidence stays blocked.
- Migration/rollback: no schema migration. Reinstall an earlier matching
  development archive; package uninstall preserves external state.

## Test plan

- Unit: preflight target/runtime/path/inventory/status projection and hostile
  fixtures.
- Contract: existing protocol, diagnostics, package-manifest, and state-schema
  suites.
- Integration: clean exact-source install, real PTY, package lifecycle,
  process signals/reconnect, Git/queue/path fixtures.
- Browser: all Chromium workflows plus explicit accessibility and tmux
  capability behavior.
- Failure/recovery: dirty source, forbidden tracked artifact, missing package,
  foreign/active install target, direct-PTY restart, and unavailable external
  authority.
- Security: dependency audit, tracked-secret patterns, package inventory,
  loopback/Origin/token/terminal/path/queue/diagnostics tests.

## Dependencies

- Blocked by: PC-063 through PC-075.
- Blocks: no current roadmap task; the assessment gates any future publication.

## Evidence required

- Exact candidate and integrated commit SHAs plus clean status.
- Toolchain/host matrix and exact test/browser/soak counts.
- macOS and Linux package sizes, hashes, file counts, and lifecycle summaries.
- Clean exact-source install transcript containing scalar results only.
- Dependency/secret/package inventory summaries.
- Release decision matrix with pass/fail/blocked sources and limitations.
- Exact hosted workflow run and local commands/results.
- Fast-forward `dev` push evidence.

## Open questions

- None for implementation. External authority rows are evaluated from current
  evidence and may legitimately make the final decision `NO-GO`.

## Completion evidence

- Assessed candidate: `030da051966296cf7ab20d08b9e14469d8287aba`.
  Final task-branch and fast-forward integration head:
  `2dfa16dd5fcb51489185fbae3235c9d239e6bec2`.
- Exact-head local preflight passed on Apple-silicon macOS with 560 tracked
  files and 21 source contracts.
- The exact-source frozen install completed the full 142-file, 930-test
  verification suite, all 20 Chromium workflows, and the lifecycle soak with
  zero final sessions and file descriptors returning from 18 to 18.
- The macOS development archive was 573,683 bytes with SHA-256
  `923fe2f41533eee7c8591999002d783212e679545e959aca6ceba8d96415075c`,
  28 manifest files, and 47 archive entries.
- Linux validation run `30345044665`, job `90229181991`, passed at exact head
  `2dfa16dd5fcb51489185fbae3235c9d239e6bec2` in 3 minutes 36 seconds,
  including frozen install, full verify, soak, package, preflight, Chromium,
  and artifact upload.
- The detailed Linux candidate run completed 142 test files with 931 passes
  and one platform skip, 18 Chromium passes and two tmux capability skips, and
  produced a 584,044-byte archive with SHA-256
  `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`.
- Local `dev` was fast-forwarded from
  `07bba5b58254f1c58815cccb625b92c5df1e261a` to the final task head.
  The closure commit and final `dev` workflow record the integration itself.
- Decision: `NO-GO`; release class remains Development snapshot. Developer ID
  signing/notarization, a fresh macOS account, a real Tailscale Serve exercise,
  real provider canaries, manual accessibility/sustained-use review, and
  explicit owner release acceptance remain external blockers.
