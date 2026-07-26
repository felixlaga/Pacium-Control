# Terminal experience

The terminal is Pacium Control’s primary work surface.

## Product role

The terminal must feel as immediate and trustworthy as a dedicated terminal application while benefiting from:

- session organization;
- tabs and splits;
- attention states;
- Git inspection;
- agent-aware activity;
- Pacium queue context.

## Session lifecycle

### Direct PTY

- Created and owned by the local server.
- Continues across browser refresh and tab close.
- Ends if the local server exits.
- May be relaunched from an explicit manifest.

### Optional tmux-backed

- Created or attached through an explicit tmux capability.
- May survive local-server restart.
- Always labelled as tmux-backed.

Pacium cannot silently attach to arbitrary existing terminal-emulator panes.

## Terminal pane

Header:

```text
Codex — Checkout API     working · terminal inferred     •••
~/code/checkout-api · feat/payment-flow
```

The body is the terminal emulator. Connection or exit overlays preserve visible terminal contents.

## Focus

- Click or explicit keyboard action enters terminal capture.
- Focused pane has a restrained but unambiguous border.
- Application shortcuts are suspended during capture.
- `Ctrl+Shift+.` exits capture by default.
- The status bar and accessible announcement confirm mode changes.
- Switching inspector tabs never steals terminal focus.

## Input

- Bytes are sent only to the focused session.
- Multiline paste uses bracketed paste where supported.
- Very large paste requires confirmation.
- Reconnect never automatically retries uncertain input.
- Duplicate browser clients do not both become accidental writers; the initial single-user design still establishes one active input owner per session.

## Resize

- Resize follows the focused pane’s measured dimensions.
- Debounce without leaving the PTY in a stale size.
- Hidden tabs do not repeatedly fight over dimensions.
- Moving a session between splits updates the PTY once the destination stabilizes.

## Scrollback and restoration

- Scrollback is bounded by preference and hard maximum.
- A headless terminal model or equivalent bounded snapshot supports browser reconnect.
- Search covers retained scrollback only.
- Scroll position remains stable while reading older output.
- New-output indicators appear when the user is not at the bottom.
- Raw scrollback is not persisted indefinitely by default.

## Connection states

- creating;
- live;
- reconnecting;
- overflow/resync required;
- process exited;
- close in progress;
- failed;
- tmux target unavailable.

Each state explains process survival.

## Terminal content safety

- Never render terminal strings as application HTML.
- Sanitize displayed titles.
- Confirm or reject unsafe link protocols.
- Do not allow silent clipboard writes.
- Bound OSC, title, hyperlink, and image-like payloads.
- Self-host terminal assets.
- Do not load analytics or session replay.

## Performance

- Terminal input should feel immediate.
- Output batching must reduce render overhead without noticeable lag.
- Background terminals may reduce render frequency but must not lose bounded state.
- Large output cannot grow memory without limit.
- Twenty idle sessions should not produce continuous CPU work.

## Accessibility

- Configurable font size and line height.
- Screen-reader mode according to the terminal library’s supported behavior.
- Minimum contrast.
- Visible focus.
- Reduced motion.
- Copy and selection remain usable without pointer-only gestures.
