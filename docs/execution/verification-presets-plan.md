# Implementation plan: Explicit verification presets

- Issue: [PC-037](verification-presets-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/verification-presets`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `b406dbcafddc68869e972f1f5d9e04e987733b39`
- Target milestone: Milestone 2
- Status: Complete

## Objective

Let the operator run a small server-owned catalog of repository verification
commands from the selected terminal's inspector, with a safe browser-to-process
boundary, honest lifecycle and commit association, bounded evidence, and no
effect on PTY ownership.

## Existing behavior

Protocol 8 lets the browser request canonical repository, changed-file,
one-file diff, and recent-HEAD evidence by selected session ID. Repository paths
and Git arguments remain server-owned. The local server already has an
allowlisted child environment and process-group lifecycle for PTYs, but it has
no verification configuration, runner, protocol, retained result, or UI.

## Proposed behavior

`PACIUM_VERIFICATION_CONFIG` optionally names one absolute local JSON file with
this versioned shape:

```json
{
  "version": 1,
  "repositories": [
    {
      "root": "/absolute/canonical/repository",
      "presets": [
        {
          "id": "verify",
          "label": "Project verification",
          "description": "Run the repository verification gate",
          "executable": "/absolute/path/to/pnpm",
          "args": ["verify"],
          "timeoutMs": 600000
        }
      ]
    }
  ]
}
```

The file is strict, byte/record/field bounded, regular, explicitly selected,
and outside each configured repository root. Repository roots and executables
must already exist and canonicalize at startup. At most 32 repositories and 16
presets per repository are accepted. Executables must be absolute; commands do
not use a shell and inherit only the existing Pacium environment allowlist.

Protocol 9 adds inspect, run, and cancel requests. Inspect returns the matching
catalog plus the active/latest run state. Run carries only request ID, session
ID, and preset ID. The session manager resolves current repository context and
the matching definition again, reserves one of two global run slots, freshly
observes HEAD, and starts the exact executable/arguments with repository root as
cwd. One session can have only one active verification run.

The runner creates an isolated process group, captures stdout and stderr
separately with fixed byte ceilings, and retains only UTF-8-safe,
control-normalized text. Every configured timeout is capped at ten minutes.
Cancel and timeout request group `SIGTERM`, wait at most two seconds, then use
`SIGKILL`; the result records whether force was required. Exit, signal, timeout,
cancellation, spawn failure, output truncation, duration, and fresh
start/completion HEAD observations are distinct evidence.

The server keeps active runs and one latest result per session in memory. It
broadcasts bounded snapshots on start, cancelling, and finish, so refresh can
inspect a run still owned by the same local-server process without replay.
Graceful server shutdown terminates active groups. A hard crash remains an
explicit unknown-process limitation and no browser state invents a result.

Checks becomes a lazy fourth inspector tab. It renders exact configured command
parts as text, asks for an explicit Run click, offers Cancel only for the
selected active run, and presents result/output bounds and HEAD changes. No
verification text becomes HTML, a link, a command, an approval, or terminal
input.

## Architecture and boundaries

### Modules touched

- `apps/local-server/config`: optional configuration path and validated catalog.
- New verification configuration/catalog module: strict JSON/path validation
  and canonical repository lookup.
- New verification runner: process groups, output capture, timeout/cancel, and
  completion classification.
- `packages/contracts`: protocol-9 definitions and invariants.
- Session manager and WebSocket hub: selected-session ownership, concurrency,
  lifecycle, bounded response/update dispatch, and graceful shutdown.
- Browser transport/state: inspect/run/cancel identities, snapshots, reconnect,
  and stale-message handling.
- Inspector: fourth tab, preset controls, process status, commit evidence, and
  bounded output presentation.

### Data/state changes

- Entity/schema changes: one optional version-1 operator JSON configuration;
  active/latest run data remains memory-only.
- Commands/events: inspect, run, cancel, response, and update.
- Idempotency: inspect/cancel are repeat-safe; accepted run requests deliberately
  create one process and reject a second active run for that session.
- Migration: none; no config means an available empty/unconfigured state.

### Protocol changes

- Increment `PROTOCOL_VERSION` from 8 to 9.
- A public preset exposes ID, label, description, exact executable and argument
  vector, and timeout, but not environment values or the config-file path.
- Run states are `running`, `cancelling`, `passed`, `failed`, `timed_out`,
  `cancelled`, or `error`, with strict state-specific evidence.
- Completed evidence includes bounded stdout/stderr, per-stream truncation,
  start/end timestamps, duration, optional exit/signal, force-kill flag, and
  nullable fresh start/end HEAD commits.
- Request schemas have no command, argument, cwd, environment, timeout, signal,
  output, or commit fields.
- Every server message is serialized through the existing application-message
  byte bound; excessive result data degrades to a bounded error snapshot.

### Authorization and privilege

- Existing token and exact Origin checks authorize each request.
- Session ID selects only a server-owned live session; its canonical repository
  must exactly match one configured root.
- Preset ID selects only the matching immutable startup catalog definition.
- Commands use `spawn` with `shell: false`, fixed cwd, absolute executable,
  typed args, and `buildChildEnvironment`.
- No repository, terminal, queue, provider, or browser text is parsed into
  executable content.
- The UI states that configuration is trusted operator code and execution uses
  the host user's authority without sandboxing.

## Sequence

1. Commit the PC-037 issue and implementation plan.
2. Add strict version-1 configuration parsing, path rules, catalog lookup, and
   fixtures.
3. Add protocol-9 request, catalog, run-state, and response/update contracts.
4. Add the bounded shell-free runner and result-classification unit tests.
5. Add timeout, graceful/forced cancellation, concurrency, shutdown, and
   real-process integration tests.
6. Add fresh HEAD association and changed-HEAD tests.
7. Add session-owned inspect/run/cancel orchestration and PTY-survival tests.
8. Add WebSocket dispatch, update broadcast, reconnect, and response-bound
   tests.
9. Add browser transport and per-session verification state.
10. Add the fourth inspector tab and all configured/lifecycle/result states.
11. Add deterministic browser run/cancel/reconnect/narrow-layout workflows.
12. Synchronize docs and run complete gates.
13. Fast-forward and push the small coherent commit series to `dev`.

## Failure model

| Failure point           | Expected state                                          | Recovery                                 |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------- |
| No config               | Unconfigured Checks guidance; terminals survive         | Start Pacium with an explicit config     |
| Invalid config          | Startup fails closed with bounded path-neutral reason   | Fix local config and restart             |
| No matching root        | No presets for selected repository                      | Configure its canonical root             |
| Repository changed/lost | Run rejected before spawn; terminal survives            | Restore/select repository and refresh    |
| Global/session busy     | Bounded busy response; existing run unchanged           | Wait or cancel the active run            |
| HEAD unavailable        | Run proceeds with honest null association               | Inspect repository state                 |
| Spawn failure           | `error`; no false exit result                           | Fix executable/permissions               |
| Nonzero exit            | `failed` with exact bounded evidence                    | Inspect output and retry explicitly      |
| Timeout                 | terminate group, force if needed, `timed_out`           | Increase configured timeout or fix check |
| Cancel race             | Existing terminal result wins or cancel is acknowledged | Inspect final state                      |
| Output overflow         | Retain bounded prefix/tail and mark truncation          | Run directly for full output             |
| Browser disconnect      | Server process and run continue                         | Reconnect and inspect                    |
| Graceful server stop    | Active groups terminate; no PTY implication             | Restart and run again                    |
| Hard server crash       | Prior run outcome/process is unknown                    | Inspect OS processes before retry        |
| Final message overflow  | Bounded error snapshot                                  | Run directly and inspect config          |

## Compatibility

- Supported versions: macOS-first Node.js 24 runtime and POSIX process-group
  signals; protocol-9 browser/server pair.
- Fallback behavior: all terminal and read-only Git surfaces remain usable when
  verification is unconfigured, busy, failed, or unavailable.
- Rollback: remove/ignore the optional config and revert protocol/server/browser
  together; repositories and PTYs hold no verification state.

## Test plan

- Unit: JSON shape/bytes/counts, canonical roots, outside-root rule, executable
  validation, duplicate IDs, lookup, output UTF-8/control normalization,
  classification, state invariants, and HEAD comparison.
- Property/fault: extra keys, symlinks, missing files, relative paths, oversized
  fields/args/output, embedded controls, invalid UTF-8, and duplicate roots.
- Contract: all request and run states, valid bounds, invalid cross-field
  combinations, exact identities, extra keys, and forbidden process fields.
- Integration: pass, fail, stdout/stderr, truncation, timeout, SIGTERM,
  SIGKILL fallback, cancel race, spawn error, two-run ceiling, per-session
  exclusion, shutdown, and no inherited secret.
- Browser: lazy inspect, configured command disclosure, explicit run, cancel,
  completion, changed HEAD, truncation, reconnect, fourth-tab keyboard behavior,
  PTY preservation, and 320 CSS px layout.
- Security: no shell, config outside repository, exact session/root/preset
  ownership, absolute executable, environment allowlist, hostile control output,
  message limits, and text-only rendering.
- Performance: 24 KiB per output stream, a 48 KiB combined retained ceiling
  that remains safe under JSON escaping and the application-message bound, two
  active processes, one latest result per session, ten-minute timeout cap, and
  no polling.

## Documentation changes

- Protocol, configuration example, security boundary, status, README, backlog,
  issue, plan, and changelog.
- Record durable history, live streaming output, automatic runs, config editing,
  hard-crash recovery, CI integration, and Pacium grouping as incomplete.

## Rollout

- Development: temporary external config, temporary repositories, and
  deterministic fixture executables.
- Integration: contract, runner, session, WebSocket, state, and browser suites.
- Canary: localhost development only with an explicit non-production preset.
- Production: none; project remains pre-release.

## Open questions

- A future supervised-process or durable run journal design is needed before
  Pacium can recover verification identity across hard local-server crashes.

## Approval

- Product: verification stays adjacent to the selected terminal and shows exact
  consequence/evidence.
- Architecture: explicit configuration and OS/Git truth remain authoritative;
  results are disposable.
- Security: preset-ID-only requests, no shell, canonical roots, absolute
  executables, bounded environment/output/processes, and plain-text rendering.

## Result

Completed on 2026-07-27 as the planned protocol-9 vertical slice.

- Startup accepts only an explicit strict external version-1 catalog with
  canonical roots, absolute executable/argv definitions, and bounded values.
- Selected-session requests carry identities only. The server owns repository
  and preset resolution, two global slots, shell-free spawn, bounded
  environment/output, timeout, process-group cancellation, latest result, and
  fresh start/end HEAD observations.
- Checks is a lazy fourth inspector tab with exact argv and privilege copy,
  explicit Run/Cancel, elapsed and terminal states, bounded stdout/stderr,
  truncation and HEAD warnings, stale/error recovery, reconnect inspection,
  keyboard navigation, and narrow responsive layout.
- `pnpm verify` passed 58 files and 277 tests plus both production builds.
- `pnpm test:e2e` passed all seven Chromium workflows, including deterministic
  run, browser reload, recovered cancellation, unchanged terminal selection,
  and 320 CSS px evidence.
- Manual in-app-browser visual review could not be performed because no browser
  backend was connected; that release evidence remains open.
