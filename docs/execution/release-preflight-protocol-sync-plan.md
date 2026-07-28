# Implementation plan: release-preflight protocol synchronization

- Issue: [PC-081](release-preflight-protocol-sync-issue.md)
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/fix-release-preflight-protocol`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `06096bdc90a976b50628333a0cd3b2ce17d44dc8`
- Target milestone: Milestone 5 maintenance
- Status: Complete

## Objective

Restore supported-host artifact preflight after the protocol-25 change and
make future drift between the canonical protocol and preflight visible in the
focused test suite.

## Existing behavior

`packages/contracts/src/protocol.ts` declares protocol 25. Package builders
read that declaration and embed 25, while
`scripts/release-preflight-contract.mjs` and its fixture still require 24.
The resulting fresh artifact fails with `invalid_package_manifest`.

## Proposed behavior

The preflight contract exposes one protocol expectation set to 25, uses it for
manifest validation, and its fixture consumes the same value. A separate test
reads the canonical source declaration and requires exact equality, so a
future protocol bump cannot leave the preflight suite falsely green.

## Architecture and boundaries

### Modules touched

- `scripts/release-preflight-contract.mjs`
- `scripts/release-preflight.test.mjs`
- PC-081 issue, plan, and completion evidence

### Data/state changes

- Entity/schema changes: none.
- Commands/events: none.
- Idempotency: pure validation only.
- Migration: none.

### Protocol changes

- None. Protocol remains 25.

### Authorization and privilege

- No application, shell, network, token, package, or state authority changes.

## Sequence

1. Record PC-081 issue and plan.
2. Expose and apply the protocol-25 preflight expectation.
3. Update the fixture and add the canonical-source drift test.
4. Run focused validation, formatting, and diff hygiene.
5. Record exact evidence and mark the issue/plan complete.

## Failure model

| Failure point                     | Expected state         | Recovery                                                                 |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| Canonical protocol changes        | focused test fails     | update the bounded preflight contract in the same change                 |
| Artifact embeds another version   | preflight fails closed | rebuild from matching exact source                                       |
| Canonical source cannot be parsed | focused test fails     | preserve the explicit declaration shape or update the test intentionally |

## Compatibility

- Supported versions: protocol 25, Node 24.18.x, ADR-0017 hosts.
- Fallback behavior: invalid artifacts remain rejected.
- Rollback: revert the bounded change; no persisted state is involved.

## Test plan

- Unit: valid and mismatched manifest protocol versions.
- Property/fault: existing hostile manifest coverage remains unchanged.
- Contract: canonical protocol source equals the preflight expectation.
- Integration: focused release-preflight test file.
- Browser: not applicable.
- Security: existing fail-closed manifest behavior.
- Performance: not applicable.

## Documentation changes

- PC-081 issue and plan with completion evidence.

## Rollout

- Development: bounded task branch.
- Integration: owner-controlled branch integration after green evidence.
- Canary: rerun supported Ubuntu workflow after integration.
- Production: none; development-snapshot release status is unchanged.

## Open questions

- None.

## Approval

- Product: owner explicitly requested the reported preflight failure be fixed.
- Architecture: no ADR or protocol change.
- Security: existing fail-closed validation is preserved.

## Completion

- Release-manifest validation now expects protocol 25 through one exported
  preflight constant.
- The focused fixture consumes that constant, while an independent test reads
  the canonical `PROTOCOL_VERSION` declaration and requires exact equality.
- A protocol-24 manifest is explicitly rejected by the focused suite.
- Focused tests passed 10/10; full verification passed 144 test files and 924
  tests plus formatting, lint, type checks, and production builds.
- Local verification used Node.js 26.4.0 because the installed `node@24`
  Homebrew link resolves to that runtime. Exact supported-host artifact
  preflight remains reproducible in the pinned Ubuntu workflow after
  integration.
