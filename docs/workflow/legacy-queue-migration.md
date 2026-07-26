# Queue compatibility

## Existing workflow

Pacium currently uses files such as:

- `FELIX-QUEUE`;
- `NEEDS-FELIX`;
- related repository-specific queue files;
- Meta or Orchestrator terminal prompts as transport.

The first Pacium mode must work with these sources instead of requiring an immediate migration.

## Stage 1 — Observe

- Configure queue paths per Pacium workspace.
- Read stable file contents conservatively.
- Bound file size and parsing work.
- Store source path, content hash, observation revision, and original text.
- Classify question, approval, failure, review, or unknown with confidence.
- Never modify source files.

## Stage 2 — Answer compatibly

- Record an immutable local decision.
- Deliver through an explicit configured method.
- Use decision identity to prevent duplicate delivery.
- Show delivered, failed, or unknown.
- Observe acknowledgement or application only when evidence exists.

The compatibility method may be:

- writing a separate answer file atomically;
- appending to a defined response section;
- sending a structured prompt to Meta or Orchestrator;
- a future `paciumctl` command.

Each method has its own contract and tests. Pacium never improvises from arbitrary file text.

## Stage 3 — Structured transport

After sustained compatibility:

- Meta and Orchestrator may emit typed queue items through `paciumctl`;
- legacy queue files remain generated or observed compatibility views;
- Pacium metadata becomes authoritative for decision delivery lifecycle;
- original source provenance remains visible.

## Safety

- Debounce and verify stable reads.
- Detect truncation, reorder, and partial write.
- Treat content as untrusted data.
- Never execute commands from queue text.
- Avoid overwriting human edits.
- Cap line and file size.
- Preserve original content where safe.
- Distinguish the source file from the requesting session.

## Deduplication

Use:

- configured source identity;
- stable embedded ID where present;
- content hash;
- observation revision or offset;
- requesting role/session context;
- timestamp window only as a last-resort signal.

## Conflicts

Create a visible conflict when:

- the same item receives different answers;
- source content changes after decision;
- file truncation or reorder makes identity ambiguous;
- the same question appears in several sources;
- a question looks like an approval;
- delivery outcome is unknown and a new answer is attempted.

Never resolve these silently.
