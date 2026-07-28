# PC-076 release-readiness assessment

## Decision

- Decision: **NO-GO**
- Release class: **Development snapshot**
- Assessed implementation candidate:
  `030da051aaf567008998d2b7fccaa3f2a28bba6f`
- Candidate branch: `codex/release-readiness`
- Base: `07bba5b58254f1c58815cccb625b92c5df1e261a`
- Assessment date: 2026-07-28
- Supported targets: Apple-silicon macOS 14 or newer and Ubuntu 24.04 x64
- Runtime: Node.js 24.18.x and pnpm 11.17.0
- Protocol: 24

PC-076 is complete when this evidence is integrated, even though the release
decision is `NO-GO`. No tag, release, signing request, notarization submission,
tailnet change, provider prompt, or publication is authorized or performed.

## Vocabulary

- `pass`: reproduced evidence meets the stated bounded gate.
- `fail`: reproduced evidence contradicts the gate.
- `blocked`: the gate requires authority, identity, environment, or human
  evidence that is unavailable.
- `not_applicable`: the gate does not apply to this release class or target.
- `not_run`: the gate was deliberately not executed and is not inferred.

Any mandatory publication row that is `fail`, `blocked`, or `not_run` forces
`NO-GO`.

## Automated evidence

| Gate                                    | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source identity and hygiene             | pass    | `release:preflight` accepted clean commit `030da051aaf567008998d2b7fccaa3f2a28bba6f`, 560 tracked files, 21 required contracts, supported `darwin-arm64`, Node 24.18.0, and the exact package inventory. The final integrated head is checked again after documentation-only closure.                                                                                                                                 |
| Preflight failure boundaries            | pass    | Nine unit cases reject foreign hosts/runtimes, dirty or forbidden source, unsafe archive paths, mismatched targets/layouts, duplicate paths, and unsupported release claims with scalar errors.                                                                                                                                                                                                                       |
| Exact-source frozen install             | pass    | A Git archive of `db7838abd937d8c4bc1bc001bcd02951cd7c34e2` installed 192 packages with `--frozen-lockfile`, verified all 296 lockfile policy entries, and built patched `node-pty` from source without inherited build output.                                                                                                                                                                                       |
| Repository verification                 | pass    | The isolated archive passed formatting, lint, all workspace type checks, 142 test files and 930 tests, and both production builds.                                                                                                                                                                                                                                                                                    |
| macOS native reproducibility            | pass    | Separate checkout roots produced byte-identical loadable binaries: `pty.node` SHA-256 `50d506c692c05c2037450b88f550ff0ba9ea1aed0b4f2e15b9b2ad529a237ea3`; `spawn-helper` SHA-256 `5f581b5794183c8783108fbdff0f570de48cab0a91506ee27048f310e6a25c2d`. The build strips source/debug symbols while retaining one Mach-O UUID and ad-hoc signature required by macOS.                                                    |
| macOS package                           | pass    | Both roots reproduced a 573,683-byte `pacium-control-0.0.0-darwin-arm64.tar.gz`, SHA-256 `923fe2f41533eee7c8591999002d783212e679545e959aca6ceba8d96415075c`, with 28 manifested files. Native PTY, install/upgrade, production health/assets, exact-instance reuse, active-uninstall refusal, idempotent uninstall, and external-state preservation passed.                                                           |
| macOS lifecycle soak                    | pass    | The clean archive exercised 20 idle sessions, 100 create/close cycles, 8 MiB output, 100 snapshots, and five real PTYs in 3,440 ms. Peak and retained RSS delta were 139,804,672 bytes, retained heap delta 5,344,976 bytes, final sessions zero, and file descriptors returned 18 to 18 within fixed budgets.                                                                                                        |
| Chromium workflows                      | pass    | The implementation candidate passed all 20 workflows in 59.7 seconds. Coverage includes terminal focus/reconnect, tmux, Pacium mode, queue and provider degradation, Git evidence, verification run/reload/cancel, diagnostics, 320 CSS px, 200% zoom, forced colors, reduced motion, and keyboard focus. A clean-archive failure exposed and fixed one checkout-dependent verification fixture before the full pass. |
| Ubuntu 24.04 x64 candidate              | pass    | Workflow run `30344552023`, job `90227594309`, passed at exact commit `030da051aaf567008998d2b7fccaa3f2a28bba6f` in 3m26s. Frozen source-native install, 142 files/931 passing tests plus one platform skip, production build, package verification, release preflight, 18 applicable Chromium workflows plus two tmux capability skips, and short-retention artifact upload were green.                              |
| Linux package candidate                 | pass    | The exact runner reproduced a 584,044-byte archive, SHA-256 `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`, with 27 manifested files and 44 archive entries. Native PTY and installed-package lifecycle passed; the manifest marks it unsigned, non-distro-native, and not release-eligible.                                                                                                      |
| Linux lifecycle soak                    | pass    | The candidate completed in 2,024 ms with 151,912,448-byte peak RSS delta, 151,470,080-byte retained RSS delta, 5,195,280-byte retained heap delta, zero final sessions, and file descriptors returning 32 to 32 within fixed budgets.                                                                                                                                                                                 |
| Boundary security tests                 | pass    | The 930-test clean-source suite covers loopback binding, Host/Origin/token enforcement, bounded messages, terminal content, canonical paths and symlinks, queue-as-data behavior, diagnostics redaction, package ownership, process groups, reconnect ordering, and state schemas.                                                                                                                                    |
| Tracked secret signatures               | pass    | A content-suppressing local scan found zero private-key, AWS access-ID, GitHub token, Claude/OpenAI key, or live Stripe key signatures and zero tracked non-example environment files.                                                                                                                                                                                                                                |
| Package inventory and state exclusion   | pass    | Preflight, strict manifests, archive inventories, and package canaries exclude `.git`, environments, credentials, transcripts, queues, provider stores, repositories, Pacium state, host identity, and unbounded output.                                                                                                                                                                                              |
| Dependency lock and supply-chain policy | pass    | Frozen installation verified all 296 lockfile entries against the repository policy; dependencies and toolchains remain exactly pinned.                                                                                                                                                                                                                                                                               |
| Current registry advisory audit         | not_run | Querying a registry audit endpoint would disclose the project dependency inventory. Destination-specific authorization was unavailable, so no outbound audit was sent and no clean advisory claim is made.                                                                                                                                                                                                            |

