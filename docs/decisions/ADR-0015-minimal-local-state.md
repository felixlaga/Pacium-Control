# ADR-0015: Persist only minimal local application state

- Status: Accepted
- Date: 2026-07-26
- Owner approval: Explicit product direction in the 2026-07-26 planning session
- Supersedes: [ADR-0008](ADR-0008-events-and-current-state.md), [ADR-0011](ADR-0011-single-authoritative-writer.md)
- Retains: [ADR-0001](ADR-0001-filesystem-not-database.md)

## Context

The old design proposed a generalized coordination domain, transaction journal, global revisions, projections, snapshots, and a central state coordinator before the first usable interface. The new local product needs much less durable state.

The systems of record remain the running PTY processes, Git repositories, provider-native events, and configured queue files. Pacium should store only what it owns.

## Decision

The local server is the only process that writes Pacium configuration and metadata. Initial durable state is limited to:

- application preferences;
- workspace and repository definitions;
- session presets and classifications;
- Pacium-mode configuration;
- queue import provenance and resolved decisions;
- bounded activity metadata;
- browser/session restoration metadata;
- optional relaunch manifests.

State uses small versioned JSON files and, where history is valuable, bounded append-only JSONL. Writes use validation, temporary files, and atomic replacement. Multi-file journaling, generalized projections, global entity revisions, backup services, and a universal event-sourced domain are not initial requirements.

Terminal scrollback is bounded and ephemeral by default. Secrets, complete environment dumps, and provider credentials are never stored.

## Consequences

### Positive

- Implementation effort follows visible product needs.
- State remains inspectable and portable.
- No application database.
- Fewer migration and recovery contracts before product validation.

### Negative

- Some advanced audit and multi-user features cannot be added without extending the model.
- Local metadata loss may require reclassification or reconfiguration.
- Future remote operation would require stronger durability and concurrency semantics.

## Validation

- Corrupt configuration fails visibly and preserves the last valid file where practical.
- Atomic-write interruption never silently replaces a valid file with partial JSON.
- Queue imports deduplicate using source identity and content provenance.
- Deleting ephemeral caches does not lose repository or queue truth.
- A clean profile can be created and removed without touching repositories or provider credentials.
