# Release readiness

## Release classes

### Development snapshot

Internal branch build. No compatibility or deployment promise.

### Alpha

Usable by the core team in a controlled environment. Known rough edges; state migration and rollback still required.

### Beta

Daily internal use with documented operating procedures, recovery evidence, and security review. Limited compatibility promise.

### Stable

Supported deployment, state compatibility policy, tested upgrades/rollback, and sustained production evidence.

## Required release evidence

### Source

- clean working tree;
- tagged commit;
- dependency lock;
- generated software bill of materials where applicable;
- no secrets or environment traces;
- documentation status accurate.

### Build and tests

- clean clone install;
- lint/type/test/build;
- integration and browser tests;
- state migration/recovery tests;
- security tests;
- provider/tmux compatibility report;
- performance results for target load.

### Product

- release demo script;
- screenshots/recording for key flows;
- acceptance criteria matrix;
- known limitations;
- metrics baseline or pilot results.

### Operations

- deployment plan;
- rollback plan;
- backup completed;
- restore evidence current;
- service/version matrix;
- monitoring and diagnostic checks;
- owner/on-call contact;
- incident severity definitions.

### Security

- threat model reviewed;
- network exposure verified;
- roles and test identities reviewed;
- terminal route reviewed;
- broker privilege reviewed;
- secrets and dependency scan;
- high-risk changes approved.

## State compatibility

Every release that changes state schemas must define:

- source versions supported;
- migration command/process;
- pre-migration backup;
- migration idempotency;
- validation;
- rollback feasibility;
- treatment of unknown/newer versions;
- event compatibility.

Never upgrade authoritative state in place without a tested backup and validation path.

## Production smoke test

Suggested minimum:

1. authenticate through Tailscale;
2. load workspace and health;
3. discover a known tmux session;
4. open read-only terminal;
5. acquire/release control on a canary session;
6. create and answer a canary question;
7. verify acknowledgement;
8. inspect Git evidence from a canary repository;
9. verify provider adapter health;
10. verify backup age and state integrity.

## Rollback trigger

Rollback or pause when:

- state integrity fails;
- duplicate prompts/decisions occur;
- authorization boundary is violated;
- terminal control cannot be revoked;
- provider approvals are mishandled;
- existing tmux sessions are disrupted unexpectedly;
- critical workflow error rate exceeds agreed threshold;
- recovery evidence is unavailable.

## Release declaration

A release note should distinguish:

- implemented;
- tested in CI;
- tested in integration environment;
- piloted internally;
- production-proven;
- known limitations.

Avoid a single “production-ready” label without this detail.
