# PC-027: Local workspace preferences

## Problem

Pacium’s terminal and application appearance are fixed in code. Operators cannot choose light/system appearance, density, terminal typography, retained scrollback, or a default launch preset. This is especially limiting for a terminal-first tool where legibility and screen density vary by display, remote access, and personal workflow.

## Outcome

A compact settings surface lets the operator adjust preferences that already have real browser consumers. Preferences are validated, versioned, bounded, stored locally without secrets, applied immediately after Save, and restored after refresh. Invalid or obsolete stored data falls back safely to documented defaults.

## Scope

- Add a versioned browser-local preference schema with strict parsing and safe defaults.
- Add dark, light, and system application themes.
- Add compact and comfortable workspace density.
- Add three controlled terminal font stacks.
- Add bounded terminal font size, line height, and scrollback controls.
- Add an available Shell, Codex, or Claude Code default launch preset.
- Store a quiet notification-level preference for the later PC-032 attention consumer.
- Open settings from a visible top-bar control, `Cmd/Ctrl ,`, and the command palette.
- Use a focused settings dialog with Apply, Cancel, and Restore defaults.
- Apply terminal options to already-mounted terminal surfaces without replaying input or recreating PTYs.
- Keep preference changes browser-local and free of machine paths, tokens, environments, or terminal content.

## Non-scope

- Notification delivery or permission prompts before PC-032 supplies attention events.
- User-defined launch commands or environment allowlists.
- Workspace/repository configuration.
- Keyboard remapping.
- Server-wide or multi-browser preference synchronization.
- A generic settings router or plugin configuration framework.
- Persisting scrollback contents.

## Acceptance criteria

- [ ] Missing, malformed, unknown-version, and out-of-range stored values resolve to safe defaults.
- [ ] Saved preferences use one bounded versioned local-storage record.
- [ ] Dark, light, and system themes update application and terminal colors.
- [ ] Density changes application spacing without hiding information or reducing control semantics.
- [ ] Terminal font family, size, line height, and scrollback update mounted xterm instances.
- [ ] Scrollback remains within documented privacy and memory bounds.
- [ ] The default preset initializes the new-terminal flow and falls back honestly when unavailable.
- [ ] Settings open from a visible control, `Cmd/Ctrl ,`, and a palette result.
- [ ] Cancel does not mutate current preferences; Restore defaults is explicit and reviewable before Apply.
- [ ] The dialog is keyboard reachable, labelled, focus-contained, and closes with Escape.
- [ ] Notification preference copy states that delivery begins with agent-attention support.
- [ ] Preference, shortcut, terminal-option, and server-rendered settings states have deterministic tests.
- [ ] The full repository verification gate passes.

## User experience

Settings opens as a compact modal above the terminal workspace. Appearance, terminal, launch, and notification sections use concise controls with the current effective values visible. Changes remain a draft until Apply; Cancel leaves the workspace untouched. Restore defaults updates the draft and requires Apply.

Applying preferences closes the dialog, updates the application theme/density and every mounted terminal, and announces the result. Existing PTYs, tab/split state, terminal input ownership, and reconnect cursors survive unchanged.

If a stored default preset is unavailable on the host, the new-terminal flow selects the first available fixed preset and explains availability through its existing UI.

## Architecture

- Systems and modules touched: browser preference model/store, settings component, App shell and shortcut/palette routing, split workspace props, terminal-ui options, theme/density CSS, tests.
- Systems of record: one browser-local versioned preference record; PTY and session truth remain server-owned.
- State transitions: load/parse, open draft, edit, restore draft defaults, cancel, apply/persist, effective theme change.
- Protocol/schema impact: none.
- Relevant ADRs: ADR-0013, ADR-0014, ADR-0015.

## Security and privacy

- Authorization: no new endpoint or transport operation.
- Privilege: preferences only affect browser rendering and selection defaults.
- Secrets/logging: no path, terminal text, environment, token, or provider credential enters the preference record.
- Abuse/failure scenario: extremely large or malicious stored JSON is length-bounded before parse and strictly validated before use.

## Reliability

- Idempotency: applying the same normalized preferences produces the same record and options.
- Timeouts/retries: none.
- Restart behavior: preferences restore after browser refresh; they intentionally do not synchronize across browser profiles.
- Unknown outcome: local-storage write failure leaves current in-memory preferences active and reports that refresh restoration is unavailable.
- Migration/rollback: unknown versions fall back; removing the feature leaves one disposable browser-local key.

## Test plan

- Unit: defaults, strict parse, field/range rejection, serialization, preset fallback, effective-theme resolution.
- Contract: none.
- Integration: mounted terminal option updates and fit behavior.
- Browser: open/edit/cancel/default/apply/refresh/theme/density/terminal workflow when available.
- Failure/recovery: malformed/oversized storage, unavailable preset, local-storage failure.
- Security: extra keys and non-preference content are rejected; terminal contents are never stored.

## Dependencies

- Blocked by: xterm integration, fixed launch presets, command palette, browser-local restoration patterns.
- Blocks: PC-028 accessibility baseline, PC-032 notification policy, later user-defined preset defaults.

## Evidence required

- Preference-model, terminal-option, shortcut, and settings-markup results.
- Full `pnpm verify`.
- Loopback runtime smoke.
- Rendered theme, density, keyboard, focus, and refresh workflow when a browser backend is available.

## Open questions

- Cross-browser preference synchronization remains intentionally deferred.
