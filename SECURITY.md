# Security

Pacium Control exposes local shells and coding agents in a browser. Localhost reduces exposure but does not make unsafe browser-to-shell behavior acceptable.

## Security goals

1. The initial server is reachable only through loopback.
2. Unrelated browser origins cannot control Pacium terminals.
3. Terminal output cannot inject application HTML or unsafe navigation.
4. Commands, paths, and launch presets are explicit and bounded.
5. Provider credentials remain in provider-owned stores.
6. Logs and saved state do not become a secret-bearing transcript archive.
7. Queue answers and approvals are attributable and cannot be confused.
8. Failure preserves repositories and reports which processes survived.

## Trust model

The first product has one operator and runs with that user’s operating-system authority. It does not attempt to sandbox the user from their own terminals.

Untrusted inputs still include:

- web pages attempting cross-origin local requests;
- terminal output and escape sequences;
- repository contents;
- agent-generated commands and links;
- queue-file contents;
- malformed provider events;
- paths outside configured workspaces;
- oversized or rapidly repeated WebSocket messages.

## Local network boundary

- Bind to `127.0.0.1` by default.
- Validate the resolved listening address at startup.
- Never fall back silently to `0.0.0.0`.
- Reject untrusted `Origin` headers for HTTP mutations and WebSocket upgrades.
- Require an unguessable local access token for mutating and terminal connections.
- Do not put reusable tokens in logs, terminal output, or durable shared URLs.
- Set a restrictive Content Security Policy and self-host all terminal-route assets.

Optional remote access is supported only through the trust boundary in ADR-0016:

- Pacium remains bound to loopback.
- Tailscale Serve proxies tailnet-only HTTPS and WebSockets.
- Tailscale Funnel is prohibited.
- Remote requests require an exact configured Origin, verified Serve identity headers, an explicit login allowlist, and the ephemeral Pacium token.
- Network grants and application identity checks are both required.
- A Tailscale IP is never treated as permanent user identity.

## PTY and process safety

- Run child processes with the invoking user’s privileges; never request root.
- Track process groups so interrupt, terminate, and cleanup target the intended session.
- Make graceful interrupt and force termination visibly distinct.
- Confirm destructive close actions when work may be lost.
- Use typed launch presets for reusable agent commands.
- Do not expose an unauthenticated generic command endpoint.
- Validate working directories and repository roots.
- Bound environment inheritance and never persist complete environments.

## Browser terminal safety

- Treat terminal bytes, titles, OSC sequences, hyperlinks, and clipboard requests as untrusted.
- Never insert terminal strings as HTML.
- Disable or confirm unsafe link protocols.
- Do not permit silent clipboard writes.
- Bound terminal output buffers and WebSocket frames.
- Avoid analytics and session replay on terminal surfaces.
- Keep application shortcuts distinct from terminal input focus.

## Agent and repository risk

Coding agents process untrusted repository instructions. The interface must:

- identify agent-generated actions;
- show exact command or consequence for approvals;
- avoid blanket approval policies;
- keep ordinary questions separate from privileged approvals;
- avoid executing commands parsed from queue or repository text;
- show Git and verification evidence independently of agent narration.

## Verification command boundary

- Verification is disabled unless the operator supplies an absolute external
  versioned configuration file at startup.
- Reject configuration files inside configured repositories so repository
  content cannot silently redefine an allowed check.
- Canonicalize repository roots and executable files before accepting the
  catalog.
- Browser requests select only a live session, configured preset ID, or active
  run ID. They never supply an executable, argument, cwd, environment, timeout,
  or signal.
- Spawn the exact configured executable and argument vector with no implicit
  shell and only the bounded child-environment allowlist.
- Limit active processes, runtime, cancellation grace, output bytes, retained
  results, and serialized messages.
- Treat verification output as untrusted text; normalize terminal controls and
  never send it to a PTY or interpret it as HTML.
- Associate results with fresh start/end HEAD observations without claiming the
  live working tree was frozen.
- Terminate tracked verification groups on graceful shutdown. A hard crash has
  unknown process outcome and requires OS-level inspection before retry.

## Pacium configuration boundary

- The local server, not the browser, selects the one dedicated data directory
  and `pacium.json` target.
- Keep the data directory outside configured repositories and require private
  current-user ownership, restrictive modes, regular file/directory types, and
  no symlinks.
- Treat browser paths as candidates. Canonicalize repository roots and
  queue/context/answer metadata before an atomic replacement.
- Validate the complete strict workspace graph, live-session references, fixed
  launch-preset IDs, and exact-root verification IDs before writing.
- Require an expected revision for complete replacement. A stale, duplicate, or
  lost response never authorizes a blind retry.
- Preserve invalid, unsupported, oversized, permission-unsafe, noncanonical,
  and reference-drifted files. Degrade Pacium configuration without changing
  PTYs or weakening General mode.
