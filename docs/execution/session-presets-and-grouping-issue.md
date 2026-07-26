# PC-020/PC-021/PC-025/PC-026: Preset-aware repository sessions

## Problem

The first terminal slice can create and switch shells, but every session is presented as an undifferentiated terminal. The operator cannot deliberately launch Codex or Claude Code, scan sessions by repository, or move between sessions with stable application shortcuts.

## Outcome

The operator chooses a server-owned Shell, Codex, or Claude Code preset, sees unavailable presets before launch, and manages resulting sessions in repository groups with predictable keyboard navigation.

## Scope

- Add a typed launch-preset identifier to the shared protocol.
- Advertise preset availability in the server welcome message.
- Resolve only fixed server-owned executable and argument definitions.
- Detect a repository root by walking from the canonical working directory.
- Add preset and repository context to session summaries.
- Group sidebar sessions by repository, with a separate folder group outside repositories.
- Add shortcuts for new terminal, numbered session selection, previous/next session, and leaving terminal capture.
- Preserve reconnect, close, input, resize, and session-list behavior.

## Non-scope

- User-defined commands or environment editing.
- Durable workspace or preset configuration.
- Git status, branch, diff, or commit inspection.
- Tabs, splits, rename, pin, duplicate, or relaunch.
- Semantic provider state or native Claude/Codex events.
- tmux.

## Acceptance criteria

- [x] The browser cannot submit an arbitrary executable or argument list.
- [x] Shell is always advertised; Codex and Claude are advertised with honest availability.
- [x] Choosing an unavailable preset fails before PTY creation with a typed error.
- [x] A created session records its preset, command label, and repository context.
- [ ] Sessions inside one repository appear under one repository heading.
- [ ] Sessions outside a repository remain usable under a folder heading.
- [ ] New-terminal, numbered-selection, previous/next, and terminal-escape shortcuts work without stealing ordinary terminal input.
- [x] Reconnect snapshots continue to target the correct session.
- [x] Contract, resolver, session, transport, and keyboard logic have deterministic tests.
- [x] The full repository verification gate passes.

## User experience

The new-terminal dialog shows three compact preset choices. Unavailable commands remain visible with a clear “not installed” state. The selected command label and canonical working directory are visible before launch.

The sidebar uses repository headings rather than a flat list. Rows show the preset label and compact path. Shortcut behavior is discoverable in labels or tooltips, and `Ctrl+Shift+.` returns focus from the terminal to the application.

## Architecture

- Systems and modules touched: shared contracts, local-server configuration, preset resolver, PTY adapter, session manager, web transport, terminal UI, sidebar and creation flow.
- Systems of record: the fixed server catalog owns launch definitions; the filesystem owns repository-root discovery; the PTY owns process state.
- State transitions: unchanged session lifecycle; preset resolution occurs before `creating → live`.
- Protocol/schema impact: preset capabilities, create payload, and session-summary fields with a protocol-version bump during pre-release development.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: existing local token and Origin checks remain at the WebSocket boundary.
- Privilege: commands run as the invoking user.
- Secrets/logging: no additional environment values or terminal bytes are persisted.
- Abuse/failure scenario: unknown preset identifiers, missing executables, invalid cwd values, and symlinked cwd values fail or resolve deterministically without accepting shell strings.

## Reliability

- Idempotency: session creation remains one request to one new session; reconnect does not recreate it.
- Timeouts/retries: executable discovery is local and synchronous at startup; no automatic launch retry.
- Restart behavior: direct PTYs still end with the local server.
- Unknown outcome: browser disconnect after create is recovered through session list and attach.
- Migration/rollback: in-memory sessions require no durable migration.

## Test plan

- Unit: PATH resolution, preset availability, repository-root discovery, grouping and keyboard selection.
- Contract: preset identifiers, advertised definitions, create payload, summary fields.
- Integration: fake and real PTY launch definition, reconnect with preset metadata.
- Browser: creation choices, grouping, shortcuts, focus escape when a browser backend is available.
- Failure/recovery: unavailable preset, missing repository metadata, disconnect after creation.
- Security: arbitrary preset/command rejection and canonical cwd behavior.

## Dependencies

- Blocked by: none for implementation; browser evidence remains environment-dependent.
- Blocks: richer session actions, agent detection, Git inspection, and Pacium role presets.

## Evidence required

- Full `pnpm verify` result.
- Preset resolver and repository discovery test results.
- WebSocket creation/reconnect contract result.
- Browser workflow evidence when a browser backend is available.

## Open questions

- Durable user-defined presets remain deferred until the minimal filesystem-state layer exists.
