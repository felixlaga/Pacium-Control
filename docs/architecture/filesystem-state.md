# Minimal local filesystem state

## Objective

Persist only application-owned metadata needed for preferences, organization, Pacium compatibility, and restoration.

## Example layout

```text
$PACIUM_DATA_DIR/
├── config.json
├── workspaces.json
├── repositories.json
├── presets.json
├── sessions.json
├── pacium.json
├── queue-state.json
├── activity/
│   └── YYYY-MM-DD.jsonl
└── cache/
    ├── terminal/
    └── git/
```

## Rules

- Schemas are versioned.
- Validate complete content before replacement.
- Write temporary files on the same filesystem and rename atomically.
- Keep a last-known-valid copy when migration or corruption risk justifies it.
- Caches are disposable.
- Terminal scrollback is bounded and ephemeral by default.
- Queue decision identity and provenance are durable enough to prevent duplicate delivery.
- No provider credentials, password input, complete environment dumps, or unlimited transcripts.

## Recovery

- Invalid optional cache: delete/rebuild.
- Invalid configuration: preserve file, refuse unsafe interpretation, and offer diagnostics.
- Interrupted atomic write: retain previous valid file.
- Missing session metadata: live PTYs remain discoverable from the in-memory registry during that process lifetime.
- Local-server restart: direct PTYs are ended; tmux-backed sessions may be rediscovered later.

## Deferred complexity

Transaction journals, global revisions, projections, snapshots, backup services, and a universal entity store are not required until a real cross-file atomic workflow demonstrates the need.
