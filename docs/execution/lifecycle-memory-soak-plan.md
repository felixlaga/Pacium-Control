# Implementation plan: lifecycle and memory soak tests

- Issue: PC-072
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/lifecycle-soak-tests`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `4cfd3fa`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: In progress

## Objective

Establish a repeatable bounded personal-load baseline for terminal lifecycle,
output, reconnect inspection, browser-owned layout churn, notification load,
memory retention, and descriptor cleanup without adding production telemetry.

## Existing behavior

Focused unit, PTY, WebSocket, and Chromium tests cover individual lifecycle
operations. Headless terminal scrollback, snapshots, split panes, attention
inbox state, queue text, diffs, and provider events already have local bounds.
No command combines those boundaries under repeated load or records RSS and FD
cleanup against explicit budgets.

## Proposed behavior

Add an isolated test-only runner invoked by `pnpm test:soak`. It creates a fixed
personal workload through the real SessionManager, uses fake PTYs for
deterministic high-volume lifecycle/output scenarios, performs a small
real-PTY cleanup canary, requests garbage collection when available, measures
only scalar process evidence, and exits nonzero on a budget breach.

Add deterministic model tests that churn split layout state and attention
cursors far beyond ordinary use while asserting existing four-pane and
200-entry ceilings plus notification deduplication.

## Architecture and boundaries

### Modules touched

- Root package scripts: explicit soak entry point.
- Local server: test-only runner/helpers; no production endpoint.
- Web models: high-count tests only.
- Documentation: status, backlog, milestone, risk, changelog.

### Data/state changes

- Entity/schema changes: none.
- Commands/events: one developer-only `test:soak` command.
- Idempotency: isolated temporary directories and process-local state.
- Migration: none.

### Protocol changes

- None. Existing snapshot and session contracts remain authoritative.

### Authorization and privilege

- No listener, HTTP route, WebSocket message, provider call, or repository
  mutation is added.
- The real PTY canary uses the configured system shell with one fixed bounded
  test command and exact cleanup.

## Sequence

1. Commit the issue and plan separately.
2. Add deterministic split and attention load invariants.
3. Add fake-PTY lifecycle/output/reconnect soak scenarios.
4. Add isolated RSS and real-PTY FD cleanup measurement.
5. Expose one root soak command with scalar JSON output and fixed budgets.
6. Run focused, explicit soak, full verify, and Chromium gates.
7. Synchronize evidence and mark PC-072 complete.

## Failure model

| Failure point                 | Expected state                                | Recovery                         |
| ----------------------------- | --------------------------------------------- | -------------------------------- |
| workload event timeout        | nonzero exit with scenario name               | fix lifecycle or rerun unchanged |
| RSS budget exceeded           | scalar baseline/peak/final evidence retained  | inspect regression               |
| FD inspection unsupported     | explicit unavailable result                   | use supported macOS gate         |
| PTY launch unavailable        | real-canary failure, fake scenarios still end | repair native toolchain          |
| test interrupted              | shutdown/finally releases sessions and state  | rerun from clean temp state      |
| terminal output exceeds bound | assertion fails without printing bytes        | inspect buffer policy            |

## Compatibility

- Supported versions: Node.js 24.18.x, macOS Apple silicon first.
- Fallback behavior: FD count is nullable on hosts without `/dev/fd` or
  `/proc/self/fd`; memory and deterministic bounds remain mandatory.
- Rollback: remove test-only runner/script; production behavior and state are
  unchanged.

## Test plan

- Unit: split identity/pane invariant; attention cap and notification cursor.
- Property/fault: deterministic repeated operations and exceeded-budget tests.
- Contract: existing snapshot maximum.
- Integration: SessionManager lifecycle/output/reconnect; real PTY cleanup.
- Browser: complete existing Chromium suite.
- Security: scalar-only result schema; no terminal/environment/path output.
- Performance: 20 idle sessions, 100 create/close, 8 MiB output, 100 snapshots,
  2,000 split operations, 5,000 attention updates, 256 MiB peak and 96 MiB
  retained RSS budgets, FD delta at most four.

## Documentation changes

- Changelog, STATUS, backlog, milestone evidence, risk mitigation, issue/plan.

## Rollout

- Development: deterministic tests.
- Integration: isolated child soak plus real-PTY canary.
- Canary: current supported macOS checkout.
- Production: no runtime change or release claim.

## Open questions

- None.

## Approval

- Product: authorized by the owner's instruction to continue the remaining
  roadmap.
- Architecture: test-only evidence under ADR-0013 through ADR-0015.
- Security: no new runtime authority, endpoint, persistence, or content output.
