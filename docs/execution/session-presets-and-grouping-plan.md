# Implementation plan: Preset-aware repository sessions

- Issue: [PC-020/PC-021/PC-025/PC-026](session-presets-and-grouping-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `main` (Git commands remain blocked by the unaccepted Xcode license)
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `bfc6fd74240186bdf873a43a01a0158ba22d1b9b`
- Target milestone: Milestone 1
- Status: Implemented locally; rendered browser validation pending

## Objective

Turn the flat shell-only session list into a typed, repository-aware launcher and keyboard-navigable session workspace without adding arbitrary command execution or durable configuration.

## Existing behavior

- The server launches only the configured login shell.
- `session.create` contains cwd, dimensions, and an optional display name.
- Session summaries contain cwd and shell path but no preset or repository context.
- The web application shows one flat session list.
- There is no application keyboard model or explicit terminal-capture escape action.

## Proposed behavior

The server publishes a fixed catalog for Shell, Codex, and Claude Code. The browser submits only the preset ID. The server resolves an available executable and fixed arguments, canonicalizes the cwd, discovers an enclosing repository marker, creates the PTY, and returns that context in the session summary.

The web application groups sessions by repository and supports stable shortcuts for creation and selection while preserving terminal input capture.

## Architecture and boundaries

### Modules touched

- `packages/contracts`: preset and session schemas.
- `apps/local-server`: preset catalog, repository discovery, PTY spawn specification, session summaries, welcome capabilities.
- `apps/web`: transport payload, grouping reducer, preset creation UI, keyboard controller.
- `packages/terminal-ui`: explicit blur/focus boundary.
- `packages/test-utils`: richer fake spawn-call evidence.

### Data/state changes

- Entity/schema changes: additive `launchPreset`, `commandLabel`, `repositoryRoot`, and `repositoryName` session fields.
- Commands/events: `session.create` requires `launchPreset`.
- Idempotency: unchanged request identity; no command replay.
- Migration: none because the registry is in memory.

### Protocol changes

- Bump the pre-release protocol from version 1 to version 2.
- Add `LaunchPresetIdSchema`.
- Add advertised launch-preset capability records to `server.welcome`.
- Add preset selection to `session.create`.
- Add preset and repository fields to `SessionSummary`.

### Authorization and privilege

- Browser selects an enum value only.
- Server owns executable paths and fixed arguments.
- PATH lookup is bounded to the invoking environment and performed once at startup.
- Repository discovery reads filesystem metadata only and never executes repository content.

## Sequence

1. Add the issue and plan.
2. Extend shared schemas and contract tests.
3. Add fixed preset discovery and repository-root discovery.
4. Pass typed spawn definitions into the PTY adapter.
5. Extend session creation and reconnect summaries.
6. Add grouping and keyboard pure functions with tests.
7. Update the dialog, sidebar, and terminal focus API.
8. Run the full verification gate and synchronize status.

## Failure model

| Failure point                     | Expected state                           | Recovery                                      |
| --------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Preset executable missing         | No PTY created; typed unavailable error  | Choose an available preset or install the CLI |
| Unknown preset ID                 | Protocol rejects message                 | Refresh compatible client                     |
| Repository marker unreadable      | Session remains ungrouped by repository  | Use the canonical cwd folder group            |
| Browser disconnect after creation | PTY and preset metadata remain in memory | Reconnect, list, and attach                   |
| Shortcut pressed in text input    | Text field retains the key               | Use shortcut outside form editing             |
| Terminal escape chord             | PTY remains live; keyboard capture ends  | Click terminal or refocus command to return   |

## Compatibility

- Supported versions: current pre-release protocol version 2.
- Fallback behavior: Shell remains available even if agent CLIs are missing.
- Rollback: remove additive fields and return to shell-only creation; no durable state migration.

## Test plan

- Unit: executable lookup, fixed definitions, repository discovery, group ordering, selection navigation.
- Property/fault: unknown preset and missing executable never call the PTY factory.
- Contract: welcome, create, and summary schema validation.
- Integration: preset spawn arguments and reconnect metadata.
- Browser: dialog choices, grouping, shortcuts, focus escape when available.
- Security: no executable/args fields accepted from the client.
- Performance: repository discovery walks only cwd ancestors; grouping is linear in session count.

## Documentation changes

- Update `STATUS.md`, `README.md`, the backlog status, and this plan with exact evidence.
- Record unavailable browser or pinned-runtime evidence honestly.

## Rollout

- Development: launch available presets in a non-sensitive repository.
- Integration: fake all three presets; run the installed shell as the real PTY case.
- Canary: one shell plus whichever installed agent CLIs are available.
- Production: not part of this slice.

## Open questions

- None blocking this slice.

## Approval

- Product: direction already approved in Milestone 1.
- Architecture: fixed typed catalog fits ADR-0013 and the safe shell boundary.
- Security: browser-provided arbitrary commands remain prohibited.

## Evidence

- `pnpm verify` passed formatting, lint, type checking, 9 test files with 27 tests, and both production builds.
- Protocol version 2 accepts only the fixed preset IDs and rejects client-provided `command` or `args` fields.
- Automated tests cover preset resolution, repository discovery, grouping, keyboard navigation, typed spawning, reconnect metadata, and transport validation.
- A live development welcome message advertised Shell, Codex, and Claude Code as available on this machine.
- Development and built-server runs returned HTTP 200 for the UI and health endpoint and stopped cleanly.
- Rendered dialog, grouping, shortcut, and accessibility checks remain unvalidated because an in-app browser backend was unavailable.
