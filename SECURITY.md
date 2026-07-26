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

Remote access is unsupported until a new trust-boundary design is accepted.

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
- Never overwrite ambiguous human edits silently.
- Distinguish questions from approvals.
- Record answer provenance and delivery result.
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
- secret scanning of logs and persisted state.

## Future expansion

Remote access, team use, shared machines, or multi-host operation would materially change the threat model. Those capabilities require a new ADR, authentication and authorization design, privilege separation review, and migration plan.
