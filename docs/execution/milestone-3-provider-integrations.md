# Milestone 3 — Provider integrations

## Goal

Add rich, version-aware Claude Code and Codex CLI integrations while preserving tmux fallback and honest state confidence.

## Claude scope

- launch profile inside tmux;
- hook installation/receiver;
- hook payload validation and fixtures;
- lifecycle, tool, permission, task, and subagent events where supported;
- status-line usage/context ingestion;
- question and approval bridge;
- adapter health and version compatibility;
- redaction;
- terminal fallback.

## Codex scope

- launch profile inside tmux;
- local App Server lifecycle;
- authenticated/local transport;
- thread, turn, plan, message, command, approval, usage, and rate-limit events;
- steering and interruption;
- adapter health and version compatibility;
- ordinary tmux CLI fallback.

## Shared scope

- provider capability matrix;
- normalized state model;
- native/hook/inferred confidence;
- provider-specific extension payloads;
- usage UI;
- provider-neutral handoffs;
- cross-provider collaboration templates;
- authentication-health warnings;
- adapter diagnostics.

## Acceptance criteria

1. Claude and Codex sessions can run simultaneously in separate worktrees.
2. Installed CLI version and adapter capabilities are visible.
3. Unsupported versions fail clearly rather than being parsed optimistically.
4. Claude permission requests become Pacium approval requests.
5. Codex approval events become Pacium approval requests.
6. Provider response receives the exact authorized result or fails closed.
7. Plan/task/turn events enrich the run without overwriting provider-neutral state incorrectly.
8. Adapter failure degrades to terminal/inferred state.
9. UI distinguishes unavailable usage from zero.
10. Claude and Codex quotas remain separate.
11. Handoff between providers records branch/worktree/evidence lineage.
12. Secret-bearing payloads are redacted or excluded.
13. Fixture and contract tests cover supported protocol versions.
14. Real CLI smoke tests run in a controlled environment.

## Pilot scenarios

- Claude plans, Codex implements, Claude reviews.
- Codex prototypes, Claude evaluates.
- One provider nears context limit and hands off.
- Native adapter is intentionally disconnected during work.
- Provider authentication expires mid-run.
- Approval times out before human response.
