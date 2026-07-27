# Implementation plan: Local workspace preferences

- Issue: [PC-027](preferences-issue.md)
- Owner: Felix
- Agent/session: Codex `/root`
- Branch: `codex/preferences`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `1c58a15cb637d11cafe2ee3712a01fdec5aea706`
- Target milestone: Milestone 1
- Status: In progress

## Objective

Add the smallest useful, safe preference system for the current terminal workspace: versioned browser-local state, a focused settings surface, and immediate real consumers for theme, density, terminal options, and launch defaults.

## Existing behavior

- The architecture assigns local view preferences to the browser.
- Tabs and split layout already use versioned local-storage records.
- Application colors, spacing, and xterm options are fixed in CSS and terminal-ui code.
- The new-terminal dialog always initializes to Shell.
- Settings appears in the design specification but has no current control, shortcut, palette command, state model, or route.

## Proposed behavior

Define a strict version-1 preference record with controlled enums and numeric bounds. Parse only a bounded JSON string and fall back as a whole record when the schema is invalid or unknown. Apply effective theme and density through root data attributes. Pass normalized terminal preferences through the split workspace into mounted terminal surfaces and update xterm options in place.

A modal settings surface edits a draft. Apply persists one record and updates current consumers. Cancel discards the draft. Restore defaults changes only the draft. `Cmd/Ctrl ,`, a top-bar button, and a palette command open the same surface. The launch dialog resolves the saved default against currently available fixed presets.

## Architecture and boundaries

### Modules touched

- `apps/web/src/preferences-model.ts`: schema, defaults, parse/serialize, bounds, theme and preset resolution.
- `apps/web/src/preferences.tsx`: controlled draft settings dialog and markup tests.
- `apps/web/src/app.tsx`: load/save/error state, root attributes, shortcut/palette routing, default preset.
- `apps/web/src/command-palette-model.ts`: stable settings command.
- `apps/web/src/session-model.ts`: `Cmd/Ctrl ,` shortcut.
- `apps/web/src/split-workspace.tsx`: normalized terminal preference propagation.
- `packages/terminal-ui/src/terminal-surface.tsx`: controlled appearance/options and in-place updates.
- `apps/web/src/styles.css`: light theme, density, and responsive settings surface.

### Data/state changes

- Entity/schema changes: browser-local `pacium.preferences` version 1.
- Commands/events: browser-local `open-settings` command.
- Idempotency: normalized serialization is deterministic.
- Migration: unknown versions and invalid records use defaults without overwriting evidence until Apply.

### Protocol changes

- None.

### Authorization and privilege

- No server, filesystem, PTY, Git, provider, or queue privilege change.
- Local-storage content is untrusted, length-bounded, parsed without execution, and validated before use.

## Sequence

1. Commit issue and implementation plan separately.
2. Add preference types, strict parser, deterministic serializer, resolvers, and tests.
3. Add controlled terminal preference props and in-place option update tests.
4. Propagate terminal preferences through split-workspace rendering.
5. Add `Cmd/Ctrl ,` and the palette settings entry with pure tests.
6. Build the settings draft dialog and server-rendered state tests.
7. Wire load, apply, persistence error, root theme/density, default preset, and focus restoration.
8. Add light, density, settings, and responsive styles.
9. Run rendered validation if a browser backend becomes available.
10. Run full verification, synchronize status/evidence, merge, and push.

## Failure model

| Failure point                   | Expected state                                                    | Recovery                                      |
| ------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Stored value missing            | Documented defaults                                               | Open settings and Apply                       |
| Stored JSON malformed/oversized | Defaults; source is not executed or partially trusted             | Apply a valid record                          |
| Unknown schema version          | Defaults; no guessed migration                                    | Upgrade through a future explicit migration   |
| Local-storage write fails       | New in-memory settings remain active; warning says refresh risk   | Retry Apply after storage becomes available   |
| Saved preset unavailable        | First available fixed preset is selected                          | Install provider CLI or choose another preset |
| Terminal option update fails    | PTY and transport remain live; current terminal instance survives | Restore defaults or refresh                   |
| System theme changes            | Effective theme updates without modifying saved `system` choice   | Select explicit dark/light if desired         |
| Settings closes during capture  | Capture has already been released; no terminal bytes are replayed | Click terminal to re-enter capture            |

## Compatibility

- Supported versions: preference schema version 1; protocol version remains 3.
- Fallback behavior: defaults reproduce the current dark, compact, 13 px, 1.35 line-height, 2,000-scrollback, Shell-first behavior.
- Rollback: remove the browser-local key consumer and controlled terminal props; PTY/session state needs no migration.

## Test plan

- Unit: strict record parsing, size/version/range/extra-key rejection, deterministic serialization, theme and preset resolution.
- Property/fault: boundary numbers and hostile stored strings.
- Contract: none.
- Integration: terminal options update without terminal recreation and trigger a fit.
- Browser: settings open/edit/cancel/default/apply/refresh plus theme/density/terminal changes when available.
- Security: preference JSON cannot create arbitrary CSS, commands, paths, or terminal input.
- Performance: preference changes update mounted terminals once without unbounded listeners.

## Documentation changes

- README settings shortcut and current-slice behavior.
- STATUS evidence and browser/runtime boundaries.
- PC-027 backlog status.
- Issue acceptance evidence and plan result.
- CHANGELOG entry.

## Rollout

- Development: focused tests for each model, terminal, component, and wiring slice.
- Integration: full `pnpm verify` and loopback runtime smoke.
- Canary: not applicable for localhost development slice.
- Production: no release artifact yet.

## Open questions

- Notification delivery semantics remain owned by PC-032.

## Approval

- Product: matches PC-027 while keeping notification delivery with its real consumer.
- Architecture: browser-owned local view preferences match `ARCHITECTURE.md`; no ADR change.
- Security: bounded enum/numeric record only; no secret or shell surface.
