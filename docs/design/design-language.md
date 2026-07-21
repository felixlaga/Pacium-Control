# Design language

## Design intent

Pacium Control should feel calm, precise, dense, and fast. The visual system is inspired by the operational clarity of products such as Linear without copying their identity.

The design must hold up under real load: many repositories, active runs, questions, agents, failures, and usage warnings. Decorative emptiness is not the target.

## Experience qualities

### Calm

Activity should not feel like alarm. Motion is restrained. Severity is earned. Background work is visible without competing with items that need a human.

### Legible

Names, ownership, state, freshness, and next action should be readable at a glance. Avoid clever labels and ambiguous icons.

### Direct

Common actions are one or two interactions away. Keyboard flows are first-class. The product should feel attached to the underlying machines, not like a delayed reporting dashboard.

### Trustworthy

The UI distinguishes observed, inferred, stale, unavailable, and failed state. It shows consequences before privileged actions and confirms delivery afterward.

### Technical without being ugly

The product can expose branches, commits, commands, panes, and context windows while maintaining hierarchy and typography. Technical density is not an excuse for visual noise.

## Layout

### Left rail

- fixed workspace context;
- global navigation;
- compact status indicators;
- collapsible repository favorites;
- user and system status at the bottom.

### Main area

Supports list, board, timeline, diff, and focused detail layouts. Tables should preserve column alignment and keyboard navigation.

### Inspector

A contextual right panel for quick decisions. It should not duplicate an entire page. Selection state must be shareable only when appropriate; deep objects receive stable URLs.

### Terminal drawer

Hidden by default, resizable, and capable of full-screen expansion. The drawer header always displays session, host, role, provider, repository, run, control owner, and connection state.

## Typography

Use a neutral, high-legibility sans-serif for interface text and a carefully chosen monospace font for terminal, commands, branches, hashes, and code.

Hierarchy should rely on size, weight, spacing, and placement before color.

Suggested scale:

- Page title: 24–28px.
- Section title: 16–18px.
- Body: 13–15px.
- Dense table: 12–13px.
- Metadata: 11–12px.
- Terminal: user-configurable, default 13–14px.

## Color semantics

Use a restrained neutral base with semantic accents.

### Role accents

- Meta: violet.
- Orchestrator: amber.
- Worker: blue.
- Reviewer: teal.
- Generic terminal: slate.

### State accents

- Working: blue or neutral animated indicator.
- Waiting on human: orange.
- Waiting on agent/dependency: amber.
- Verifying: indigo.
- Review ready: teal.
- Completed: green.
- Failed or blocked: red.
- Disconnected or stale: grey with explicit label.

Color must always be paired with text, icon, or shape.

## Naming pattern

Display names should lead with human context:

```text
Checkout API · Orchestrator · Claude
Web App · Worker 02 · Codex
Platform · Reviewer · Claude
```

Avoid exposing raw tmux identifiers as the main label.

## Density

Support at least two density modes:

- Comfortable for normal use.
- Compact for operators managing many runs.

Density changes spacing, not information hierarchy or accessibility.

## Motion

Use motion only to explain change:

- newly arrived Inbox item;
- state transition;
- terminal drawer opening;
- control lease change;
- progress update.

Avoid continuously pulsing every live agent. One subtle activity signal is enough.

## Copy style

Copy should be concise, specific, and operational.

Good:

> Waiting for Felix to approve `terraform apply` on staging.

Weak:

> This agent requires your attention.

Good:

> Terminal control expired. The session is still running.

Weak:

> Something went wrong.

Errors should explain what happened, what survived, and the next safe action.

## Empty and loading states

Avoid generic spinners when a skeleton or explicit connection state is more informative. Empty states should confirm whether the system is healthy.

Examples:

- “No questions need you. Five agents are working.”
- “No sessions discovered on this host. Broker last contacted 12 seconds ago.”
- “Native Claude telemetry is unavailable; terminal observation is connected.”

## Design review questions

- Can the operator identify the next action in under five seconds?
- Is uncertainty visible?
- Does the screen remain legible with ten times the sample data?
- Is keyboard focus obvious?
- Is any color carrying meaning alone?
- Can a dangerous action be triggered accidentally?
- Does the terminal feel like an escape hatch rather than the default?
