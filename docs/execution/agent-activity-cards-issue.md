# PC-063: Build clean agent activity cards

## Problem

Pacium now receives bounded Claude and Codex activity, but the Activity
inspector renders every provider, process, Git, and verification fact through
the same generic text row. Prompt, message, tool, plan, question, approval,
usage, completion, and failure evidence therefore lacks the visual hierarchy
needed to supervise several agents quickly.

When provider evidence is absent or unhealthy, the operator must leave the
inspector and scan the terminal without a compact fallback. Pacium must not
solve that by parsing terminal output into authoritative agent state or by
copying a transcript into application state.

## Outcome

The selected session's Activity inspector presents a calm, compact timeline of
source-labelled cards with distinct operational emphasis for provider work,
decisions, completion, failure, Git, verification, and process lifecycle.
Every card links to its authoritative terminal or inspector surface.

When native or hook evidence is unavailable, degraded, failed, unsupported, or
stale, the operator may explicitly reveal a small browser-local excerpt from
the already-rendered terminal buffer. The excerpt is visibly low-confidence,
never becomes an activity fact, and is discarded on selection, connection, or
evidence-boundary change.

## Scope

- Add a bounded presentation kind, tone, metadata, and source target to each
  existing browser-side activity fact.
- Give prompt, message, turn, tool, plan, question, approval, usage,
  completion, and failure evidence distinct compact card presentation.
- Preserve provider-specific safe metadata such as Claude tool name, Codex
  item type, and typed usage scalars.
- Add one consistent action from each fact to Terminal, Changes, History, or
  Checks as appropriate.
- Add an explicit terminal fallback only when provider evidence is absent or
  not currently ready.
- Read at most four non-empty recent xterm buffer lines and 800 Unicode
  characters after an operator click.
- Render terminal fallback as inert preformatted text with explicit
  terminal/low-confidence/not-interpreted labels and Hide control.
- Clear fallback text on selected-session change, disconnect/reconnect, or
  provider-boundary change.
- Keep the existing seven-fact total ceiling, lazy refresh behavior, semantic
  inspector tab, and responsive shell.

## Non-scope

- Persisting activity cards, terminal excerpts, provider payloads, or
  transcripts.
- Parsing terminal text into working, waiting, completed, failed, question, or
  approval state.
- Displaying prompt text, agent message text, plan text, commands, command
  output, diffs, paths, question text, approval reasons, or provider request
  payloads.
- Adding protocol messages, server reads, polling, provider control, queue
  actions, notifications, search, filters, or a generalized event store.
- Full unsupported-version and observer recovery UX; PC-064 owns that slice.
- Relaunch behavior; PC-065 owns manifests.

## Acceptance criteria

- [ ] Provider prompt, message, turn, tool, plan, question, approval, usage,
      completion, and failure fixtures map to deterministic card kinds, tones,
      labels, metadata, and timestamps.
- [ ] Questions and approvals remain visually and semantically distinct, and
      neither card adds a decision action.
- [ ] Tool cards show only bounded typed tool/item labels; usage cards preserve
      Claude and Codex semantics without cross-provider comparison.
- [ ] Process, Git changes, Git history, and verification facts retain honest
      source and timestamp meaning within the same compact visual system.
- [ ] Every card has one keyboard-accessible source action that opens the
      existing Terminal, Changes, History, or Checks surface without changing
      PTY lifecycle.
- [ ] Terminal fallback appears only without ready provider evidence and only
      after explicit operator action.
- [ ] The fallback reads no more than four non-empty recent terminal lines and
      800 Unicode characters from the existing browser xterm buffer, performs
      no attach/input/server request, and stores nothing durably.
- [ ] Terminal fallback is labelled terminal-derived, low-confidence, and not
      interpreted as agent status; it never enters the fact timeline,
      attention reducer, notifications, or provider snapshot.
- [ ] Fallback text is inert, bounded, hidden on request, and cleared across
      selection, connection, and provider-evidence changes.
- [ ] Empty/unrendered terminal, loading, partial evidence, 320 CSS px, 200%
      zoom, forced colors, reduced motion, focus, and keyboard states remain
      usable.
