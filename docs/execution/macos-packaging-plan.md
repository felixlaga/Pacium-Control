# Implementation plan: macOS application packaging

- Issue: PC-074
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/macos-packaging`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `4ee3e6c`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: Complete

## Objective

Turn the verified production bundles into one installable user-local
Apple-silicon macOS application plus `pacium` command, with deterministic
contents, explicit Node/Xcode prerequisites, safe upgrade/uninstall behavior,
real packaged-native-PTY evidence, and honest unsigned/unnotarized status.

## Existing behavior

- `pnpm build` emits `apps/local-server/dist/index.js` and
  `apps/web/dist/**`; the server locates the web build through their current
  relative layout.
- The server binds only to `127.0.0.1`, uses port 4174 by default, and does not
  open a browser.
- `node-pty` is the only external runtime dependency of the bundled server. The
  installed workspace copy contains patched source-built
  `build/Release/pty.node` and `spawn-helper`.
- `pnpm start` requires the repository and its installed dependencies.
- Default durable state already lives under
  `~/Library/Application Support/Pacium Control`; no package operation owns
  that directory.
- No root packaging script, application bundle, installer, uninstaller,
  checksum, signing decision, or package canary exists.

## Proposed behavior

`pnpm package:macos` first performs the ordinary production build, validates
macOS arm64 and Node 24.18.x, then stages:

```text
Pacium Control.app/
└── Contents/
    ├── Info.plist
    ├── MacOS/pacium-control
    └── Resources/app/
        ├── apps/local-server/dist/package-launcher.js
        ├── apps/local-server/dist/index.js
        ├── apps/local-server/node_modules/node-pty/
        ├── apps/web/dist/
        └── package-manifest.json
install.sh
uninstall.sh
INSTALL.md
```

The archive does not bundle Node. The launcher selects
`PACIUM_NODE_BINARY` only when it is one absolute executable, otherwise tries
fixed Homebrew/system candidates, and the JavaScript entry enforces Node
24.18.x. Finder and CLI launch share the same foreground local-server process.
The package augments common user-local provider CLI paths and defaults new
terminals to the canonical home directory without replacing explicit operator
environment settings.

The package entry probes the fixed loopback health signature before importing
the server. A verified existing instance opens the fixed URL and exits. A new
instance opens the browser only from the server’s listening callback.
`--no-open` supports package verification and foreground troubleshooting.

## Architecture and boundaries

### Modules touched

- `apps/local-server/src/browser-launch.ts`: fixed macOS browser action and
  unit tests.
- `apps/local-server/src/package-launcher.ts`: bounded package CLI,
  supported-runtime check, existing-instance probe, and tests.
- `apps/local-server/src/index.ts`: invoke browser action only after listen.
- `apps/local-server/src/http-server.ts`: fixed health signature header.
- `apps/local-server/tsup.config.ts`: emit server and package-launcher entries.
- `packaging/macos/build.mjs`: validate and stage fixed package contents,
  manifest, deterministic archive, and checksum.
- `packaging/macos/install.sh`, `uninstall.sh`, and `INSTALL.md`: user-local
  lifecycle.
- `packaging/macos/verify.mjs`: isolated install/upgrade/server/native-PTY/
  uninstall canary.
- Root scripts, ignore rules, tests, and synchronized documentation.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: local `pacium [--no-open|--help|--version]`; fixed
  `/usr/bin/open <loopback-url>` after readiness.
- Idempotency: exact staging and archive contents; installer can replace the
  same owned bundle; verified running instance is reused.
- Migration: none. Package code and application state remain separate.

### Protocol changes

- WebSocket `PROTOCOL_VERSION` remains 24.
- `/api/health` retains `{status:"ok"}` and adds one fixed
  `x-pacium-protocol: 24` header for local existing-instance recognition.
- No browser-supplied path, executable, command, install, update, or lifecycle
  operation is introduced.

### Authorization and privilege

- Runtime Host/Origin/token/Tailscale behavior is unchanged.
- Installer/uninstaller run without sudo and accept only absolute non-root
  destination directories.
- Symlink/foreign-target checks precede replace or removal.
- The package verifier operates only in a generated temporary directory.

## Sequence

1. Commit this issue and plan separately.
2. Add and test fixed browser-launch and package-entry behavior.
3. Emit both production server entries and add the health signature.
4. Add the bundle builder and deterministic content manifest.
5. Add safe install/upgrade/uninstall scripts and focused shell tests.
6. Add the isolated package verifier with real packaged native PTY and
   production server/static-asset canaries.
7. Run package, focused, clean-staging, full verify, and Chromium gates.
8. Synchronize operator/security/release evidence and signing limitations.
9. Mark PC-074 complete, fast-forward `dev`, and push before PC-075.

## Failure model

| Failure point                         | Expected state                                                | Recovery                                       |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Wrong OS/architecture/Node            | package or launch fails before starting Pacium                | install supported Node 24.18.x on macOS arm64  |
| Production build or PTY helper absent | no partial archive                                            | reinstall/build from the pinned lockfile       |
| Existing exact Pacium server          | browser opens existing loopback URL; second owner exits       | use existing workspace                         |
| Foreign process occupies port         | no browser trust and new server reports `EADDRINUSE`          | stop/change the foreign service or port        |
| `/usr/bin/open` fails                 | server and PTYs continue; bounded error is reported           | open the printed fixed URL manually            |
| Unsafe/foreign install target         | installer/uninstaller refuses before changing it              | choose an empty owned destination              |
| Upgrade move fails                    | staged bundle removed and prior bundle restored               | rerun installer or reinstall prior archive     |
| Uninstall with active server          | script refuses until the operator stops the foreground server | stop with Ctrl-C, then uninstall               |
| Unsigned package crosses quarantine   | Gatekeeper may refuse it; no release claim                    | local build or future signed/notarized release |

## Compatibility

- Supported versions: macOS Apple silicon, Node.js 24.18.x, pnpm 11.17.0,
  Xcode command-line tools and accepted license at build time.
- Fallback behavior: `PACIUM_NODE_BINARY` selects one explicit supported Node
  executable; provider CLIs remain optional and honestly unavailable off PATH.
- Rollback: reinstall a previous archive. Existing versioned state remains
  external and untouched.

## Test plan

- Unit: supported runtime, args, port/URL, health probe, browser executable/argv
  and failure.
- Property/fault: control/relative Node paths, unsupported versions, malformed
  ports, extra CLI args, hostile manifest/path canaries.
- Contract: health body unchanged, fixed protocol header, Local/Tailscale
  authority unchanged.
- Integration: deterministic package tree, modes, architecture, native module
  load/helper spawn/input/resize/exit, install, upgrade, health/assets,
  uninstall, state sentinel preservation.
- Browser: existing 20 Chromium workflows remain green; no package UI contract
  changes.
- Security: no unsafe install path, foreign symlink/bundle/link removal,
  machine-path/secret scan, state-directory access, non-loopback bind, or
  unsigned release claim.
- Performance: record archive/unpacked bytes and file count; no background
  updater or resident wrapper is added.

## Documentation changes

- README packaged use.
- macOS install/upgrade/uninstall and signing runbook.
- Toolchain/platform and deployment topology.
- STATUS, backlog, Milestone 5, risk/security/release checklist, and changelog.

## Rollout

- Development: source-built local unsigned package and isolated temporary
  install.
- Integration: installed production server plus real native PTY canary.
- Canary: user-local `~/Applications` only after isolated verification.
- Production: none. Developer ID signing/notarization and PC-076 owner
  acceptance remain mandatory.

## Open questions

- None.

## Approval

- Product: authorized by the owner’s instruction to continue PC-074 and the
  remaining roadmap.
- Architecture: external supported Node keeps the package small and preserves
  the accepted one-process localhost/PTy architecture.
- Security: user-local no-sudo lifecycle, fixed executable/URL, exact owned
  targets, state preservation, and honest unsigned status.

## Completion evidence

- Supported Node.js 24.18.0 `pnpm verify` passed formatting, lint, all workspace
  type checks, 140 test files and 910 tests, and the production builds.
- `pnpm package:macos:verify` deterministically reproduced
  `pacium-control-0.0.0-darwin-arm64.tar.gz` at 576,781 bytes with SHA-256
  `c19403a7ff7dee64fbb63ce3f3566763552eb0e762b2d284a7327194843f7c92`
  and 28 manifested files.
- The isolated installed artifact passed arm64 native PTY
  load/Unicode/resize/exit, install/upgrade, health/static assets, exact-instance
  reuse, active-uninstall refusal, idempotent uninstall, and
  state/repository/provider/tmux preservation.
- All 20 Chromium workflows passed.
- `codesign` and the version-1 manifest both report the artifact as unsigned,
  unnotarized, and not release-eligible. PC-075 and PC-076 remain open.
