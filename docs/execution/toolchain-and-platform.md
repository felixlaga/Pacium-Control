# Initial toolchain and platform decision

- Status: Approved default for the first build
- Recorded: 2026-07-26
- Review point: after the first real-terminal slice

## Platform

The first supported platform is **macOS on Apple silicon**.

Linux compatibility should be preserved where it does not complicate the first slice, but Linux is not a release gate until Milestone 5. Windows is out of initial scope.

## Runtime and package manager

- Node.js `24.18.x` LTS.
- pnpm `11.17.0` through the root `packageManager` field.
- pnpm workspaces.
- Exact dependency versions committed in `pnpm-lock.yaml`.

Node.js 26 is current rather than LTS on the decision date and is not the project runtime even if it is installed on a development machine.

## Application stack

### Browser

- React `19.2.8`.
- Vite `8.1.5`.
- `@vitejs/plugin-react` `6.0.4`.
- TypeScript `6.0.3`.
- Plain CSS with shared CSS custom-property tokens and locally scoped component styles.
- No global state library or router is required for the first terminal slice.

TypeScript 7 is not selected because the current `typescript-eslint` release declares support only below TypeScript 6.1.

### Local server

- Node.js built-in HTTP server.
- `ws` `8.21.1` for WebSocket transport.
- `zod` `4.4.3` for shared runtime contract validation.
- No Express, Fastify, database, ORM, or dependency-injection framework.

### Terminal

- `node-pty` `1.1.0` with the committed Pacium macOS descriptor-cleanup patch.
- `@xterm/xterm` `6.0.0`.
- `@xterm/headless` `6.0.0`.
- `@xterm/addon-serialize` `0.14.0`.

The implemented headless terminal plus serialization boundary provides bounded
browser reconnection. The production macOS bundle statically includes its
xterm, WebSocket, validation, and shared-contract JavaScript; only patched
`node-pty` remains a packaged native runtime dependency.

### Testing and quality

- Vitest `4.1.10`.
- Playwright `1.62.0`.
- ESLint `10.8.0`.
- `typescript-eslint` `8.65.0`.
- Prettier `3.9.6`.

## Package layout

```text
apps/
  web/
  local-server/
packages/
  contracts/
  terminal-ui/
  test-utils/
```

Add another package only when two real consumers justify the boundary.

## UI implementation rule

Build original Pacium components from semantic HTML, CSS tokens, and small local primitives. Introduce an external component primitive library only for a concrete accessibility-heavy control that would otherwise be reimplemented poorly.

The first shell must establish:

- neutral light and dark palettes;
- 4 px spacing grid;
- compact typography and control sizes;
- sidebar, terminal canvas, and inspector layout;
- focus, selection, hover, attention, failure, and connection tokens.

## Native-build requirement

Pacium compiles its patched `node-pty` sources on macOS rather than using the
upstream prebuilt binary. Node.js `24.18.x`, Xcode command-line build tools, and
an accepted Xcode license are therefore required. The patch closes the
parent-side slave PTY, process-watcher kqueue, and temporary low-number PTY
descriptors found by PC-072. PC-074 packages and executes that arm64 native
module from an isolated install. A fresh supported macOS account with accepted
Xcode license remains a PC-076 release-evidence gate rather than a claim from
the current development machine.

## macOS package boundary

- `pnpm package:macos` emits one deterministic-content unsigned/unnotarized
  `darwin-arm64` archive plus SHA-256 checksum.
- Node.js is not redistributed. The fixed launcher accepts one absolute
  `PACIUM_NODE_BINARY` or a common fixed installation path and enforces
  24.18.x.
- `pnpm package:macos:verify` rebuilds deterministically, validates its strict
  manifest, installs/upgrades in a generated temporary destination, loads and
  drives the packaged native PTY, starts the production server, and proves
  state-preserving uninstall.
- Developer ID signing and notarization are mandatory before a release can be
  declared.

## Upgrade policy

- Runtime major upgrades require explicit compatibility verification.
- Terminal-runtime dependency upgrades require PTY and browser regression tests.
- Patch upgrades remain intentional and lockfile-reviewed.
- Do not use floating `latest` ranges in committed manifests.
