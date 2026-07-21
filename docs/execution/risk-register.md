# Risk register

Risk scoring is qualitative: likelihood and impact are low, medium, or high. Review at every milestone.

| ID | Risk | Likelihood | Impact | Mitigation | Trigger / owner action |
|---|---|---:|---:|---|---|
| R-01 | tmux control mode differs across installed versions | Medium | High | capability detection, fixtures, supported-version matrix, fallback | unsupported event/command behavior |
| R-02 | terminal input duplicates after reconnect | Medium | High | idempotent prompt records, per-pane serialization, explicit unknown state | uncertain delivery or duplicate text |
| R-03 | filesystem transaction leaves entity/event mismatch | Medium | High | journal, fault injection, startup recovery, snapshots | integrity check failure |
| R-04 | state directory grows and startup becomes slow | Medium | Medium | partition events, snapshots, indexes, archive policy, benchmarks | startup exceeds budget |
| R-05 | browser terminal exposes secrets through scripts/logs | Medium | High | isolated assets, CSP, no analytics, bounded retention, redaction | secret found in browser/log bundle |
| R-06 | tailnet membership is mistaken for app authorization | Medium | High | explicit memberships and object RBAC, deny by default | unauthorized repository visibility |
| R-07 | tmux socket grants control beyond intended sessions | Medium | High | dedicated Unix/tmux domains, broker boundary | unrelated session accessible |
| R-08 | provider CLI update breaks adapter | High | Medium/High | version detection, fixtures, capability negotiation, terminal fallback | parse failures after update |
| R-09 | Claude hook blocks or destabilizes agent | Medium | High | bounded hook execution, local queue, fail-visible nonblocking design | increased provider latency/hangs |
| R-10 | Codex App Server transport is exposed or unauthenticated | Low/Medium | High | local transport, broker ownership, explicit auth, no browser access | network listener detected |
| R-11 | question answer delivered but not applied | Medium | Medium | lifecycle through acknowledgement/application, stale escalation | answered item remains unapplied |
| R-12 | legacy queue import creates duplicates/conflicts | High | Medium | stable IDs/hashes, staged migration, conflict UI | same item appears twice |
| R-13 | agents edit same worktree | Medium | High | ownership contract, broker enforcement, task assignment validation | overlapping owner detected |
| R-14 | integration branch races | Medium | High | explicit integration task/lease/queue | simultaneous merge attempt |
| R-15 | agent prompt injection obtains broad permission | Medium | High | exact approval context, least privilege, policy checks, human review | suspicious action request |
| R-16 | personal provider account becomes shared team service | Medium | High | separate operator/execution identity, organizational credential policy | multiple users operating one personal identity |
| R-17 | usage dashboard misleads due to missing provider fields | High | Medium | unavailable state, source/freshness, provider-separated semantics | zero displayed for absent data |
| R-18 | stale detection causes disruptive false interventions | Medium | Medium | confidence/explanation, adaptive thresholds, least-disruptive ladder | frequent false stale reports |
| R-19 | laptop host becomes critical dependency | Low | High | outbound optional host model; central VPS independent | VPS workflow blocked by laptop offline |
| R-20 | host reconnect replays dangerous command | Medium | High | deadlines, idempotency, uncertain state, no blind replay | command outcome unknown on reconnect |
| R-21 | backup exists but restore fails | Medium | High | scheduled restore drills, checksums, separate-machine test | untested backup age threshold |
| R-22 | disk full blocks state and damages workflow | Medium | High | monitoring, reserved space, fail-closed writes, cleanup policy | disk threshold exceeded |
| R-23 | public Hetzner port accidentally exposed | Low/Medium | High | loopback bind, firewall tests, startup checks, deployment review | external scan reaches service |
| R-24 | UI becomes another noisy dashboard | Medium | Medium | Inbox discipline, hierarchy, user testing, notification guardrails | rising interruptions per task |
| R-25 | product turns into generic agent framework | Medium | High | non-goals, architecture review, wedge-first roadmap | planner/memory platform work dominates |
| R-26 | agent-generated summary is trusted over evidence | High | Medium | deterministic fact base, linked claims, clear labels | unsupported completion claim |
| R-27 | repository path traversal or symlink escape | Medium | High | canonical paths, allowed roots, no user path concatenation, tests | operation outside root |
| R-28 | role revocation does not terminate streams/leases | Medium | High | central revocation events, short grants, server checks | revoked user remains connected |
| R-29 | audit logs contain sensitive prompt/terminal content | Medium | High | hashes/metadata, redaction, retention review | secret scanning alert |
| R-30 | excessive early architecture slows delivery | Medium | Medium | vertical slices, modular monolith, no speculative services | milestone lacks usable demo |

## Review process

For every milestone:

1. update likelihood and impact;
2. add newly discovered risks;
3. link incidents or tests;
4. verify mitigation owners;
5. convert triggered risks into issues;
6. record accepted residual risk in release notes.
