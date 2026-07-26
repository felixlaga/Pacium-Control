# Product and engineering principles

## 1. The terminal is the product

The first job is to make terminal-based agent work easier to see and manage. Structured views support the terminal instead of delaying it.

**Decision test:** Does this improve the daily experience of running and supervising terminals?

## 2. Calm density

Use strong hierarchy, restrained color, consistent spacing, and compact information. Navigation should recede while the active work stays visually dominant.

**Decision test:** Can the operator understand the screen quickly without decorative noise?

## 3. Fast by keyboard, obvious by mouse

Every frequent action should have a stable shortcut, visible control, contextual menu, and command-palette entry where appropriate.

**Decision test:** Can a new user discover the action and an experienced user perform it without friction?

## 4. Sessions are durable across browser state

Closing or refreshing the browser must not terminate running PTYs. The UI reconnects to the local server and restores visible state.

**Decision test:** What happens to this process if the browser tab disappears now?

## 5. Truth has a source

Process existence, terminal activity, provider-native events, Git state, and human labels mean different things.

**Decision test:** Is “working” or “done” supported by the source shown in the UI?

## 6. Attention, not telemetry

The session list should help the operator find what needs input, failed, or finished. Do not convert every byte or command into a notification.

**Decision test:** Does this state change require the operator to look now?

## 7. Local first means genuinely local

Bind to loopback, use local credentials already owned by the user, and avoid remote services in the critical path.

**Decision test:** Can the first product work offline after dependencies are installed?

## 8. Minimal state

Persist preferences, classifications, queue provenance, and restoration metadata. Do not duplicate terminal, Git, or provider truth into a speculative domain model.

**Decision test:** Which system already owns this fact?

## 9. Agent-aware, provider-honest

Claude and Codex can enrich the interface, but unavailable native events must degrade visibly to process or terminal inference.

**Decision test:** Would the user mistake an inference for a provider-confirmed event?

## 10. Pacium is a mode

Meta, Orchestrator, workers, and queue actions live inside the same terminal workspace. They do not require a parallel product shell.

**Decision test:** Can the operator enter and leave Pacium mode without losing terminal context?

## 11. Questions are not approvals

Advice, direction, and permission have different consequences and remain visibly distinct.

**Decision test:** Could answering an ordinary question grant execution authority?

## 12. Safe local shell access

Localhost is a network boundary, not a security exemption. Validate Origin, tokens, paths, commands, terminal content, and message sizes.

**Decision test:** Could an unrelated page or malformed terminal stream control or confuse this application?

## 13. Build visible value in vertical slices

One excellent real terminal is more valuable than a broad backend with no usable surface.

**Decision test:** Can the operator demonstrate this increment from the application?

## 14. Honest maturity

Designed, implemented, validated, packaged, and daily-use-proven are separate states.

**Decision test:** What repository evidence supports this claim?
