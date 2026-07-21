# Open questions

These questions should be answered through focused research or prototypes, not prolonged abstract debate.

## Product

- What is the minimum information that makes a question answerable without opening the terminal?
- How should Inbox urgency combine blocking status, risk, waiting time, and run priority?
- Which steering actions deserve dedicated controls versus free-form prompt?
- How much provider reasoning should be shown by default?
- What is the right balance between list density and inspector depth?
- How should users see conflicting human decisions across runs?
- Which evidence is mandatory for different task classes?

## tmux and terminal

- Which tmux versions will be supported initially?
- Which control-mode notifications are reliable across those versions?
- What attachment strategy best supports terminal fidelity and reconnect?
- How should structured prompt delivery interact with active human typing?
- How can the broker distinguish semantic prompt acceptance from byte delivery?
- What scrollback limit is useful without retaining secrets excessively?

## Filesystem state

- What durability mode balances latency and crash guarantees on the target filesystem?
- Should every command use a journal, or only multi-file mutations?
- What event segment size/date partition performs best at expected load?
- How should old events be archived after snapshots?
- What search indexing approach remains rebuildable and database-free?
- How long should idempotency records be retained?
- What is the supported maximum state size before partitioning by workspace?

## Claude Code

- Which hook events and status fields exist in the exact supported CLI versions?
- Which hooks may provide or accept permission decisions safely?
- How should hook timeouts be configured to avoid blocking the CLI?
- Can a stable session ID survive restart/reconnect?
- Which usage/reset fields are reliable and under what account types?
- What provider-native state can be shown without parsing terminal output?

## Codex

- What is the stable local App Server transport for supported CLI versions?
- How should App Server and tmux TUI lifecycles be associated?
- Which turn/plan/approval events are durable versus ephemeral?
- How are rate-limit windows represented and refreshed?
- What is the correct fallback when App Server disconnects mid-turn?
- Which authentication flows work cleanly for non-desktop CLI operation on the VPS?

## Git

- Which repositories have submodules, LFS, generated files, or unusual worktree constraints?
- Should workers commit continuously or only at task checkpoints?
- Which verification commands are safe to run automatically?
- How should integration branches be structured per run?
- What cleanup retention protects debugging without filling disk?
- How should secrets in diffs/artifacts be detected and redacted?

## Identity and team use

- Which teammates need observation, structured steering, terminal control, or approvals?
- Should high-risk approvals require two people?
- How are provider execution identities assigned to team members and sessions?
- Which repositories or hosts require stricter segregation?
- What is the acceptable application-session lifetime?

## Operations

- What are realistic recovery point and recovery time objectives?
- Which off-host backup target is preferred?
- How should disk reserve and event retention be sized?
- Which monitoring system, if any, is already used by the team?
- How will a replacement VPS be bootstrapped during incident recovery?
- What is the policy for upgrading provider CLIs?

## Research output format

Each resolved question should produce:

- conclusion;
- evidence or prototype;
- supported versions/environment;
- implications;
- remaining uncertainty;
- linked issue or ADR.
