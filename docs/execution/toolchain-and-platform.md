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

- `node-pty` `1.1.0`.
- `@xterm/xterm` `6.0.0`.
- `@xterm/headless` `6.0.0`.
- `@xterm/addon-serialize` `0.14.0`.

The first implementation spike must confirm that xterm headless plus serialization is sufficient for bounded browser reconnection. If it is not, change only the restoration implementation, not the PTY/session contract.

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

`node-pty` may require the supported native build toolchain. The clean-install test must run on a fresh supported macOS account and document the exact prerequisite. The current development machine must accept the Xcode license before Git and native-module verification can be considered reproducible.

## Upgrade policy

- Runtime major upgrades require explicit compatibility verification.
- Terminal-runtime dependency upgrades require PTY and browser regression tests.
- Patch upgrades remain intentional and lockfile-reviewed.
- Do not use floating `latest` ranges in committed manifests.
