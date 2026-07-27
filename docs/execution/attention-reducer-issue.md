# PC-031: Evidence-labelled attention reducer

## Problem

Pacium now classifies what it launched, but the workspace still exposes only
process lifecycle. It lacks one deterministic vocabulary and precedence model
for working, waiting, needs-input, finished, failed, stale, and unknown
attention. Without that contract, later terminal, hook, and native observers
could overwrite one another or present process existence as proof of work.

## Outcome

A pure reducer selects one attention result from bounded observations using
explicit source, confidence, freshness, and time rules. The current UI consumes
only honest process-derived observations: live processes remain unknown, failed
exits surface failure, and clean exits surface a medium-confidence finished
state that explicitly does not verify task completion.

## Scope

- Define strict attention state, source, confidence, observation, and result
  types.
- Rank provider-native, hook, human, process, and terminal evidence explicitly.
- Prevent newer low-confidence terminal evidence from overriding stronger
  provider wait/input/failure evidence.
- Convert expired winning evidence into a stale state.
- Derive the initial process-only observation from a session summary.
- Show attention text, source, confidence, and freshness in session rows and
  the selected-session inspector.
- Add deterministic reducer, boundary, and rendered semantic tests.

## Non-scope

- Terminal-output parsing, provider hooks, or native provider observers.
- Unread cursors, notifications, mute policy, or browser permissions.
- Durable attention history or a generalized event store.
- Git inspection, queue state, or Pacium mode.
- Human override controls.

## Acceptance criteria

- [ ] All required attention states have stable strict types.
- [ ] Every result includes source, confidence, observed time, stale threshold,
      and reason.
- [ ] Source/confidence precedence is deterministic and tested.
- [ ] Expired winning evidence becomes stale without being replaced by weak
      terminal activity.
- [ ] A live process alone produces unknown, never working.
- [ ] Nonzero exits produce failed process evidence.
- [ ] Clean exits produce process-derived finished evidence whose copy does not
      claim task completion.
- [ ] Sidebar and inspector show attention using text as well as color/icon.
- [ ] The reducer is pure and performs no polling or persistence.
- [ ] The full repository verification gate passes.

## Architecture

- Modules: browser attention model and tests, App consumers, compact styles,
  rendered semantics.
- System of record: each observation’s labelled upstream source; PTY process
  state remains process truth.
- Protocol impact: none in this slice; the browser derives current
  process-only observations from protocol-4 sessions.
- Relevant ADRs: ADR-0010, ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- No new endpoint, command, path, token, or provider payload.
- Reasons are fixed application copy for current process observations.
- Terminal bytes and arbitrary process output are never parsed or announced.

## Reliability

- Same observations and clock produce the same result.
- Malformed dates fail to a bounded unknown result.
- Browser refresh recomputes from current session truth.
- Later observers can feed the reducer without changing PTY behavior.

## Test plan

- Unit: source precedence, confidence tie, recency tie, stale conversion, empty
  and invalid inputs.
- Boundary: live/clean-exit/nonzero-exit process derivation and no “working”
  claim.
- Rendering: session attention name and inspector evidence text.
- Full: `pnpm verify` and existing Chromium workflows.

## Dependencies

- Blocked by: PC-030 classification and existing process lifecycle.
- Blocks: PC-032 unread/notifications, activity summaries, and provider
  observers.

## Evidence required

- Focused reducer and rendering results.
- Full repository verification.
- Synchronized status, backlog, issue, plan, and changelog.
