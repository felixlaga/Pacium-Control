# Legacy queue migration

## Existing workflow

The current Pacium process uses files such as:

- `FELIX-QUEUE` for questions that the orchestrator needs answered;
- `NEEDS-FELIX` for work blocked on exceptional permission or intervention;
- meta-session prompts to relay questions and answers;
- tmux `send-keys` as transport.

Pacium Control must provide value without breaking this workflow abruptly.

## Target model

The target uses one structured object per question or approval, immutable decisions, explicit acknowledgement, and an event timeline.

```text
Orchestrator emits structured item
→ state coordinator persists it
→ meta optionally enriches it
→ assigned user answers in Inbox
→ decision is delivered
→ orchestrator acknowledges
→ application evidence is linked
```

## Migration stages

### Stage 1 — Observe existing files

- Configure known queue paths per run/repository.
- Watch changes safely.
- Parse supported existing formats conservatively.
- Display imported items with `legacy` source and confidence.
- Do not modify files automatically.

### Stage 2 — Bidirectional compatibility

- Create structured Pacium questions/approvals.
- Render compatibility Markdown/text views for existing agents.
- Import answers written by legacy workflow with deduplication.
- Record file offsets/hashes and provenance.
- Detect conflicts rather than silently choosing.

### Stage 3 — `paciumctl` transport

- Update orchestrator/meta wrappers to emit typed items through `paciumctl`.
- Keep generating legacy views for safety.
- Make Pacium state authoritative for lifecycle.
- Mark manual legacy edits clearly.

### Stage 4 — Read-only compatibility views

- Legacy files become generated views.
- Agents read decisions through supported commands or per-item files.
- Direct edits are warned or rejected according to policy.

### Stage 5 — Retirement

- Remove legacy dependency after sustained successful operation.
- Preserve migration documentation and import tooling.

## File adapter safety

- Watch files with debouncing and content hashes.
- Never assume an append is complete until stable.
- Use atomic writes for generated files.
- Avoid overwriting human edits without conflict handling.
- Cap file size and line length.
- Treat file content as untrusted input.
- Preserve original source text for audit where safe.
- Do not execute commands found in queue text.

## Identity generalization

The domain model never hardcodes Felix. It uses:

```text
assignedToUserId
assignedToRole
answeredByUserId
```

Compatibility output can map user display names to filenames such as `NEEDS-FELIX.md`, but the UI says “Needs me” for each user.

## Legacy item matching

Use stable embedded IDs where possible. Otherwise combine:

- source file;
- content hash;
- observed offset/version;
- run/session context;
- timestamp window.

Matching must avoid creating duplicate questions after restart or file rewrite.

## Conflict handling

Examples:

- Human answers in Pacium while meta writes a different legacy answer.
- Legacy question is edited after Pacium import.
- File is truncated or reordered.
- Same question appears in two files.

The adapter should create a visible conflict event and require resolution. It must not silently mutate an immutable decision.
