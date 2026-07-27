# PC-048: Deliver immutable decisions through configured compatibility methods

## Problem

Pacium records an exact immutable local answer or approval outcome, but the
record still says **Not delivered yet**. The operator must manually copy it to
the configured answer file or Meta/Orchestrator terminal. A naive send is
unsafe: browser-supplied targets could widen filesystem or terminal authority,
refresh could duplicate terminal input, a crash could hide an already-started
side effect, and raw multiline answer text could execute in an idle shell.

## Outcome

From one decided exact queue item, the operator can deliberately deliver its
existing immutable record once through the source's accepted configured
`answer_file` or `role_prompt` method. Pacium persists intent before the side
effect and reports honest `delivered`, `failed`, or `unknown` evidence after
reload/restart. The browser cannot choose or alter the target or payload, and
no uncertain or completed attempt is retried in this slice.

## Scope

- Add strict delivery intent, target snapshot, payload hash, outcome, evidence,
  and result schemas.
- Upgrade queue state to version 2 while accepting and safely migrating valid
  version-1 decision-only state on the first later mutation.
- Permit at most one delivery attempt for one immutable decision.
- Resolve the delivery method only from the exact accepted workspace and queue
  source configuration.
- Revalidate the current queue item, decision hash, workspace revision, source,
  method, target, and role session immediately before intent persistence.
- Persist delivery intent before writing a target or sending terminal input.
- Deliver `answer_file` as one deterministic versioned UTF-8 JSON document
  created atomically and privately without overwriting an existing target.
- Deliver `role_prompt` as one bounded, deterministic, shell-safe comment line
  to the exact currently bound live Meta or Orchestrator PTY.
- Label role-prompt success as terminal-transport acceptance, not provider
  receipt, processing, acknowledgement, approval execution, or completion.
- Add a separate delivery action, exact target preview, confirmation, pending
  state, and durable outcome presentation to the decided-item inspector.
- Preserve queue sources, configuration, repositories, unrelated terminals,
  and immutable decision bytes.

## Non-scope

- Automatic delivery immediately after recording a decision.
- Browser-selected paths, roles, sessions, commands, formats, or payloads.
- Appending to an existing answer file, rewriting a response section, or
  overwriting a human or agent file.
- Retrying failed or unknown attempts, superseding decisions, or resolving
  delivery conflicts.
- Acknowledgement, applied/unable-to-apply state, provider callbacks, or
  provider-native approval execution.
- Launching a missing role session or inferring a role from name, cwd, output,
  process command, or provider state.
- Delivering failure, review, or unknown queue classifications.
- Generic terminal input, generic filesystem write, webhook, command, or
  `paciumctl` endpoints.
- Multi-user attribution, a database, multi-host delivery, or Tailscale
  identity changes.

## Acceptance criteria

- [x] Delivery requests contain only `requestId`, immutable `decisionId`, and
      `decisionHash`; strict schemas reject target, payload, path, role,
      session, terminal bytes, command, actor, or retry fields.
- [x] The server resolves the current decision, queue source, configured method,
      and exact target without accepting browser authority.
- [x] A decision can be delivered only while its complete current source
      identity and workspace revision still match; drift records no intent or
      side effect.
- [x] Intent is durable before any file creation or PTY input. An interruption
      after intent is exposed as `unknown` and never retried automatically.
- [x] One decision identity has at most one delivery attempt. Duplicate requests
      return the existing attempt and cannot duplicate a file or PTY write.
- [x] Version-1 decision state remains readable and migrates atomically to
      version 2 without changing any decision record or hash.
- [x] Answer-file delivery creates one mode-`0600` regular non-symlink target
      through same-directory temporary bytes and an atomic no-clobber publish.
- [x] An existing, symlinked, unsafe, changed-parent, or otherwise unavailable
      answer target is never overwritten and produces fixed bounded failure or
      unknown evidence.
- [x] The answer-file document is deterministic, versioned, bounded, valid
      UTF-8 JSON, includes exact decision provenance, and never includes queue
      source text, commands, secrets from the environment, or terminal data.
- [x] Role-prompt delivery requires the configured exact role to resolve to one
      live direct PTY and captures its immutable session ID and epoch.