- [ ] Full verification and browser workflows pass without changing terminal,
      Claude, Codex, Git, queue, or Tailscale authority behavior.

## User experience

Recent facts become a compact timeline. A small marker and operational label
make urgent decision or failure cards scannable without broad colored
surfaces. The title remains the primary line; source, confidence, typed
metadata, and time recede into a consistent metadata row. Each card ends with
one short source action such as `Terminal`, `Changes`, `History`, or `Checks`.

If provider evidence is not ready, a quiet `Terminal fallback` section explains
why it is available. `Show recent terminal text` captures only the newest
bounded non-empty lines already held by the visible xterm surface. It does not
update automatically. The resulting text is shown in a terminal-colored
inert block beside `Terminal-derived`, `Low confidence`, and `Not interpreted`
labels. Empty or unavailable buffers explain how to recover without implying
the PTY ended.

## Architecture

- Systems and modules touched: browser activity projection/presentation,
  terminal-surface read handle, styles, semantic tests, and browser workflow.
- Systems of record: provider observations own native/hook facts; PTY/session
  state owns process truth; Git and verification own their existing facts;
  xterm owns the ephemeral parsed terminal buffer.
- State transitions: facts remain pure projections; fallback is hidden ->
  explicit capture -> ready/empty/unavailable -> hidden/invalidated.
- Protocol/schema impact: none; protocol 21 remains unchanged.
- Relevant ADRs: ADR-0010, ADR-0012, ADR-0013, ADR-0015.

## Security and privacy

- Authorization: card navigation reuses existing browser state and inspector
  actions; fallback makes no network request and grants no new authority.
- Privilege: no process, filesystem, Git, provider, terminal-input, or shell
  operation is added.
- Secrets/logging: excerpt text remains only in component memory, is never
  logged or persisted, and is cleared at evidence boundaries.
- Abuse/failure scenario: xterm-parsed text, bidi/control-like characters, HTML,
  links, commands, and hostile content render only as React text in `pre`;
  bounds apply before component state is updated.

## Reliability

- Idempotency: each explicit capture replaces the previous bounded excerpt;
  it never retries input or requests server state.
- Timeouts/retries: none; the synchronous read returns ready, empty, or
  unavailable immediately.
- Restart behavior: browser reload and local-server reconnect discard the
  excerpt; existing terminal snapshot behavior remains independent.
- Unknown outcome: an unavailable surface or empty buffer is reported without
  inferring agent or process state.
- Migration/rollback: no durable or protocol migration; remove the card fields,
  fallback handle, and presentation to restore the current Activity view.

## Test plan

- Unit: provider-kind mapping, tones, metadata bounds, source targets,
  provider-specific usage, seven-fact ceiling, and terminal excerpt bounds.
- Contract: protocol stays 21 and provider content exclusions remain strict.
- Integration: none; existing session/provider/Git/verification boundaries are
  reused unchanged.
- Browser: compact cards, source navigation, explicit terminal fallback,
  hide/refresh, session/reconnect invalidation, unchanged terminal selection,
  narrow width, zoom, forced colors, and reduced motion.
- Failure/recovery: missing terminal surface, empty buffer, unavailable/stale
  provider, disconnect, and provider recovery.
- Security: hostile terminal/commit/provider-safe metadata renders as text; no
  automatic capture, persistence, input, attach, decision, or command path.

## Dependencies

- Blocked by: PC-038, PC-060, PC-061, PC-062.
- Blocks: PC-064 and PC-065.

## Evidence required

- Focused activity-model, semantic component, and terminal-excerpt tests.
- Browser evidence for card hierarchy, source actions, explicit fallback,
  clearing, and responsive/accessibility states.
- Full `pnpm verify` and `pnpm test:e2e`.
- Synchronized backlog, status, README, issue, plan, and changelog at an exact
  tested commit.

## Open questions

- Provider-authored safe summaries remain unavailable in the current strict
  adapters. Future content display requires a separate bounded content contract
  and privacy review rather than relaxing this card slice.