Two earlier PC-076 runs failed closed in the new preflight after every
preceding repository, soak, and package gate passed. They exposed an incorrect
Ubuntu `VERSION`/`VERSION_ID` choice and an incorrect Linux manifest path. Both
contracts gained regression tests before the exact candidate run passed. The
final integrated SHA belongs in the integration handoff so this assessment
does not pretend a self-referential commit can name itself.

## External and manual evidence

| Gate                                        | Status  | Observed boundary and required next authority                                                                                                                                                                                                         |
| ------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh supported macOS account               | blocked | The isolated Git archive proves clean source, not a fresh operating-system account. An owner-provided disposable Apple-silicon account with Xcode license acceptance must run install and the core workflow.                                          |
| Developer ID signing                        | blocked | `security find-identity -v -p codesigning` reported zero valid identities. The owner must provision and authorize a Developer ID Application identity.                                                                                                |
| Apple notarization and quarantine           | blocked | There is no signed artifact or notarization authority. Sign, submit, staple, download through the intended channel, and exercise Gatekeeper on a clean account.                                                                                       |
| Real Tailscale Serve boundary               | blocked | Tailscale was Running with the current device online and six observed peers, but Serve reported zero TCP and zero Web entries. An owner must authorize exact Serve, grants, allowlist, remote-device, Funnel/public/LAN denial, and revocation tests. |
| Real Claude Code canary                     | blocked | Claude Code 2.1.206 is installed, but no real account-backed prompt/status canary was authorized. Fixture/integration evidence is not promoted.                                                                                                       |
| Real Codex canary                           | blocked | codex-cli 0.145.0 is installed, but no real account-backed App Server/session canary was authorized. Fixture/integration evidence is not promoted.                                                                                                    |
| Manual screen-reader review                 | blocked | Automated names, landmarks, focus, forced colors, reduced motion, zoom, and narrow layout passed; VoiceOver or another supported screen reader was not manually exercised.                                                                            |
| Manual visual and terminal-lifecycle review | blocked | No owner-reviewed visual pass or complete type/refresh/close/restart workflow was recorded on a fresh account.                                                                                                                                        |
| Sustained personal-use pilot                | blocked | The bounded soak is not multi-day use. No daily-use duration, recovery diary, or accepted pilot criterion exists.                                                                                                                                     |
| Owner release acceptance                    | blocked | The owner authorized finishing the roadmap audit, not publication or acceptance of a release artifact.                                                                                                                                                |

## Release limitations

- Both packages are unsigned development archives with external Node.js
  24.18.x. The macOS archive is unnotarized; the Linux archive is not
  distro-native.
- Supported hosts are exactly Apple-silicon macOS 14 or newer and Ubuntu 24.04
  x64. No other host, distribution, version, or architecture is implied.
- Direct PTYs end with the local server. Browser refresh preserves them;
  local-server restart does not. Optional configured tmux targets can survive.
- Provider-native integrations and optional Tailscale behavior have automated
  fixtures but no current real-account or real-tailnet acceptance.
- There is no database, multi-user authorization, multi-host control, public
  deployment, auto-update channel, telemetry, or generalized workflow engine.

## Rollback and preservation

There is no published release to roll back. If a development package must be
removed, stop its exact running instance and use the matching package
uninstaller. It removes only the recognized application tree and owned command
link. Pacium metadata, repositories, queue files, provider stores, and external
tmux targets remain outside package ownership.

Pause any future release attempt when source identity moves, a package hash or
inventory changes unexpectedly, a security boundary fails, duplicate terminal
input or decisions occur, state preservation fails, a native PTY cannot load,
remote access exceeds the exact allowlist, or signing/notarization evidence is
unavailable.

## Path to a future GO

1. Obtain explicit authority for a current dependency advisory audit and
   resolve any report.
2. Run the exact final branch on the pinned Ubuntu workflow.
3. Provision a Developer ID identity; sign, notarize, staple, deliver, and
   validate quarantine on a fresh supported macOS account.
4. Authorize and execute the real Tailscale Serve/grants/revocation matrix.
5. Run real Claude Code and Codex canaries without exposing prompts or tokens.
6. Complete manual screen-reader, visual, full terminal-lifecycle, and
   sustained-use acceptance.
7. Obtain an explicit owner release decision on the resulting immutable
   artifacts and hashes.

Until every mandatory row passes, Pacium remains a working but unpublished
development snapshot.
