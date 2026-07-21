# Non-goals

A strong product is defined as much by what it refuses to become as by what it builds.

## Not a new agent framework

Pacium Control does not own universal planning, memory, reasoning, or tool selection. The meta and orchestrator sessions remain responsible for intelligent coordination. Pacium supplies contracts, state, visibility, and control.

## Not a model host

Pacium does not train, serve, or proxy language models as a core function. It operates provider CLIs and their supported local protocols.

## Not a Claude or Codex desktop integration

The product is CLI-only. Desktop applications are outside the architecture.

## Not a browser IDE

The product may display diffs, files, logs, and artifacts, but it does not aim to replace a full editor. Deep source editing remains in the team’s chosen development tools.

## Not a replacement for tmux

Pacium does not invent its own terminal-session runtime. tmux remains the durable substrate and can always be used directly.

## Not a replacement for Git or GitHub

Git remains the source of truth for source history. GitHub may be integrated for pull requests and checks, but Pacium does not duplicate repository hosting.

## Not public-by-default SaaS

The first product is private and tailnet-only. Public ingress, multi-tenant cloud hosting, billing, and internet-facing signup are not early goals.

## Not an unrestricted remote shell portal

Generic terminal access is useful, but it must be explicitly scoped and audited. Pacium is not a convenient way to give every team member shell access to every host.

## Not a personal credential sharing mechanism

The system separates operator identity from provider execution identity. It should support approved individual or organizational credentials, not normalize team use of one person’s private subscription.

## Not a notification firehose

Activity belongs in timelines and summaries. Inbox is reserved for work that needs a person.

## Not a database-backed SaaS architecture in disguise

The no-database decision is architectural. Do not add an embedded SQL engine, hosted document store, or hidden Redis cache and continue calling the product filesystem-native.

## Not perfect semantic reconstruction from arbitrary terminal output

When provider-native events are unavailable, Pacium may infer state from process and terminal signals. It must label those inferences and retain the raw terminal fallback rather than pretending every transcript can be parsed perfectly.

## Not automatic merging without evidence

Agents may prepare and recommend integrations. Completion and merge policy must remain explicit, testable, and reversible.

## Not broad platform work before the wedge works

Do not prioritize analytics, marketplace integrations, sophisticated scheduling, or generic workflow builders before the question/decision/acknowledgement loop is excellent.
