# Design language

## Direction

Pacium should feel calm, precise, fast, and intentionally organized. The reference is the interaction discipline of products such as Linear: strong hierarchy, dense but readable information, restrained chrome, consistent actions, contextual commands, and keyboard speed.

Pacium must not copy Linear’s brand, iconography, exact colors, or component styling.

Useful reference principles:

- [Linear UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh)
- [How Linear redesigned its UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear concepts and action model](https://linear.app/docs/conceptual-model)

## Visual hierarchy

The visual priority is:

1. focused terminal or decision;
2. attention state and immediate action;
3. contextual work such as diff or activity;
4. navigation and orientation;
5. secondary metadata.

The sidebar should be quieter than the terminal canvas. The inspector should never compete with the selected work unless it contains an active queue item.

## Color

Use a neutral foundation with one restrained accent.

Semantic colors are reserved for:

- needs input;
- failure;
- success/completion;
- warning/stale;
- selected/focused state.

Color always pairs with text, shape, or icon. Provider identity should use labels and icons, not broad colored surfaces.

Both dark and light themes are first-class. Dark mode should not collapse into pure black panels separated by bright borders. Light mode should retain enough contrast for dense terminal-adjacent information.

## Surfaces and borders

- Prefer subtle tonal separation over stacked cards.
- Use borders sparingly to express real containment or focus.
- Keep corner radii modest and consistent.
- Avoid floating glass, heavy shadows, gradients, and decorative glow.
- Terminal splits use a clear focused edge and quiet unfocused dividers.
- Dense lists use alignment and rhythm rather than card boxes.

## Typography

Use two coordinated families:

- interface sans for navigation, labels, metadata, queue items, and inspector;
- terminal monospace for PTYs, commands, paths, hashes, and diffs.

The hierarchy should rely on weight, size, and contrast—not many unrelated styles.

Suggested levels:

- 12 px compact metadata;
- 13 px dense rows and controls;
- 14 px default interface text;
- 16–18 px screen or inspector title;
- configurable terminal font, default approximately 13–14 px.

## Spacing and density

Use a compact 4 px base grid.

- Dense rows: 28–32 px.
- Standard controls: 32–36 px.
- Panel padding: 8–12 px.
- Major section separation: 16–24 px.

Density is controlled, not cramped. Alignment, baseline consistency, and predictable hit targets matter more than minimizing every pixel.

## Layout

The desktop layout has:

- compact top bar;
- 220–280 px session sidebar;
- dominant flexible terminal canvas;
- 320–440 px collapsible inspector;
- optional compact status bar.

Panels resize within minimum and maximum limits. The main terminal never becomes an unusably narrow strip merely to preserve the inspector.

## Motion

- Motion explains state change, focus, panel movement, or item insertion.
- Keep transitions short and interruptible.
- Do not animate continuous terminal activity.
- Respect reduced motion.
- Avoid celebratory or decorative motion in the work surface.

## Icons

- Use one coherent icon set.
- Prefer 14–16 px icons in dense controls.
- Every semantic icon has a label or accessible name.
- Use filled/stronger variants sparingly for active attention.
- Provider marks remain visually subordinate to session and state.

## Interaction consistency

Frequent actions should be available through the same four paths where appropriate:

1. visible button;
2. contextual menu;
3. keyboard shortcut;
4. command palette.

The command palette ranks actions for the active context. Context menus display shortcuts to teach the keyboard model.

## Copy

Copy is concise and operational.

Good:

> Codex is waiting for input.

> Terminal disconnected. The process is still running.

> Direct PTY ended when the local server stopped.

Weak:

> Agent attention required.

> Something went wrong.

Errors state what happened, what survived, and the next action.

## Design review questions

- Is the terminal or active decision visually dominant?
- Can the operator find the session needing attention within five seconds?
- Does inactive navigation recede?
- Are controls located consistently across screens?
- Can every frequent action be performed by keyboard?
- Is terminal focus unmistakable?
- Does every status state its source and freshness where relevant?
- Does the layout remain legible with twenty sessions?
- Is any decorative element competing with work?
