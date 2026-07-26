# Definition of done

## Product

- The scoped terminal, agent, Git, or Pacium outcome works from the application.
- Empty, loading, live, reconnecting, ended, error, and degraded states are complete where applicable.
- Keyboard, mouse, focus, and accessibility behavior are addressed.
- The change follows the local-first product scope.

## Architecture

- Browser lifecycle does not accidentally own PTY lifecycle.
- Terminal bytes and application events remain separate.
- Status source and confidence remain explicit.
- No database, remote exposure, mandatory tmux, or speculative workflow platform is introduced.
- Persistent state is minimal and versioned.

## Security

- Loopback, Origin, token, path, and message boundaries are respected.
- Terminal and repository content is treated as untrusted.
- Process and signal targets are correct.
- Secrets and complete environments are excluded from logs/state.
- Questions and approvals remain distinct.

## Reliability

- Reconnect behavior is tested.
- Input is not duplicated.
- Buffers are bounded.
- Process exit and cleanup are tested.
- Unknown outcomes remain unknown.
- Failure states what survived and how to recover.

## Design

- Main work remains visually dominant.
- Navigation and inactive chrome recede.
- Tokens, spacing, density, and icons are consistent.
- Frequent actions follow the visible/context-menu/shortcut/command-palette model.
- UI changes include screenshots or recording.
- The interface is inspired by Linear’s discipline without copying its brand.

## Tests

- Pure logic has unit coverage.
- Protocol behavior has contract coverage.
- PTY behavior has real integration coverage.
- Critical user flow has browser coverage.
- Relevant failure and security paths are exercised.
- Tests pass from a clean clone without private credentials.

## Evidence

- Exact commands and results are recorded.
- UI evidence exists where meaningful.
- Supported platform and dependency versions are stated.
- Performance and security evidence is attached when required.
- Reviewer can reproduce the result.

## Documentation and hygiene

- Status claims are synchronized.
- Relevant specs and ADRs are updated.
- Limitations are recorded.
- No secrets, terminal captures, local state, dependencies, caches, build output, or machine-specific paths are committed.
- No unrelated changes are included.

## Milestone completion

- Milestone demo passes.
- Acceptance criteria and evidence are complete.
- Risk register is updated.
- Next milestone assumptions are reviewed.
- Product owner accepts the result.
