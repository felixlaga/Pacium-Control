# Codex instructions

Codex agents must follow [AGENTS.md](AGENTS.md).

## Product constraint

Integrate Codex through local CLI/runtime interfaces. Do not depend on a Codex desktop application.

## Initial mode

Codex runs inside a Pacium-managed PTY like any other terminal command.

The UI may infer:

- process alive;
- terminal active;
- terminal quiet;
- exited.

It must not infer native turn, plan, approval, completion, or usage semantics from terminal motion alone.

## Native enrichment

After the terminal workspace works, a local Codex runtime observer may provide structured turns, plans, messages, tool activity, approvals, usage, rate limits, completion, and failure.

- Keep transport local to the server.
- Detect capabilities and versions.
- Bound and validate payloads.
- Label observer health and fallback.
- Keep the raw terminal usable if native events fail.
- Never auto-approve because a callback is unavailable.

## Pacium roles

A Codex session may be classified as Meta, Orchestrator, or worker. Classification changes Pacium presentation and targeting, not operating-system privilege.
