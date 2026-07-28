# Agent handoff: PC-076 release readiness

## Identity

- Run: PC-076
- Task: Run release readiness and close the implementation roadmap
- From agent/provider: Codex
- To agent/provider: Pacium Control repository owner
- Repository: Pacium Control
- Branch: `dev`, integrated from `codex/release-readiness`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `07bba5b58254f1c58815cccb625b92c5df1e261a`
- Integrated implementation/evidence head:
  `2dfa16dd5fcb51489185fbae3235c9d239e6bec2`

## Objective

Complete PC-076 with reproducible local and hosted evidence, make an honest
release decision, integrate the task into `dev`, and stop at the documented
roadmap boundary.

## Constraints and acceptance criteria

- Preserve the loopback-only, direct-PTY, localhost product boundary.
- Do not infer signing, tailnet, provider, reviewer, or publication authority.
- Require exact-source macOS and exact-head Ubuntu evidence.
- Keep blocked external/manual gates distinct from automated passes.
- Integrate by fast-forward and leave no additional roadmap work in progress.

## Work completed

- Added a bounded release preflight and hostile fixture coverage.
- Made macOS native PTY package metadata reproducible across source roots.
- Isolated repository context for contract and browser verification.
- Added Linux release-preflight enforcement and fixed Ubuntu/path portability.
- Collected exact-source macOS and exact-head hosted Ubuntu evidence.
- Published the candidate decision matrix and synchronized status, roadmap,
  backlog, milestone, release, security, operations, risk, and changelog truth.
- Fast-forwarded the complete task branch into local `dev`.

## Files changed

- Release gate: `scripts/release-preflight.mjs`,
  `scripts/release-preflight.test.mjs`, `package.json`.
- Reproducibility and isolation: package/native build and test helpers,
  repository-context fixtures, and browser verification support.
- Decision and closure: `docs/execution/release-readiness-assessment.md`,
  this issue, implementation plan, and handoff.
- Source-of-truth synchronization: `STATUS.md`, `README.md`, roadmap/backlog,
  Milestone 5, release/security checklists, operator runbook, risk register,
  and changelog.

## Commits

- Task range: `07bba5b58254f1c58815cccb625b92c5df1e261a..2dfa16dd5fcb51489185fbae3235c9d239e6bec2`.
- The range contains 20 small coherent commits covering definition, tests,
  implementation, evidence, portability fixes, and documentation.
- The following `dev` closure commit records integration evidence only.

## Verification performed

| Command/check                                 | Commit/worktree              | Result | Evidence                                                                                                                 |
| --------------------------------------------- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Exact-source frozen install and `pnpm verify` | macOS archive                | Pass   | 142 files, 930 tests                                                                                                     |
| Full Chromium workflow                        | macOS archive                | Pass   | 20 passed in 59.7 seconds                                                                                                |
| Lifecycle soak                                | macOS archive                | Pass   | 3,440 ms; zero final sessions; file descriptors 18 to 18                                                                 |
| Development package verification              | macOS archive                | Pass   | 573,683 bytes; 28 manifest files; 47 entries; SHA-256 `923fe2f41533eee7c8591999002d783212e679545e959aca6ceba8d96415075c` |
| Native artifact cross-root comparison         | macOS task and archive roots | Pass   | `pty.node` and `spawn-helper` byte-identical                                                                             |
| `pnpm release:preflight`                      | exact task head `2dfa16d`    | Pass   | Darwin arm64; 560 tracked files; 21 contracts                                                                            |
| Linux validation                              | exact task head `2dfa16d`    | Pass   | Run `30345044665`, job `90229181991`, all steps green in 3 minutes 36 seconds                                            |

## Decisions that matter

- PC-076 is complete even though the publication decision is `NO-GO`.
- The release class remains Development snapshot.
- Current automated evidence is sufficient to close the implementation roadmap,
  but it does not replace the remaining external/manual release authorities.
- The registry advisory audit remains `not_run`: no dependency inventory was
  sent to an external service without destination-specific owner authority.

## Known failures or limitations

- No Developer ID signing identity or notarization evidence is available.
- No fresh-account macOS installation has been exercised.
- Tailscale is running, but Serve has no configured TCP or web handlers; no real
  grants/revocation canary was run.
- Claude Code and Codex CLIs are installed, but real account-backed provider
  canaries were not authorized.
- Manual screen-reader, visual, full-lifecycle, sustained-use, and explicit
  owner release acceptance evidence is absent.

## Open questions

- None for the implementation roadmap.

## Assumptions

- Missing external/manual gates remain blockers until separately authorized and
  evidenced; they are not implied follow-on implementation tasks.
- A future publication decision starts from this assessment without reopening
  completed PC-063 through PC-076 work.

## Context/capacity state

- Context pressure: closure only; all implementation work is committed.
- Provider capacity warning: none.

## Recommended next action

Do not start additional roadmap implementation. Keep Pacium Control classified
as a Development snapshot. If publication is later desired, the owner must
separately authorize and supply the blocked signing, clean-account, tailnet,
provider, manual-review, and release-acceptance evidence.

## Ownership transfer

- Old agent stopped/frozen: after the closure commit, `dev` push, and exact-head
  hosted validation.
- New ownership recorded: Pacium Control repository owner.
- Worktree policy: one coding worker used this worktree; integration was a
  separate fast-forward task and no concurrent writer shared the checkout.
