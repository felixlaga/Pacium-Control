# Milestone 4 — Native agent enrichment

## Goal

Present cleaner agent activity and more reliable attention states using supported provider runtime events.

## Scope

- Claude hook and status ingestion;
- Codex native event ingestion where supported;
- provider capability and version detection;
- prompts, turns, tools, plans, approvals, usage, completion, and failure events;
- typed provider extensions;
- clean activity cards;
- explicit native, hook, process, terminal, and human sources;
- fallback to the terminal and process observer;
- provider diagnostics and authentication-health labels;
- relaunch manifests.

## Non-scope

- desktop application automation;
- provider API resale;
- universal conversation reconstruction;
- hidden automatic approvals;
- cross-provider quota comparison.

## Acceptance criteria

1. Terminal operation is independent of provider observer health.
2. Unsupported versions fail visibly.
3. Provider-specific meanings and usage remain distinct.
4. Native events improve confidence without overwriting contradictory terminal or process truth silently.
5. Approval events fail closed when response state is uncertain.
6. Provider payloads are bounded and redacted before persistence.
7. Raw provider fixtures cover every supported version.

## Demo

Run Claude and Codex sessions together, display native activity when available, disable each observer in turn, and verify the UI degrades honestly while the terminals remain usable.