- [x] Role-prompt bytes are one bounded comment-prefixed line plus one carriage
      return; operator text is JSON-escaped so newlines and controls cannot
      become additional shell input.
- [x] A terminal write accepted by the PTY is labelled `delivered` only at the
      terminal-transport boundary, with provider processing explicitly
      unverified.
- [x] The inspector shows no action when delivery is unconfigured or unsafe;
      otherwise it previews the configured method and target and requires an
      explicit second confirmation.
- [x] Reload and local-server restart recover ready, delivered, failed, or
      unknown delivery state without repeating a side effect.
- [x] Question delivery cannot create approval authority; approval delivery
      communicates the immutable approved/denied outcome but never executes the
      requested action.
- [x] Focused, contract, migration, file, PTY, integration, browser, security,
      full verification, and production-build evidence pass.

## User experience

A decided inspector replaces **Not delivered yet** with a **Delivery** section.
When the source has no method, it says **No delivery configured** and offers no
button. A configured answer file shows its accepted label and exact local path.
A role prompt shows Meta or Orchestrator plus the exact live session label; an
unbound, preset-only, ended, missing, or changed role is unavailable.

**Deliver answer** or **Deliver decision** opens an inline confirmation that
keeps the immutable decision and exact target visible. The copy explains the
side effect: create one new answer file, or send one shell-safe line to one
PTY. **Confirm delivery** starts the attempt; **Cancel** changes nothing. There
is no automatic delivery or keyboard shortcut.

Pending copy says intent is being made durable before the side effect. A
delivered file shows creation time, bytes, and content hash. A delivered role
prompt says terminal transport accepted one line and provider handling is not
confirmed. Failed evidence names a fixed safe reason and confirms the target,
queue source, and other terminals were not changed. Unknown evidence says the
side effect may have occurred, disables delivery, and directs the operator to
inspect the target manually. Refresh/reload never resends.

## Architecture

- Systems and modules touched: shared queue-delivery/state/protocol contracts;
  versioned queue-state store; delivery serialization, answer-file publisher,
  role-prompt adapter, and delivery service; WebSocket integration; browser
  reducer/transport/inspector/styles; tests and active docs.
- Systems of record: immutable decision records own operator intent;
  `pacium.json` owns source-to-method and role bindings; the queue observer owns
  exact current source evidence; queue-state delivery records own attempt
  lifecycle; target file or PTY owns only the external side effect.
- State transitions: decided/unconfigured; decided/ready -> confirming ->
  persisting intent -> delivering -> delivered | failed | unknown. Any
  persisted attempt disables another attempt.
- Protocol/schema impact: protocol 15 adds one narrow deliver request, one
  correlated result, and delivery state on exact decided-item inspection.
  Queue-state schema advances from 1 to 2 with explicit compatible read and
  atomic migration. Pacium config remains schema 1.
- Relevant ADRs: ADR-0001, ADR-0007, ADR-0012, ADR-0013, ADR-0014, ADR-0015,
  and ADR-0016.

## Security and privacy

- Authorization: existing Host/Origin/ephemeral-token WebSocket checks remain
  mandatory. Only accepted server configuration selects the method and target.
- Privilege: the local server may create one configured answer file or write
  one fixed-shape line to one configured live PTY. It gains no generic write,
  append, command, launch, provider, or repository authority.
- Secrets/logging: decision bodies, serialized payloads, paths, terminal bytes,
  state contents, and environment data never enter logs or safe error strings.
  State and created answer files are private.
- Abuse/failure scenario: forged IDs/hashes/targets, config/source drift,
  symlink swaps, existing targets, hostile multiline/control text, duplicate
  requests, concurrent attempts, partial writes, PTY exit, and crashes at every
  persistence/side-effect boundary fail closed or become durable unknown.

## Reliability

- Idempotency: one persisted attempt per decision. Replays return its current
  state and never invoke an adapter again.
- Timeouts/retries: no automatic or manual retry in PC-048. File operations are
  bounded; PTY write acceptance is synchronous and provider outcome remains
  unobserved.
- Restart behavior: version-2 state reloads attempts. An intent without a
  durable final outcome is presented as unknown.
- Unknown outcome: unknown is terminal for this slice and preserves exact
  attempt/target/payload provenance for PC-049 resolution.
