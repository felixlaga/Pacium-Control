# Keyboard and command model

Pacium is keyboard-first, with every action also available through visible controls or contextual menus.

## Global shortcuts

| Shortcut                 | Action                                            |
| ------------------------ | ------------------------------------------------- |
| `Cmd/Ctrl K`             | Open contextual command palette                   |
| `Cmd/Ctrl Shift T`       | New terminal                                      |
| `Cmd/Ctrl P`             | Find session, workspace, repository, or file      |
| `Cmd/Ctrl ,`             | Settings                                          |
| `Cmd/Ctrl B`             | Toggle session sidebar                            |
| `Cmd/Ctrl Shift B`       | Toggle inspector                                  |
| `Cmd/Ctrl 1…9`           | Focus terminal tab                                |
| `Cmd/Ctrl Shift [` / `]` | Previous/next terminal tab                        |
| `Cmd/Ctrl \`             | Split right                                       |
| `Cmd/Ctrl Shift \`       | Split down                                        |
| `?`                      | Shortcut reference when terminal is not capturing |

Shortcuts must respect operating-system conventions and international layouts. Final mappings require hands-on validation.

## Session navigation

| Shortcut            | Action                                                     |
| ------------------- | ---------------------------------------------------------- |
| `G` then `S`        | Focus sessions                                             |
| `J` / `K` or arrows | Next/previous session in sidebar                           |
| `Enter`             | Open selected session                                      |
| `Space`             | Peek session in inspector without changing active terminal |
| `Shift Enter`       | Open selected session in a new split                       |
| `E`                 | Rename selected session                                    |
| `P`                 | Pin/unpin selected session                                 |
| `Cmd/Ctrl Shift W`  | Close selected session with consequence-aware confirmation |

Sequence shortcuts do not run while terminal capture or a text field is active.

## Terminal focus

- Enter terminal capture by clicking the terminal or using the pane-focus command.
- `Ctrl+Shift+.` exits capture.
- While captured, terminal input receives keys except browser-reserved combinations and the escape chord.
- Focused pane, selected sidebar row, and inspector preview are separate states.

## Split navigation

Use discoverable directional commands, with exact platform mappings validated during implementation:

- focus left/right/up/down;
- move session to adjacent pane;
- maximize/restore pane;
- close split without necessarily terminating the session.

## Pacium mode

| Shortcut     | Action                                                 |
| ------------ | ------------------------------------------------------ |
| `G` then `P` | Toggle/open Pacium mode                                |
| `G` then `M` | Focus Meta                                             |
| `G` then `O` | Focus Orchestrator                                     |
| `G` then `Q` | Focus queue                                            |
| `1…9`        | Select question option when queue inspector owns focus |
| `M`          | Add note                                               |
| `Enter`      | Review/confirm decision                                |

Approval decisions require deliberate labelled actions and confirmation. Question shortcuts cannot execute while terminal capture or a text field is active.

## Command palette

The palette ranks context first.

Examples:

```text
New terminal in Checkout API…
Split with Orchestrator…
Interrupt Codex — API…
Relaunch selected session…
Show changed files…
Run verification: unit tests…
Switch to Pacium mode…
Send prompt to Meta…
Answer selected question…
Open diagnostics…
```

Commands state target and consequence. Destructive actions never execute immediately from fuzzy search selection.

## Context menus

Context menus mirror palette actions and display shortcuts. They are available for:

- session rows;
- terminal tabs;
- split headers;
- repository groups;
- changed files;
- queue items.

## Accessibility

- Logical tab order.
- No keyboard trap inside terminal or split layout.
- Visible focus separate from selection.
- Screen-reader labels for icon-only controls.
- Live announcements for terminal capture, process exit, reconnect, and queue decisions.
