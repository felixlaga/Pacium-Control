# Implementation plan: evidence-backed release readiness

- Issue: PC-076
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/release-readiness`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `07bba5b58254f1c58815cccb625b92c5df1e261a`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: In progress

## Objective

Run the final roadmap gate as a reproducible release audit, maximize automated
and isolated evidence, and produce an honest GO/NO-GO decision without
expanding the product or substituting fixtures for external/manual authority.

## Existing behavior

- PC-063 through PC-075 are complete and merged into `dev`.
- Apple-silicon macOS and Ubuntu 24.04 x64 development packages have strict
  manifests/checksums, safe user-local lifecycle scripts, installed native-PTY
  canaries, full verification, soak, and browser evidence.
- The current supported macOS host has Node.js 24.18.0, pnpm 11.17.0, arm64,
  and an accepted Xcode license.
- No Developer ID Application identity is available.
- Tailscale is running, but Tailscale Serve is not configured.
- Existing evidence does not include a fresh macOS user/account, notarization,
  another remote operator/device, real provider canaries, manual screen-reader
  review, sustained daily use, or owner release acceptance.
- The existing release-readiness document mixes current localhost concerns
  with superseded multi-user/broker inventory and is not a candidate-specific
  decision matrix.

## Proposed behavior

One source-controlled preflight inspects only release-owned scalar contracts:

```text
candidate source
├── exact supported runtime/host
├── clean Git state and immutable HEAD
├── pinned package manager and lockfile
├── forbidden tracked/runtime artifact policy
├── macOS and Linux package contract files
├── fixed manifest/checksum presence
└── scalar pass/fail output
```

The full gate then runs from both the task checkout and a disposable exact Git
archive. The final assessment joins those results with hosted Ubuntu evidence
and explicit manual/provider availability checks. Every row is `pass`, `fail`,
`blocked`, `not_applicable`, or `not_run`; no score or inferred readiness is
used.

If any mandatory publication gate is failed or blocked, the release class
remains Development snapshot and the decision is `NO-GO`. This completes the
audit but does not publish, tag, sign, notarize, expose, or otherwise mutate an
external release boundary.

## Architecture and boundaries

### Modules touched

- `scripts/release-preflight.mjs`: bounded read-only candidate checks and
  scalar JSON/text result.
- `scripts/release-preflight.test.mjs`: target/status/inventory fixture tests.
- `package.json`: one `release:preflight` command.
- `docs/execution/release-readiness-assessment.md`: exact decision matrix.
- Release/status/security/operations/roadmap/changelog documents.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: no application protocol command; one developer-owned
  preflight CLI.
- Idempotency: preflight reads fixed repository metadata and creates no
  persistent state.
- Migration: none.

### Protocol changes

- None. Protocol remains 24.

### Authorization and privilege

- Preflight has no network, browser, shell-control, Tailscale, signing,
  keychain-write, or application-state authority.
- Clean staging runs existing repository scripts inside a generated temporary
  directory with current-user privileges.
- Live external checks remain read-only unless the owner separately authorizes
  an exact mutation; PC-076 does not infer that authority.

## Sequence

1. Commit the PC-076 issue and plan separately.
2. Implement and test the bounded release preflight in small commits.
3. Commit a candidate evidence/limitations matrix template.
4. Run preflight, full verification, soak, package, and Chromium gates.
5. Create a disposable exact-source archive; frozen-install and rerun supported
   macOS gates without working-tree output.
6. Run dependency, tracked-secret, package-inventory, and boundary audits.
7. Inspect exact Ubuntu workflow evidence for the final candidate.
8. Record real external/manual gate availability and the GO/NO-GO decision.
9. Synchronize all source-of-truth documentation and close PC-076.
10. Push the task branch, require exact-head green evidence, fast-forward
    `dev`, push, and stop at the roadmap boundary.

## Failure model

| Failure point                        | Expected state                                | Recovery                                    |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------- |
| Wrong host/runtime                   | preflight fails before release commands       | use an exact ADR-0017 supported target      |
| Dirty or moving candidate            | preflight fails with scalar code              | commit intended evidence and rerun          |
| Forbidden tracked/runtime artifact   | preflight fails without printing content      | remove artifact from candidate and rerun    |
| Frozen install/native build fails    | candidate is NO-GO                            | repair dependency/toolchain and rerun       |
| Test/package/browser/soak gate fails | candidate is NO-GO; existing installs survive | repair bounded cause and rerun              |
| Dependency/secret audit fails        | candidate is NO-GO                            | remediate or explicitly reject candidate    |
| Signing/notarization unavailable     | publication gate is blocked                   | owner provisions identity/profile later     |
| Clean macOS account unavailable      | clean-account row is blocked                  | owner supplies disposable supported account |
| Serve/grants/remote user unavailable | remote-mode publication row is blocked        | owner authorizes exact tailnet canary later |
| Manual/provider reviewer unavailable | corresponding row is blocked                  | run with real reviewer/account later        |
| Hosted runner infrastructure failure | evidence is not green                         | bounded rerun; never skip required gate     |

## Compatibility

- Supported hosts: Apple-silicon macOS and Ubuntu 24.04 x64 only.
- Runtime: Node.js 24.18.x; pnpm 11.17.0.
- Fallback behavior: a blocked release leaves verified development packages
  available within their existing boundaries.
- Rollback: reinstall an earlier matching archive; no state migration occurs.

## Test plan

- Unit: pure preflight validation and hostile inventory/status fixtures.
- Property/fault: bounded paths/counts, symlink/forbidden pattern, missing
  contract, and malformed scalar inputs.
- Contract: existing strict package manifest/checksum/protocol/state suites.
- Integration: exact-source frozen install, full verify, real PTY, package
  install/upgrade/uninstall.
- Browser: complete Chromium suite on supported macOS and applicable Ubuntu
  runner.
- Security: package inventory, audit, secret patterns, loopback/Origin/token,
  terminal/path/queue/diagnostics boundaries.
- Performance: bounded lifecycle soak and existing browser-model load tests.

## Documentation changes

- Candidate assessment, known limitations, rollback and release class.
- STATUS, ROADMAP, implementation backlog, Milestone 5, release/security
  checklists, operator runbook, and changelog.
- PC-076 issue/plan completion evidence.

## Rollout

- Development: assessment branch only.
- Integration: exact-head green branch fast-forwarded into `dev`.
- Canary: existing package/clean-staging and hosted Ubuntu gates only.
- Production: none if decision is NO-GO; no publication action is implied.

## Open questions

- None. The matrix handles unavailable external/manual evidence explicitly.

## Approval

- Product: owner explicitly instructed completion of PC-076 and the remaining
  roadmap.
- Architecture: a read-only audit does not change ADR-0013 through ADR-0017.
- Security: missing external authority blocks release rather than broadening
  the task.
