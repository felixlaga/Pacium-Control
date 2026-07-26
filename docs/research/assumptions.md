# Assumptions

> Historical blueprint: these assumptions concern the superseded remote control plane unless restated in the active roadmap.

Assumptions are hypotheses, not facts. Each should be validated during implementation or pilot use.

## Product assumptions

1. The main pain is operational visibility and human routing, not agent capability.
2. A structured Inbox will replace most queue-file and terminal interactions.
3. The terminal can remain secondary without frustrating expert operators.
4. A Linear-inspired dense interface will scale better than chat-centered navigation.
5. Users will accept explicit role and repository boundaries in exchange for team access.
6. Evidence-backed review will improve trust more than richer agent prose alone.
7. Mobile value is concentrated in questions, approvals, summaries, and incidents.

## Workflow assumptions

1. Meta and orchestrator are useful distinct roles.
2. The orchestrator can emit structured questions and acknowledge decisions reliably.
3. One worktree per worker is compatible with existing repository workflows.
4. Integration can be modeled as a distinct serialized task.
5. Legacy queue files can be migrated incrementally.
6. Cross-provider handoffs are more reliable than direct terminal-to-terminal communication.

## Technical assumptions

1. One authoritative writer can meet initial throughput.
2. JSON entities plus partitioned JSONL events can meet startup and query targets.
3. tmux control mode exposes sufficient discovery and event behavior for supported versions.
4. PTY streaming through a broker can feel interactive over Tailscale.
5. Tailscale Serve identity headers can provide the intended trusted ingress boundary.
6. Claude Code hooks/status and Codex App Server provide enough structured telemetry for useful state.
7. Provider-native integrations can degrade cleanly to terminal observation.
8. A modular monolith plus broker is operationally simpler than microservices.
9. Git worktrees are stable enough for sustained multi-agent use on target repositories.

## Security assumptions

1. Tailnet membership alone is insufficient and application membership is enforceable.
2. The team can use approved individual/organizational provider execution identities.
3. A dedicated tmux server or Unix identity can isolate Pacium-managed sessions sufficiently.
4. Browser terminal risk can be bounded through strict asset and grant policy.
5. Provider agents should be treated as potentially influenced by untrusted repository content.

## Operational assumptions

1. The primary Hetzner VPS is acceptable as the initial control host.
2. Browser/API/broker downtime is tolerable if tmux sessions continue.
3. Daily encrypted off-host backups meet early recovery needs.
4. The team can maintain a tested break-glass shell path.
5. Multiple web/API nodes are unnecessary initially.

## Validation rule

Every assumption should eventually be marked:

- confirmed by evidence;
- partially confirmed;
- rejected;
- still open.

When an assumption is rejected, update product/architecture documents and create an ADR if the remedy changes a frozen decision.
