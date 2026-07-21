# ADR-0003: Integrate Claude Code and Codex through CLI only

- Status: Accepted
- Date: 2026-07-20

## Context

The intended operating environment is a Hetzner VPS and optional local hosts accessed through Pacium Control. The operator will not use Claude or Codex desktop applications.

Desktop dependencies would complicate headless operation, team access, and remote session durability.

## Decision

Integrate only:

- Claude Code CLI running in tmux, enriched through supported hooks/status telemetry;
- Codex CLI running in tmux, optionally enriched through a local CLI App Server;
- terminal fallback for both.

No desktop application is required for launch, authentication, control, monitoring, or daily use.

## Consequences

### Positive

- Headless VPS operation.
- Clear tmux/session ownership.
- Lower dependency surface.
- Better alignment with existing workflow.
- Consistent remote control model.

### Negative

- Some desktop-only convenience features are unavailable.
- CLI protocol/version changes must be handled.
- Provider authentication must be supported in headless workflows.
- Clean semantic transcripts may be less complete without native CLI events.

## Alternatives considered

- Desktop automation or remote desktop: rejected as fragile and contrary to the operating model.
- Provider API-only custom agents: rejected because it would rebuild Claude Code/Codex behavior and become a new agent framework.

## Validation

Installation and smoke tests must run on a headless Linux host. Documentation must never instruct users to open a provider desktop app.