- Existing metadata leaves must be regular non-symlink files; missing leaves
  require an existing canonical parent. A source path cannot also be an answer
  target.
- Configuration grants no permission to read queue/objective/plan content,
  write an answer, send a prompt, run verification, or send terminal input.
- Reject command, executable, argument, environment, signal, terminal-byte,
  content, secret, and generic write-target fields at the shared protocol
  boundary.

See the
[workspace configuration contract](docs/execution/pacium-workspace-configuration.md)
for exact schemas, bounds, atomicity, and recovery.

## Secrets and retention

Never persist:

- provider access tokens;
- SSH keys;
- password input;
- full environment dumps;
- unlimited raw terminal transcripts;
- unredacted queue data known to contain secrets.

Prefer bounded in-memory scrollback. If diagnostic export is added, it must be explicit, previewable, and redactable.

## Queue safety

- Treat queue files as untrusted text.
- Use stable source identity and hashes for deduplication.
- Keep bulk queue observations content-free. Allow an on-demand text read only
  for an exact current workspace/source/observation/hash/item identity.
- Transport maximum-size queue text with bounded encoding, render it only as
  inert text, and clear browser copies when current identity is lost.
- Never overwrite ambiguous human edits silently.
- Keep question-answer and approval-decision requests distinct in the protocol
  and interface. Approval requires an explicit second confirmation.
- Revalidate exact workspace/source/observation/hash/item identity and
  classification type immediately before every decision append.
- Assign the actor label, timestamp, UUID, and canonical SHA-256 decision hash
  on the server. The browser cannot claim those fields.
- Store only bounded application-owned answer/outcome/note content and exact
  source provenance in private, versioned, hash-verified `queue-state.json`;
  never copy queue source text into it.
- Treat an identical retry as a replay and reject a different second decision,
  preserving the first immutable record.
- If state is corrupt, unsafe, unsupported, oversized, full, or has unknown
  post-rename durability, fail mutation closed while preserving terminal and
  read-only queue operation.
- Record decision provenance before and separately from delivery. Recording a
  local decision is not delivery, acknowledgement, application, authorized
  provider action, or terminal input.
- Accept delivery requests containing only the immutable decision ID/hash.
  Resolve source, method, path, role, session ID/epoch, and serialized payload
  exclusively from current server-owned state and exact runtime evidence.
- Persist one hashed delivery intent before invoking a transport. Join a
  duplicate request to that attempt; never replay a completed or uncertain
  attempt automatically.
- Create answer files privately with deterministic bounded bytes and atomic
  no-clobber publication. Reject existing, symlinked, unsafe, or drifted
  targets without choosing another path.
- Reinspect only the exact server-resolved answer target with bounded
  no-follow reads. Exact bytes prove only that the transport artifact is
  present; missing, changed, unreadable, or unsafe bytes never imply provider
  acknowledgement or application.
- Derive source conflicts from accepted source IDs, hashes, and immutable
  decision provenance. Never expose conflict text, choose a duplicate source,
  edit queue bytes, or execute content.
- Accept lifecycle mutations containing only exact decision/attempt identities,
  one fixed action, an optional bounded note, and an exact related decision for
  supersession. The server authors actor, evidence source, timestamp, ID, and
  hash and validates every monotonic transition.
- Permit one second delivery attempt only after the operator explicitly records
  `confirmed_not_delivered` for a failed or unknown first attempt and confirms
  delivery again. Revalidate the exact source, configuration, target, payload,
  and attempt ceiling immediately before persisting that intent.
- Send role-prompt decisions only as one bounded JSON-escaped,
  comment-prefixed line to the exact configured live PTY. Treat PTY write
  acceptance as transport evidence only, never provider handling or approval
  execution.
- Surface conflicts instead of choosing one answer automatically.

## Required security tests

- non-loopback reachability;
- hostile Origin and missing/invalid token;
- oversized and malformed WebSocket messages;
- terminal title, link, clipboard, and escape-sequence injection;
- path traversal and symlink escape;
- process-group interrupt and termination;
- duplicate terminal input after reconnect;
- queue content interpreted as data, never executable code;
- forged queue-decision identity/actor/hash fields, cross-type requests,
  duplicate replays, competing decisions, and restart recovery;
- forged queue-delivery target/payload/path/role/session/retry fields,
  answer-file no-clobber and symlink boundaries, shell-safe role-prompt bytes,
  intent-before-effect ordering, duplicate suppression, and unknown recovery;
- secret scanning of logs and persisted state.

## Future expansion

The accepted Tailscale Serve mode remains single-operator and same-host. Team use, shared input ownership, another reverse proxy, public exposure, or multi-host operation would materially change the threat model and require a new ADR, authentication and authorization design, privilege review, and migration plan.
