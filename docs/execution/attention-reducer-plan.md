# Implementation plan: Evidence-labelled attention reducer

- Issue: [PC-031](attention-reducer-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/attention-reducer`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `d5a4414`
- Target milestone: Milestone 2
- Status: In progress

## Objective

Create one pure, testable attention-selection contract and give it a real
process-only UI consumer without adding observers, polling, notifications, or
false activity semantics.

## Proposed behavior

Observations carry state, source, confidence, observed time, stale threshold,
and reason. The reducer orders source first, then confidence, then recency.
Provider-native evidence outranks hooks; deliberate human evidence outranks
process and terminal inference; process evidence outranks terminal inference.
If the winning evidence has expired, the result is stale rather than allowing a
weak terminal signal to claim progress.

For current sessions, live/creating/closing process state maps to unknown,
nonzero or signalled exit maps to failed, and a clean exit maps to finished with
medium confidence and explicit “task completion unverified” copy. The sidebar
and inspector render that result.

## Modules and boundaries

- `apps/web/src/attention-model.ts`: types, reducer, process derivation, labels.
- `apps/web/src/attention-model.test.ts`: deterministic and fault cases.
- `apps/web/src/attention.tsx`: compact evidence card and rendering tests.
- `apps/web/src/app.tsx` and `styles.css`: current session consumers.
- No protocol, PTY, server, filesystem, or storage change.

## Sequence

1. Commit issue and plan.
2. Add pure reducer and process derivation with tests.
3. Add compact rendered evidence component.
4. Integrate sidebar and inspector without changing selection/focus.
5. Synchronize docs and run full gates.
6. Merge and push to `dev`.

## Failure model

| Failure                 | Result                                           |
| ----------------------- | ------------------------------------------------ |
| No observations         | Bounded unknown result                           |
| Invalid time            | Observation ignored; unknown if none remain      |
| Strong evidence expires | Stale result preserving source/reason provenance |
| Live process only       | Unknown/process/low, never working               |
| Clean exit              | Finished/process/medium; task remains unverified |
| Signal or nonzero exit  | Failed/process/high                              |

## Test plan

- Pure precedence, tie, stale, invalid, and empty cases.
- Process lifecycle derivation and wording boundaries.
- Server-rendered evidence and accessible naming.
- Full `pnpm verify` plus existing `pnpm test:e2e`.

## Documentation

- README/STATUS, backlog, issue evidence, plan result, changelog.

## Approval

- Product: makes attention useful while preserving epistemic honesty.
- Architecture: pure browser projection over current process truth.
- Security: no new input or authority boundary.
