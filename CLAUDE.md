# Claude Code instructions

Claude Code agents must follow [AGENTS.md](AGENTS.md).

## Product constraint

Integrate Claude Code through the local CLI, hooks, and supported status interfaces. Do not depend on a Claude desktop application.

## Initial mode

Claude Code runs inside a Pacium-managed PTY.

The UI may observe process and terminal activity but must label inferred working, waiting, or completion state honestly.

## Native enrichment

After the terminal workspace works:

- detect the installed CLI version;
- isolate hook/status parsing behind an adapter;
- bound hook execution and payloads;
- keep failed hooks from blocking Claude;
- separate questions from permissions;
- redact secret-bearing tool data;
- preserve terminal operation when the observer fails;
- label source, confidence, freshness, and health.

## Pacium roles

Claude sessions may be Meta, Orchestrator, or workers.

- Meta helps the operator synthesize evidence and clarify queue items.
- Orchestrator owns the existing workflow and queue coordination.
- Pacium records source text and decisions independently of either role’s narration.