- Migration/rollback: valid version-1 state reads as decisions plus no
  deliveries and migrates on first mutation. Older PC-047 code preserves but
  cannot interpret version 2; rollback must not rewrite or delete it.

## Test plan

- Unit: delivery schemas, deterministic payloads/hashes, target snapshots,
  shell-safe single-line encoding, reducer states, and UI models.
- Contract: protocol 15, strict forbidden extras, state/result invariants,
  maximum messages, and question/approval separation.
- Integration: v1 migration, intent-before-effect ordering, exact config/source
  revalidation, duplicate/concurrent attempts, answer-file no-clobber atomicity,
  real PTY one-line delivery, restart recovery, and unchanged external state.
- Browser: configured/unconfigured file and role targets, confirm/cancel,
  delivered/failed/unknown, reload, focus, selected-terminal preservation,
  narrow/zoom/forced-color/reduced-motion behavior.
- Failure/recovery: every state write boundary, temp/link/sync failure, existing
  or symlink target, role missing/ended/rebound, connection loss, and server
  reconstruction with pending intent.
- Security: forged target/payload/session/path/command fields, shell metacharacter
  and multiline fixtures, hostile rendered evidence, no logs, no source/config/
  repository/unrelated-terminal mutation.

## Dependencies

- Blocked by: PC-040 accepted delivery metadata, PC-042 exact role binding,
  PC-043 explicit PTY targeting boundary, PC-044 through PC-046 exact queue
  evidence, and PC-047 immutable local decisions.
- Blocks: PC-049 acknowledgement/conflict handling and PC-050 recent
  decisions/activity.

## Evidence required

- Focused schema, migration/store, serializer, file publisher, PTY adapter,
  service, reducer, and semantic-rendering tests.
- Authenticated integration evidence proving intent-before-effect,
  at-most-once behavior, exact file bytes/mode, exact PTY bytes, restart
  unknown, and preserved source/config/repository/unrelated PTY evidence.
- Chromium evidence for both method types, explicit confirmation, no retry,
  reload, focus, responsive, zoom, forced colors, and reduced motion.
- Passing `pnpm verify`, `pnpm test:e2e`, and production builds with exact
  counts and bundle sizes recorded.
- Small coherent commit history, clean branch, fast-forward merge into `dev`,
  and pushed exact `origin/dev` head.

## Completion evidence

Accepted on 2026-07-27 with the following exact-head evidence:

- `pnpm verify` passed formatting, lint, every workspace type check, 97 test
  files and 584 tests, and all production builds.
- The production build emitted an 850.51 kB web JavaScript bundle, a 97.09 kB
  stylesheet, and a 263.56 kB local-server bundle. The existing Vite
  greater-than-500-kB chunk warning remains recorded.
- `pnpm test:e2e` passed all 10 Chromium workflows. The queue workflow proves
  decision recording, accepted-target preview, explicit Review/Cancel/Confirm,
  no file after Cancel, private answer-file creation, durable delivery evidence,
  reload recovery, and continued question/approval separation.
- Focused contracts and store tests prove protocol 15 strict authority,
  queue-state v1-to-v2 migration, hash/cross-reference validation, serialized
  one-attempt persistence, duplicate suppression, restart reconstruction, and
  explicit durability uncertainty.
- File adapter and authenticated server tests prove mode-`0600` deterministic
  JSON, no-clobber existing/symlink behavior, intent-before-effect ordering,
  exact configured target resolution, duplicate no-op, and unchanged queue,
  configuration, and live-session evidence.
- The role integration test proves one JSON-escaped comment line plus one
  carriage return reaches only the exact configured live Meta PTY and is
  labelled terminal-transport accepted without provider-handling claims.
- Verification used Node.js 26.4.0 instead of the pinned Node.js 24.18.x
  runtime. Chromium ran outside the sandbox with the required Xcode Git path.

## Open questions

- PC-049 owns explicit retry/resolution, target-content conflicts,
  acknowledgement, applied state, and supersession.
- A role-prompt `delivered` result means only the exact PTY accepted one
  shell-safe comment line. Provider-native observers may later add stronger
  evidence without rewriting this record.
- The answer file uses one deterministic versioned JSON document and refuses
  any existing leaf. Appending or response-section formats require separate
  configured method types and tests, not inference from file contents.
