# Implementation plan: tmux keep-alive launches and restart reattachment

- Issue: PC-071
- Owner: Pacium Control
- Agent/session: Codex
- Branch: `codex/tmux-keepalive`
- Worktree: `/Users/felix/Documents/GitHub/Pacium Control`
- Base commit: `e498da8d2e4c2e7ea29ae88dc5b8f7af188f962c`
- Target milestone: Milestone 5 — Durability, packaging, and polish
- Status: In progress

## Objective

Add an explicit per-launch tmux keep-alive choice and restore only those exact
opted-in targets after local-server restart, without changing the direct-PTY
default, accepting command authority from the browser, or rerunning a missing
target.

## Existing behavior

Protocol 23 can discover and manually attach one configured external tmux
server/session. Attachment runs through the normal PTY pipeline and retains a
manual reattachment manifest. New fixed presets always use direct PTYs.
Local-server restart ends direct PTYs and tmux clients; the external tmux target
may survive, but every retained manifest currently requires explicit Recovery.

## Proposed behavior

The existing `session.create` payload gains one optional `keepAlive` boolean.
When false or absent, behavior is unchanged. When true, the session manager
requires a ready adapter, validates the cwd and fixed preset, generates a
`pacium-<uuid>` tmux name, and asks the adapter to run fixed bounded
`new-session -d -P -F ... -s ... -c ... -x ... -y ... <executable> <args...>`.
tmux documents multiple shell-command arguments as direct execution without
`sh -c`.

The returned target becomes a `keep_alive` tmux client spec. Its durable
manifest records the target, underlying preset command, provider
classification, and automatic restart policy before the client is claimed
live. Startup selects the newest manifest per exact target, bounds the set,
revalidates sequentially, and creates fresh linked Pacium client identities.

## Architecture and boundaries

### Modules touched

- contracts: protocol 24 keep-alive create and tmux mode/policy relationships.
- tmux adapter: generated-name detached direct-argv launch and strict result.
- session manager: managed launch, durable-before-client manifest, restore
  selection, classification, and lineage.
- startup/WebSocket: await bounded automatic restoration before listening.
- browser: ready-only unchecked keep-alive control and lifecycle labels.

### Data/state changes

- Extend tmux session/manifest evidence with `attached | keep_alive`.
- Keep schema-1 compatibility by treating absent mode as `attached`.
- No new state file; the existing bounded private manifest catalog stores the
  explicit policy.

### Protocol changes

- Protocol 24 adds optional `keepAlive: boolean` inside the strict existing
  session-create payload.
- Browser cannot send tmux target, socket, name, executable, argv, environment,
  or free-form policy.

### Authorization and privilege

- Existing authenticated WebSocket authority applies.
- The adapter owns socket/executable/tmux flags/output format/timeout.
- The session manager owns preset/cwd/dimensions/name and chooses whether
  automatic restoration is permitted from durable manifest evidence.

## Sequence

1. Define strict keep-alive mode/policy contracts and protocol tests.
2. Add direct-argv tmux launch with generated name and real adapter coverage.
3. Add managed tmux session creation and durable-before-client failure rules.
4. Add bounded newest-target startup restoration and exact lineage tests.
5. Wire strict WebSocket/transport create input.
6. Add unchecked ready-only UI control and keep-alive lifecycle copy.
7. Run focused, restart, real-tmux, full verify, and Chromium gates; sync docs.

## Failure model

| Failure point                       | Expected state                                   | Recovery                                |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------- |
| tmux unconfigured/unavailable       | no command or PTY created                        | Use direct mode or fix config           |
| `new-session` rejected/collision    | no Pacium session claimed                        | Deliberate new create                   |
| launch outcome uncertain            | exact generated name inspected once; no retry    | Recovery only if target was found       |
| manifest write fails                | client not claimed; durable target may survive   | Inspect tmux manually; no auto retry    |
| client PTY spawn fails              | target plus manifest retained, no live client    | Recovery or next server restart         |
| browser disconnect after request    | outcome unknown; request is not replayed         | Inspect refreshed sessions/Recovery     |
| server restart, target alive        | one fresh client and linked immutable identity   | Automatic from explicit policy          |
| server restart, target missing      | no client/command; retained unavailable Recovery | Operator decides whether to launch anew |
| duplicate retained target manifests | newest exact target restored once                | Older lineage remains bounded evidence  |

## Compatibility

- Existing protocol-23 browsers fail version negotiation rather than silently
  changing launch durability.
- Existing schema-1 direct and tmux attachment manifests remain valid and
  manual.
- Rolling back stops automatic clients but leaves external tmux targets and
  manifests intact.

## Test plan

- Unit: schemas, direct argv, generated names, output, launch errors, restore
  projection, classification, and UI copy.
- Integration: strict create, preset authority, manifest ordering, PTY
  input/resize/exit, restart restore, missing/direct/manual exclusions.
- Real tmux: isolated server launch, command marker, detach, rediscovery, attach.
- Browser: opt-in, default-off, label, reload, local-server restart, new ID,
  surviving target, and close semantics.
- Security: reject forged fields; prove metacharacters remain one direct argv
  argument and no shell side effect is created.

## Documentation changes

- Backlog, STATUS, README, changelog, milestone evidence, and keep-alive
  operator behavior.

## Rollout

- Development: fake adapter/PTY/store tests.
- Integration: isolated real tmux socket and restart harness.
- Browser: full Chromium suite.
- Production: no release claim; PC-072 through PC-076 remain.

## Open questions

- None.

## Approval

- Product: authorized by the owner's instruction to continue the remaining
  roadmap.
- Architecture: explicit opt-in under ADR-0013.
- Security: one configured safe socket and server-owned fixed presets only.
