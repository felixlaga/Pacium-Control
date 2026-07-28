# PC-081: Keep release preflight aligned with the packaged protocol

## Problem

Protocol 25 is the current application transport contract, and both package
builders embed that version in their manifests. Release preflight still
requires protocol 24, while its fixture also supplies protocol 24. A newly
built supported-host artifact therefore fails with
`invalid_package_manifest`, but the focused preflight tests remain green.

## Outcome

Release preflight accepts a valid protocol-25 development package and a
regression test fails whenever the preflight expectation drifts from the
canonical protocol constant.

## Scope

- Align the release-manifest validator and fixtures with protocol 25.
- Add a source-contract test that compares the preflight expectation with the
  canonical protocol constant.
- Run focused tests and the applicable local verification.

## Non-scope

- Change the transport protocol or package-manifest schema.
- Change supported hosts, signing claims, package contents, or release status.
- Publish, sign, notarize, or upload an artifact.

## Acceptance criteria

- [x] A valid protocol-25 macOS or Ubuntu manifest passes validation.
- [x] A manifest with another protocol version fails closed.
- [x] The focused test reads the canonical protocol source and detects drift.
- [x] The release-preflight test suite and repository formatting pass.

## User experience

There is no application UI change. Supported-host CI no longer rejects a
correct freshly built artifact solely because preflight retained the prior
protocol version. Invalid manifests retain the existing scalar failure code.

## Architecture

- Systems and modules touched: release-preflight contract and focused tests.
- Systems of record: `packages/contracts/src/protocol.ts` remains canonical.
- State transitions: none.
- Protocol/schema impact: none; protocol remains 25 and manifest schema remains
  version 1.
- Relevant ADRs: ADR-0017.

## Security and privacy

- Authorization: unchanged; the preflight remains developer-owned and
  read-only.
- Privilege: no new process or filesystem authority.
- Secrets/logging: no content-bearing output is added.
- Abuse/failure scenario: malformed or mismatched manifests continue to fail
  closed as `invalid_package_manifest`.

## Reliability

- Idempotency: validation remains pure.
- Timeouts/retries: unchanged.
- Restart behavior: not applicable.
- Unknown outcome: a missing or unparsable canonical protocol declaration
  fails the regression test.
- Migration/rollback: revert the bounded validator/test change; no state
  migration exists.

## Test plan

- Unit: accept protocol 25 and reject a mismatched protocol.
- Contract: compare the preflight expectation with the canonical TypeScript
  protocol declaration.
- Integration: run the focused release-preflight suite.
- Browser: not applicable.
- Failure/recovery: confirm a mismatched protocol still fails closed.
- Security: confirm no validation boundary is weakened.

## Dependencies

- Blocked by: none.
- Blocks: supported-host release-preflight CI.

## Evidence required

- Exact focused-test command and result.
- Formatting result.
- Clean diff hygiene and explicit confirmation that protocol remains 25.

## Open questions

- None.

## Completion evidence

- `pnpm exec vitest run scripts/release-preflight.test.mjs`: 1 file and 10
  tests passed, including canonical-source synchronization and mismatched
  protocol rejection.
- `pnpm verify`: formatting, lint, all workspace type checks, 144 test files
  and 924 tests, and production builds passed.
- `git diff --check`: passed.
- Verification used the installed Node.js 26.4.0 runtime. The supported
  Node.js 24.18.x artifact-level rerun remains the hosted Ubuntu integration
  gate; the local `node@24` Homebrew link currently resolves to Node.js 26.4.0.
