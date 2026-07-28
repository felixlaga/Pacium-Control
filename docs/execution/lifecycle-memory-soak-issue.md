# PC-072: Lifecycle and memory soak tests

## Problem

Pacium's focused tests prove individual lifecycle and buffer behaviors, but the
repository has no repeatable personal-load baseline for repeated session
creation, reconnect snapshots, sustained output, idle terminals, split churn,
or notification load. A regression can therefore leak terminal models,
listeners, file descriptors, or retained state while every narrow test still
passes.

## Outcome

One explicit soak command exercises the supported personal workload with fixed
budgets and emits bounded machine-readable evidence. Deterministic unit tests
also keep the browser-owned split and notification collections within their
documented ceilings. PC-072 records a baseline; it does not claim production
monitoring or long-term field evidence.

## Scope

- Add one isolated local-server lifecycle soak runner and root command.
- Exercise twenty idle terminals, repeated create/close, one long-running
  terminal, sustained large output, repeated snapshot/reconnect reads, and
  cleanup.
- Measure elapsed time, peak/retained RSS growth, snapshot size, live session
  count, and open-file-descriptor delta where the host exposes it.
- Add deterministic high-count split-layout churn and attention-notification
  deduplication/bound tests.
- Record budgets, exact environment, results, and limitations.

## Non-scope

- A production telemetry, metrics, logging, or diagnostics service.
- Multi-hour or multi-day field-soak claims.
- Generalized benchmark framework or load generator.
- Browser automation with twenty xterm canvases.
- Provider API billing/load, real Claude/Codex work, queue execution, or Git
  mutation.
- Packaging, Linux support declaration, or release readiness.

## Acceptance criteria

- [x] One documented `pnpm test:soak` command runs in an isolated process and
      fails nonzero when a fixed budget is exceeded.
- [x] Twenty idle terminal models plus one long-running session remain usable
      and are fully released.
- [x] At least 100 create/close cycles leave no live sessions, force timers, or
      retained fake PTY listeners.
- [x] At least 8 MiB of terminal output produces a snapshot within the existing
      protocol bound, and 100 reconnect snapshot reads do not create sessions
      or replay input.
- [x] Peak RSS grows by no more than 256 MiB, post-cleanup retained RSS grows
      by no more than 192 MiB, and retained live heap grows by no more than
      32 MiB in the isolated supported-runtime process.
- [x] A real-PTY cleanup canary returns file-descriptor count to within four of
      baseline when `/dev/fd` or `/proc/self/fd` is available.
- [x] Two thousand split operations never exceed four panes or produce
      duplicate node/session identities.
- [x] Five thousand attention updates retain at most 200 cursor entries and
      never redeliver the same important event.
- [x] Full verification, the explicit soak command, and all Chromium workflows
      pass.

## User experience

There is no new product UI. Developers and release reviewers run one command
and receive a concise result containing scenario counts, duration, RSS deltas,
file-descriptor evidence, and pass/fail budgets. Terminal bytes, environment
values, paths, prompts, and provider content are excluded.

## Architecture

- Systems and modules touched: root scripts, a test-only local-server soak
  runner, PTY lifecycle cleanup, a narrow macOS `node-pty` descriptor patch,
  split-layout tests, attention-inbox tests, and execution evidence.
- Systems of record: PTYs remain process truth; soak observations are
  disposable test output only.
- State transitions: create -> live -> output/snapshot -> ended/closed; no new
  production transition.
- Protocol/schema impact: none.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: no new network or browser endpoint.
- Privilege: the real-PTY canary runs only the fixed test shell command owned by
  the repository.
- Secrets/logging: output contains scalar counts and byte totals only.
- Abuse/failure scenario: all loops and output are fixed and bounded; a failed
  assertion still shuts down child processes and removes temporary state.

## Reliability

- Idempotency: each run uses isolated temporary state and no repository writes.
- Timeouts/retries: observable event deadlines replace arbitrary sleeps; no
  workload retry hides failure.
- Restart behavior: reconnect is modeled as repeated list/snapshot inspection;
  tmux restart evidence remains PC-071.
- Unknown outcome: missing host FD introspection is reported as unavailable,
  not zero.
- Migration/rollback: test-only code and no state schema.

## Test plan

- Unit: pane ceiling/identity invariants and attention retention/deduplication.
- Contract: existing snapshot bounds and no protocol changes.
- Integration: fake-PTY lifecycle/output/reconnect/RSS and real-PTY FD cleanup.
- Browser: full existing Chromium regression suite.
- Failure/recovery: budget breach, timeout, and cleanup paths fail visibly.
- Security: scan result payload for scalar-only output and no terminal bytes.

## Dependencies

- Blocked by: PC-071 and the direct-PTY lifecycle.
- Blocks: PC-073 through PC-076.

## Evidence required

- Exact soak command and scalar result.
- Full verification counts and production bundle sizes.
- Complete Chromium workflow count.
- Current status, risk register, milestone, and limitations synchronized.

## Open questions

- None. These are development-machine baselines, not field reliability claims.

The retained RSS ceiling was calibrated after repeated Node 24.18 runs retained
about 144 MiB of allocator pages after GC despite releasing the terminal
models. The separate 32 MiB live-heap ceiling distinguishes retained
application objects from reusable V8/macOS allocator pages.

## Completion evidence

Completed on 2026-07-28.

- Supported Node.js 24.18.0 `pnpm test:soak` equivalent completed in 3,908 ms:
  141,787,136-byte peak and retained RSS growth, 5,343,056-byte retained live
  heap, 162,368 snapshot characters after 8,388,608 output bytes, 263 terminal
  events, zero final sessions, and `/dev/fd` 18 -> 18 across five real PTYs.
- The canary exposed and the committed dependency patch closes the macOS
  parent-side slave PTY, kqueue, and temporary low-number PTY descriptors.
- `pnpm verify` passed formatting, lint, every workspace type check, 132 test
  files and 863 tests, plus the 949.29 kB web JavaScript, 122.44 kB stylesheet,
  and 458.05 kB local-server production bundles.
- `pnpm test:e2e` passed all 19 Chromium workflows.
- No production endpoint, persisted soak result, terminal transcript,
  environment value, provider call, or protocol change was added.
