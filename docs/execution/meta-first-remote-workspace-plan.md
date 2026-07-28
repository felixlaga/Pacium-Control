# Implementation plan: Meta-first remote workspace

- Issue: [PC-079](meta-first-remote-workspace-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `dev`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `9072034d810ab49fdec14772b92c0ae904f321bc`
- Target milestone: Owner-directed post-roadmap usability slice
- Status: Complete; real owner-environment canary remains external

## Objective

Turn the accepted Tailscale Serve plus local tmux primitives into the owner's
actual daily path: opening the remote page lands in one exact Meta terminal.
Remove the redundant prompt-target composer and reduce Pacium chrome without
adding browser-driven SSH, generic command authority, or multi-host behavior.

## Existing behavior

- ADR-0016 and PC-077 already provide exact Tailscale Serve request identity
  while the application remains loopback-bound.
- PC-070 can discover and explicitly attach one exact published tmux target.
- PC-071 restores only Pacium-created keep-alive targets automatically.
- A browser session list selects a retained tab or first session, but the
  server does not publish an exact preferred Meta session.
- Pacium mode renders a workspace summary, two tall role cards, worker evidence
  cards, verbose queue evidence, and a separate explicit-target prompt
  composer below the terminal.

## Proposed behavior

`PACIUM_META_TMUX_SESSION=meta` opts into one bounded server-owned startup
target and requires `PACIUM_TMUX_SOCKET`. The server discovers the configured
tmux server, matches the exact name, attaches by the adapter-published ID, and
publishes only strict capability state plus the resulting immutable Pacium
session ID.

The browser uses that exact ID once during initial session reconciliation. It
opens the tab, selects the session, switches to Pacium presentation, collapses
secondary panels, and focuses the terminal. It does not infer Meta from a
display name and does not continuously override later user navigation.

The prompt composer and its App state are removed. Pacium secondary surfaces
become compact list rows with concise visible copy; detailed evidence remains
in the existing inspectors, accessible names, and titles.

## Architecture and boundaries

### Modules touched

- `apps/local-server/src/config.ts`: strict optional Meta tmux name.
- `apps/local-server/src/session-manager.ts`: exact startup attach and
  deduplicated capability projection.
- `apps/local-server/src/index.ts`: one bounded startup attempt.
- `packages/contracts/src/tmux.ts` and `protocol.ts`: protocol-25 capability.
- `apps/web/src/app.tsx`: one-shot exact Meta focus and simplified rendering.
- Pacium summary/role/worker/queue semantic components and `styles.css`.
- Focused unit, integration, semantic, and Chromium tests.
- README, status, security/operations, backlog, changelog, issue, and plan.

### Data/state changes

- Entity/schema changes: none in `pacium.json`, `queue-state.json`, browser
  preferences, tabs, or relaunch manifests.
- Commands/events: no new browser command; welcome gains Meta capability.
- Idempotency: SessionManager reuses an active client for the same exact tmux
  target during one process.
- Migration: protocol 24 clients fail their existing version check and must
  reload the matching protocol-25 web bundle.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 24 to 25.
- Add strict `MetaSessionCapability`:
  - `unconfigured` and `unavailable` have no session ID;
  - `ready` has exactly one immutable Pacium session ID;
  - all states have bounded operational detail.
- Add capability to authenticated `server.welcome` and refreshed
  `session.list` responses so a recovered exact target can be selected without
  accepting target input from the browser.

### Authorization and privilege

- Startup environment, never the browser, supplies the exact tmux name.
- Existing tmux adapter owns executable, socket, list format, timeout,
  revalidation, and attach argv.
- Existing Local/Tailscale request authority and token checks are unchanged.
- No code invokes SSH, Tailscale login, Serve configuration, or grants.

## Sequence

1. Commit issue and plan before implementation.
2. Add strict Meta configuration and capability contracts.
3. Add deduplicated exact-name startup attachment and failure states.
4. Publish protocol-25 capability and focused server/transport tests.
5. Add a pure one-shot initial Meta focus model and App integration.
6. Remove the prompt composer and simplify Pacium semantic components/styles.
7. Add browser coverage for initial focus, reconnect, operator override,
   responsive density, and unavailable fallback.
8. Synchronize active docs and exact deployment instructions.
9. Run focused tests, `pnpm verify`, real tmux coverage, and `pnpm test:e2e`.

## Failure model

| Failure point                         | Expected state                              | Recovery                                            |
| ------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| Meta name without tmux socket         | Startup rejected before listening           | Configure both or remove Meta value                 |
| tmux unavailable                      | Pacium starts; Meta capability unavailable  | Restore tmux/socket and restart Pacium              |
| exact name absent                     | No client created; ordinary workspace works | Start the intended tmux target, then restart        |
| target disappears during revalidation | No Pacium session claimed                   | Inspect tmux and restart after recovery             |
| browser reload                        | Existing Pacium Meta client reused          | Automatic terminal transport reconnect              |
| operator selects another session      | Selection remains user-owned                | Choose Meta explicitly to return                    |
| Tailscale authorization fails         | Generic forbidden/reconnecting state        | Repair Serve/grant/login config; host tmux survives |

## Compatibility

- Supported versions: protocol 25, Node.js 24.18.x, existing fixed tmux
  adapter, Tailscale Serve contract in ADR-0016.
- Fallback behavior: without `PACIUM_META_TMUX_SESSION`, existing explicit tmux
  and ordinary terminal behavior remains available.
- Rollback: remove the environment value and revert the web bundle with its
  matching protocol; no state or tmux cleanup.

## Test plan

- Unit: config matrix, capability relations, exact match, deduplication,
  one-shot browser focus, compact semantic output.
- Property/fault: controls/empty/oversized tmux names, missing/multiple session
  observations, ended client, late browser session list.
- Contract: protocol-25 strict parse/rejection and no extra authority fields.
- Integration: isolated real tmux session named `meta`, startup attach, input,
  refresh snapshot, one active client.
- Browser: Meta selected and focused, panels collapsed, composer absent,
  deliberate later session selection retained, unavailable fallback,
  320 CSS px, 200% zoom, forced colors, reduced motion.
- Security: unchanged Host/Origin/login/token tests; browser target/SSH/socket
  fields rejected; exact fixed tmux argv.
- Performance: one startup discovery/attach only; no polling or background SSH.

## Documentation changes

- Add the four required environment values and one Serve command to the active
  remote runbook.
- Explain that Tailscale SSH check mode and Serve browser access are different:
  Pacium does not automate SSH.
- Replace active claims about the removed composer with direct Meta terminal
  input and record the compact focused view.
- Keep the real tailnet/tmux owner canary explicitly unverified until run.

## Rollout

- Development: fake adapter and semantic tests.
- Integration: isolated local real-tmux canary.
- Canary: real `felix-harness` with disposable verification before the
  production Meta session is trusted.
- Production: no release claim; Development snapshot only.

## Open questions

- None for implementation. Deployment values remain owner-controlled.

## Verification

- `pnpm verify`: passed formatting, lint, workspace type checks, 140 test files
  and 911 tests, and production builds.
- Focused config/contract/session/real-tmux/browser-model suite: 4 files and 33
  tests passed.
- `pnpm test:e2e`: 20 ordinary Chromium workflows passed; the opt-in
  Meta-focus workflow was skipped by design.
- `PACIUM_E2E_META_FOCUS=1 pnpm exec playwright test
tests/e2e/meta-session-focus.spec.ts`: passed the isolated existing-tmux
  terminal focus, input, refresh, and one-session canary.
- Verification ran under Node.js 26.4.0 because the required Node.js 24.18.x
  runtime is not installed in this workspace. The engine warning remains an
  explicit environment limitation.
- The live `felix-harness` Tailscale Serve/grants/login and existing `meta`
  session canary was not run.

## Approval

- Product: explicitly authorized by the owner in this request.
- Architecture: same-host optional tmux and Tailscale Serve remain within
  ADR-0013 and ADR-0016.
- Security: exact server-owned target, no SSH/browser command authority, and no
  new credential storage.
