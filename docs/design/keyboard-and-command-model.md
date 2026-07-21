# Keyboard and command model

Pacium Control is designed for high-frequency expert use. Keyboard behavior must be consistent, discoverable, and safe.

## Principles

- Navigation and selection should not require a mouse.
- Dangerous actions should never be triggered by a single unmodified key.
- Shortcuts should work across lists with predictable focus.
- Terminal input must be clearly separated from application shortcuts.
- Every shortcut has an accessible visible equivalent.

## Global shortcuts

Suggested defaults:

| Shortcut | Action |
|---|---|
| `⌘/Ctrl K` | Open command palette |
| `g i` | Inbox |
| `g a` | Active |
| `g r` | Repositories |
| `g u` | Runs |
| `g g` | Agents |
| `g v` | Review |
| `g y` | Usage |
| `g l` | Activity |
| `/` | Focus search in current view |
| `?` | Show shortcut help |
| `Esc` | Close inspector/modal or clear selection |
| `` ` `` | Toggle terminal drawer when focus is not in an input |

Sequences should time out and display a small hint after the first key.

## List navigation

| Shortcut | Action |
|---|---|
| `j` / `↓` | Next item |
| `k` / `↑` | Previous item |
| `Enter` | Open selected item |
| `Space` | Toggle inspector or preview |
| `x` | Select item for bulk action where supported |
| `e` | Edit or answer selected item when safe |
| `c` | Create context-appropriate object |

## Question answering

When a question card has numbered options:

- `1`–`9` selects an option;
- `Enter` confirms if confirmation is required;
- `m` opens a note field;
- `d` defers or delegates if authorized;
- `a` opens “ask for more context.”

The UI must prevent a numeric shortcut from answering while focus is inside a text field or terminal.

## Approval actions

Approvals require deliberate combinations or confirmation:

- `Shift D` deny;
- `Shift O` allow once;
- `Shift R` allow narrowly for run;
- `Shift E` edit and allow;
- `Shift A` ask for another method.

High-risk approval always shows a confirmation panel with exact scope.

## Command palette

The command palette is not merely navigation. It supports typed, policy-aware operations:

```text
Open run…
Send prompt to meta…
Steer orchestrator for current run…
Request status from selected agent…
Open terminal for…
Take terminal control…
Pause current run…
Create question…
Start review…
Show changes since last visit…
```

Each command preview states the target and consequence before submission.

## Terminal focus

When the terminal has focus:

- application shortcuts are suspended except a dedicated escape chord;
- the UI shows a visible “Terminal input active” state;
- a reliable chord such as `Ctrl+Shift+.` exits terminal capture;
- control owner and lease expiry remain visible;
- clipboard actions follow browser and security policy.

## Customization

User-level shortcut customization may come later. The first release should prefer a stable, documented default to an elaborate mapping system.

## Accessibility

All keyboard actions must preserve logical focus order, visible focus indication, screen-reader labels, and no keyboard traps. See [accessibility.md](accessibility.md).
