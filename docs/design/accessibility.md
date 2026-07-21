# Accessibility

Accessibility is part of operational reliability. A control surface that cannot be used consistently under different visual, motor, or cognitive conditions is not complete.

## Target

Aim for WCAG 2.2 AA for the application interface, with documented exceptions and compensating controls for terminal content that Pacium does not generate.

## Keyboard

- Every action is keyboard reachable.
- Focus order follows visual order.
- Focus is visible at all times.
- Modals and drawers manage focus correctly.
- No keyboard trap exists, including inside the terminal.
- A dedicated escape chord leaves terminal capture.
- Shortcuts do not fire while typing in inputs.

## Screen readers

- Landmarks identify navigation, main content, inspector, and terminal.
- Dynamic state transitions use restrained live regions.
- Agent state, freshness, and confidence have textual labels.
- Question options are grouped with clear instructions.
- Approval consequences are announced before action controls.
- Tables have correct headers and row semantics.

## Color and contrast

- Color never carries meaning alone.
- Text and interactive controls meet contrast targets.
- Focus indicators remain visible in all themes.
- Role and state colors are distinguishable but secondary to labels and icons.
- Diff views include line and change-type semantics beyond color.

## Motion

Respect reduced-motion preferences. Avoid constant pulsing or animation across many live agents. State changes may use brief, nonessential transitions.

## Density and zoom

The interface should remain usable at 200% zoom and on narrow widths. Compact mode must not reduce target sizes below accessible thresholds.

## Cognitive load

- Use consistent vocabulary.
- Avoid unexplained provider jargon.
- Group consequences with decisions.
- Keep one primary action per context.
- Preserve stable layout during streaming updates.
- Do not reorder a list under the user’s pointer without warning.
- Allow pausing live updates in dense views.

## Terminal accessibility

The browser terminal should support:

- configurable font size and line height;
- high-contrast themes;
- search;
- copyable text;
- clear read-only/control state;
- terminal bell preferences;
- accessible labels around controls.

Terminal content itself may not be semantically structured. Equivalent structured workflows should exist for critical operations.

## Testing

Include:

- automated accessibility checks;
- keyboard-only workflow tests;
- screen-reader spot checks;
- contrast review;
- reduced-motion validation;
- zoom and responsive testing;
- testing of dynamic Inbox and terminal lease announcements.
