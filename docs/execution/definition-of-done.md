# Definition of done

A task or milestone is not done because code exists or an agent says it works.

## Product

- The user problem is solved within agreed scope.
- Acceptance criteria are demonstrably met.
- Empty, loading, error, degraded, and permission-denied states are designed.
- Keyboard and responsive behavior are addressed where relevant.
- Copy uses canonical vocabulary.
- The feature does not expand product scope accidentally.

## Architecture

- The implementation follows accepted ADRs and frozen decisions.
- Systems of record remain clear.
- No application database was introduced.
- State mutations use the authoritative writer.
- Provider-specific behavior stays behind adapters.
- tmux and Git ownership boundaries are respected.
- New protocols or schemas are versioned.

## Security

- Server-side authorization exists for every action.
- Privilege is least-scoped and revocable.
- Secrets are excluded or redacted.
- Paths and identifiers are validated.
- Terminal/WebSocket implications are reviewed.
- Audit attribution is complete.
- High-risk behavior has an explicit review.

## Reliability

- Idempotency is defined.
- Restart and partial-failure behavior is tested.
- Unknown outcome is handled explicitly.
- Timeouts and backpressure are bounded.
- No failure silently loses state.
- Migration and rollback behavior are documented.

## Tests

- Pure logic has unit coverage.
- Boundary/protocol behavior has contract coverage.
- Critical workflow has integration or browser coverage.
- Failure path is tested, not merely described.
- Tests are deterministic and pass in clean CI.
- No disabled failing test is hidden without an issue and approval.

## Evidence

- Exact commands and results are recorded in the pull request.
- Screenshots or recordings exist for meaningful UI changes.
- State/protocol examples exist for new contracts.
- Performance/security evidence is attached when required.
- Reviewer can reproduce the result.

## Documentation

- Relevant product/architecture/operations docs are updated.
- New limitations are recorded.
- Status claims remain accurate.
- Glossary and diagrams are updated if vocabulary or flows changed.
- ADR is accepted where required.

## Repository hygiene

- No secrets.
- No personal or build-environment traces.
- No generated build output unless intentionally versioned.
- No dependency caches or runtime state.
- No unrelated changes.
- Commit and pull-request history are understandable.

## Operational readiness

For production-affecting work:

- deployment sequence exists;
- migration is tested;
- rollback exists;
- backup implications are known;
- monitoring/diagnostics exist;
- operator runbook is updated;
- responsible owner is identified.

## Milestone completion

In addition to task-level criteria:

- milestone demo passes;
- exit metrics/evidence are collected;
- known risks are updated;
- next milestone assumptions are reviewed;
- product owner accepts completion.
