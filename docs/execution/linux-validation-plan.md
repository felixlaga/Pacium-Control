# Implementation plan: supported Ubuntu Linux path

- Issue: PC-075
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/linux-validation`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `29b0515c3e0070bb6a68274e731468f80ff40451`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: Complete

## Objective

Make Ubuntu 24.04 x64 a reproducible, evidence-backed second supported host
without generalizing beyond one Linux target or weakening the macOS,
loopback-only, direct-PTY, no-database, external-runtime architecture.

## Existing behavior

- macOS arm64 has a complete unsigned development-package gate.
- Runtime config defaults to `/bin/zsh` and a macOS application-data path.
- Host repository reveal already selects fixed `/usr/bin/xdg-open` on Linux,
  but browser opening and package runtime accept only darwin-arm64.
- Real PTY and soak fixtures still name `/bin/zsh`.
- The production server bundle is native-module-external and otherwise
  self-contained, which is suitable for a Linux package.
- No Linux builder, installer, verifier, workflow, or live evidence exists.
- This macOS host has no Docker, Podman, Lima, Colima, Multipass, or QEMU
  command available; a hosted Linux runner is required for honest evidence.

## Proposed behavior

The runtime chooses platform defaults without hiding operator configuration:

```text
macOS: /bin/zsh + ~/Library/Application Support/Pacium Control
Linux: /bin/bash + ${XDG_STATE_HOME:-~/.local/state}/pacium-control
```

The package launcher supports exactly darwin-arm64 or linux-x64 under Node
24.18.x. Browser opening remains a fixed platform action:
`/usr/bin/open <loopback-url>` on macOS and
`/usr/bin/xdg-open <loopback-url>` on Linux.

`pnpm package:linux` stages:

```text
pacium-control/
├── app/
│   └── apps/
│       ├── local-server/
│       │   ├── dist/
│       │   └── node_modules/node-pty/
│       └── web/dist/
├── bin/pacium
└── package-manifest.json
install.sh
uninstall.sh
INSTALL.md
```

The archive excludes Node and optional CLIs. Installation defaults to the XDG
user data/bin convention, retains the same exact process lease, and owns no
application state.

One pinned GitHub Actions Ubuntu 24.04 job performs a frozen source-native
install, full verify, soak, Linux package verification, Chromium installation,
and the applicable browser suite. It uploads only the Linux archive/checksum
as a short-retention development artifact if the complete job succeeds.

## Architecture and boundaries

### Modules touched

- `apps/local-server/src/config.ts`: platform shell/XDG state/default
  environment contract and tests.
- `apps/local-server/src/browser-launch.ts`: fixed per-platform opener.
- `apps/local-server/src/package-launcher-core.ts`: exact supported target
  matrix.
- `apps/local-server/src/package-launcher.ts`: target-neutral package errors.
- Real PTY, soak, and optional tmux integration fixtures: platform shell.
- `packaging/linux/**`: launcher, content builder, lifecycle scripts, verifier,
  guide, and focused build tests.
- `.github/workflows/linux-validation.yml`: immutable hosted evidence.
- Root scripts and synchronized product/architecture/security/operations docs.

### Data/state changes

- Linux default application-owned state path is versioned JSON under
  `$XDG_STATE_HOME/pacium-control` or `~/.local/state/pacium-control`.
- Existing explicit `PACIUM_DATA_DIR` remains authoritative and unchanged.
- No schema, migration, database, transcript, provider store, queue, or
  repository change.

### Protocol and lifecycle

- Protocol remains 24.
- Browser refresh/local-server/PTy/tmux behavior is unchanged.
- Linux install and runtime use the same exact instance-health and ephemeral
  lease contracts as macOS.
- An ended direct PTY remains honestly ended after foreground server exit.

### Authorization and privilege

- Server startup still accepts only `127.0.0.1`.
- CI receives read-only repository contents and no Pacium/provider/Tailscale
  credentials.
- Package actions accept fixed local files and absolute user-owned
  destinations only; no root/global install or arbitrary command surface.

## Sequence

1. Commit this issue and plan separately.
2. Record the exact supported Ubuntu x64 decision.
3. Add/test platform shell, XDG state, and child-environment defaults.
4. Extend/test the fixed opener and package runtime matrix.
5. Add the Linux application tree builder and content manifest.
6. Add safe Linux install/upgrade/uninstall and isolated package verifier.
7. Add the pinned Ubuntu workflow and push the feature branch.
8. Inspect exact remote Linux verify/soak/package/Chromium evidence.
9. Run complete supported macOS regression gates.
10. Synchronize evidence, mark PC-075 complete, fast-forward `dev`, and push.

## Failure model

| Failure point                         | Expected state                                     | Recovery                                      |
| ------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| Unsupported distro/arch/Node          | builder/launcher fails before starting Pacium      | use Ubuntu 24.04 x64 and Node 24.18.x         |
| `XDG_STATE_HOME` relative/unsafe      | startup fails before writing state                 | use an absolute dedicated directory           |
| Native source build/load fails        | Linux CI/package gate fails; no support claim      | fix native/toolchain boundary and rerun       |
| `xdg-open` absent/fails               | loopback server/PTys survive; fixed URL is printed | open the printed URL manually                 |
| Foreign process occupies port         | health is not trusted; listen fails without reuse  | stop foreign listener or choose another port  |
| Unsafe/foreign install target         | lifecycle script refuses before mutation           | select empty recognized user destinations     |
| Upgrade move/link fails               | staged tree removed and prior tree restored        | rerun or install an earlier archive           |
| Runner/browser dependency unavailable | remote gate fails explicitly                       | restore pinned runner dependency; do not skip |
| macOS regression                      | PC-075 remains open                                | repair shared contract before merge           |

## Compatibility

- Supported Linux: Ubuntu 24.04 x64 only.
- Supported macOS: Apple silicon, unchanged.
- Runtime: Node.js 24.18.x, pnpm 11.17.0.
- Linux shell fallback: `/bin/bash`; explicit existing absolute `SHELL` wins.
- Linux browser opener: optional fixed `/usr/bin/xdg-open`.
- Rollback: reinstall an earlier platform-matching archive; state is external.

## Test plan

- Unit/property: platform matrix, opener argv, XDG/default path normalization,
  malformed paths, manifest target/path/modes.
- PTY/integration: Linux real shell, input/Unicode/resize/exit/signals,
  source-built native load, process/FD cleanup.
- Package: deterministic tree/archive, install/upgrade/rollback structure,
  server/assets, exact reuse, active refusal, foreign target, uninstall
  preservation.
- Browser: complete existing Chromium suite where capabilities are present.
- Security: loopback/Origin/token unchanged, no broad package paths, no
  secrets/machine paths, immutable action dependencies.
- Regression: macOS full verify, package verify, and 20 Chromium workflows.

## Documentation changes

- Supported-platform decision and deployment topology.
- README and Linux package runbook.
- STATUS, backlog, Milestone 5, risk/security/release checklist, and changelog.
- PC-075 issue/plan completion evidence.

## Rollout

- Development: feature-branch Linux CI and downloadable short-retention
  artifact.
- Integration: exact commit pushed and complete hosted Ubuntu matrix green.
- Production: none. PC-076 owner acceptance remains mandatory.

## Open questions

- None.

## Approval

- Product: owner explicitly instructed completion of PC-075 and the remaining
  roadmap.
- Architecture: one x64 Ubuntu target is the smallest reproducible Linux
  boundary that satisfies the planned Milestone-5 review.
- Security: no new network, command, credential, persistence, or privilege
  authority.

## Verification

- Exact hosted implementation commit:
  `b261b0f6cfbfa5378008ea3cbf249dbfe7f514c4`.
- GitHub Actions run `30337769057` passed Ubuntu 24.04.4 x64 frozen
  source-native install, 141 test files/922 tests, production build, bounded
  lifecycle soak, deterministic Linux package verification, 18 applicable
  Chromium workflows with two optional-tmux workflows skipped, and
  short-retention artifact upload.
- The Linux archive is 584,044 bytes with 27 files and SHA-256
  `b5da9fadf2db663123be8bc2a3d888d8a7d18520bb00bfbeb83b067e8fb5f7ca`.
- The matching Apple-silicon gate passed 141 test files/922 tests, the
  577,087-byte/28-file macOS archive with SHA-256
  `51fe5527c272e44c5025270a3c829eed86fd35f639e4420159f712b3c2fb89dd`,
  and all 20 Chromium workflows.
- PC-075 is complete. PC-076 remains the sole roadmap task and no release claim
  is made here.
