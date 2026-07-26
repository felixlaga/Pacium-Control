# Milestone 0 — Local application foundation

## Goal

Create a clean, deterministic engineering substrate for the localhost terminal application.

## Scope

- Pin supported runtime and package-manager versions.
- Establish packages for web, local server, contracts, terminal UI, and test utilities.
- Add documented install, dev, test, build, and verify commands.
- Define initial session, capability, command, event, and error contracts.
- Add loopback and local-token configuration.
- Add fake PTY, process, repository, Git, provider, and queue fixtures.
- Add formatting, linting, strict typing, unit tests, build, and clean-install CI.
- Add generated-artifact, secret, and machine-path checks.

## Non-scope

- Real PTY launch.
- Production packaging.
- Agent status.
- Git inspection.
- Pacium mode.
- tmux.
- Remote access.

## Acceptance criteria

1. A clean clone installs using documented commands.
2. The browser and local server start together in development.
3. The server binds to loopback.
4. Browser/server protocol versions and capabilities are explicit.
5. Shared contracts reject malformed messages.
6. Fixture terminals can produce deterministic output, exit, and failure.
7. CI runs formatting, linting, strict typing, tests, build, and clean-install verification.
8. No application database or machine-specific path is introduced.
9. The application shell renders the three-panel layout and terminal workspace states against fixtures.

## Evidence

- clean-install output;
- CI result;
- package-boundary diagram;
- protocol fixtures;
- screenshots of fixture shell;
- dependency and secret scan.
