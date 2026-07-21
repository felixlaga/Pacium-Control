# ADR-0009: Keep the terminal as a secondary escape hatch

- Status: Accepted
- Date: 2026-07-20

## Context

The operator dislikes terminal-heavy operation because it is visually noisy, slow to parse, and poorly suited to multiple concurrent agents. Yet the terminal remains essential for precision, troubleshooting, and trust.

## Decision

Design the product around structured views and actions. The terminal is:

- available from every relevant session/run;
- read-only by default;
- write-controlled through an explicit lease;
- collapsible and full-screen capable;
- the fallback when an adapter or abstraction is insufficient.

Routine questions, approvals, steering, status, and review should not require it.

## Consequences

### Positive

- Lower cognitive load.
- Better team access without unrestricted shell use.
- Stronger audit and idempotency for routine actions.
- Terminal retains credibility as a fallback.

### Negative

- The team must build structured workflows rather than merely embed xterm.
- Some provider output may be difficult to normalize.
- Feature work must include both abstraction and escape hatch behavior.

## Validation

Pilot metrics should track the percentage of routine decisions and steering actions completed without terminal access, while preserving low-latency terminal availability.
