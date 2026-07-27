# Pacium workspace configuration

PC-040 introduces one server-owned configuration document for future Pacium
mode consumers. It does not add the Pacium toggle, queue observation, file
delivery, prompt delivery, objective/plan reads, or role-launch UI.

## Location

Pacium reads and writes:

```text
<data-directory>/pacium.json
```

On macOS, the default data directory is:

```text
<canonical home>/Library/Application Support/Pacium Control
```

An operator can select another dedicated directory:

```bash
PACIUM_DATA_DIR=/absolute/private/pacium-state pnpm dev
```

`PACIUM_DATA_DIR` must be an absolute, bounded, control-free path beneath an
existing canonical ancestor. It cannot equal the home directory and must add a
dedicated child below its ancestor. A configured repository cannot contain the
data directory.

Reading missing state creates nothing. The first accepted replacement creates
the data directory with mode `0700` and `pacium.json` with mode `0600`.
Existing state must be owned by the current user, private from group/other
users, regular, and non-symlink.

## Version-1 document

The file is strict JSON with no unknown properties:

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "workspace": {
    "id": "primary",
    "label": "Pacium",
    "repositories": [
      {
        "id": "pacium",
        "label": "Pacium Control",
        "root": "/Users/operator/Code/Pacium Control",
        "verificationPresetIds": ["verify"]
      }
    ],
    "roles": {
      "meta": {
        "type": "launch_preset",
        "launchPreset": "codex",
        "repositoryId": "pacium"
      },
      "orchestrator": {
        "type": "session",
        "sessionId": "00000000-0000-4000-8000-000000000000"
      }
    },
    "workers": [],
    "queueSources": [
      {
        "id": "needs-felix",
        "label": "Needs Felix",
        "path": "/Users/operator/.pacium-queue/NEEDS-FELIX",
        "format": "plain_text",
        "requestingRole": "orchestrator",
        "deliveryMethodId": "answers"
      }
    ],
    "deliveryMethods": [
      {
        "id": "answers",
        "label": "Pacium answers",
        "type": "answer_file",
        "path": "/Users/operator/.pacium-queue/PACIUM-ANSWERS"
      }
    ],
    "context": {
      "objective": {
        "format": "plain_text",
        "path": "/Users/operator/.pacium-context/OBJECTIVE"
      },
      "plan": null
    }
  }
}
```

This example is illustrative. PC-040 intentionally has no browser editor, so
the supported write path is the authenticated protocol used by later Pacium
configuration UI. Hand-editing the server-owned file is not a replacement
workflow; every read still validates the complete file and reports invalid
external changes without rewriting them.

## Bindings and references

Meta, Orchestrator, and every worker bind to exactly one of:

```text
session(sessionId)
launch_preset(launchPreset, repositoryId?)
```

A session binding must name a currently live Pacium-owned PTY when a
replacement is accepted. One live session cannot occupy multiple role/worker
slots. A launch-preset binding names one fixed server-owned Shell, Codex, or
Claude Code preset and may reference one configured repository.

After a local-server restart, a previously accepted direct-session binding can
be unresolved because direct PTYs do not survive restart. The stored binding
remains explicit; Pacium does not infer a replacement from a name. The later
role UI must present that binding as missing and require an explicit relaunch
or rebind.

Repository roots must be existing canonical directories. Verification IDs must
exist for that exact root in the separately loaded server-owned verification
catalog. Executables, arguments, timeouts, environments, and commands are never
copied into `pacium.json`.

## Queue, delivery, and context metadata

Queue sources and objective/plan sources contain only a plain-text format label
and a canonical path. Answer-file delivery contains only a canonical target
path. Role-prompt delivery contains only an explicit Meta or Orchestrator
target.

For this slice:

- existing path leaves must be regular non-symlink files;
- a missing leaf is accepted only beneath an existing canonical directory;
- queue/source paths, context paths, and answer targets must be unique where
  their roles require it;
- a queue source cannot also be an answer target;
- delivery and repository references must resolve;
- no configured file is opened for content, watched, created, appended, or
  delivered;
- no role prompt is sent and no terminal input is generated.

Queue text remains untrusted data. Configuration never grants command or shell
authority.

## Bounds

- 96 KiB maximum serialized file;
- one workspace;
- 64-character lowercase identifiers;
- 120-character control-free labels;
- 4,096-character absolute control-free paths;
- 32 repositories;
- 32 queue sources;
- 64 workers;
- 16 delivery methods;
- 16 verification references per repository;
- two context sources;
- safe positive persisted revisions.

The 96 KiB file ceiling leaves deterministic room inside the 128 KiB
application-message envelope.

## Protocol 10

The authenticated WebSocket protocol adds:

```text
pacium.config.get(requestId)
pacium.config.replace(requestId, expectedRevision, workspace)
pacium.config(requestId, observation)
```

Observations are:

- `unconfigured`: `revision`, `workspace`, and `error` are `null`;
- `ready`: a positive revision and the normalized complete workspace;
- `error`: no revision or workspace, only a bounded error code and message.

The first replacement uses expected revision `0`. A ready replacement uses the
last observed positive revision. One accepted replacement increments exactly
once. Stale or duplicate revisions conflict without changing the file.

Browser disconnect drops pending request intent but retains the last accepted
observation. Reconnect performs a fresh get. A lost replacement response must
be resolved by get; the browser never assumes that request intent became
durable state.

## Atomicity and recovery

An accepted replacement:

1. rereads current state;
2. validates the complete shared schema;
3. resolves live sessions and server-owned catalogs;
4. canonicalizes and validates paths;
5. writes an unpredictable exclusive same-directory temporary file at mode
   `0600`;
6. syncs and closes the temporary file;
7. atomically renames it over `pacium.json`;
8. syncs the data directory;
9. rereads the accepted revision.

Validation happens before directory creation or writing. A failure before
rename leaves the previous file authoritative and attempts to remove only the
known temporary file. A directory-sync failure after rename reports unknown
durability; inspect before retrying because the new revision may be visible.

Invalid JSON, invalid UTF-8, unsupported schema versions, unsafe permissions,
oversized files, noncanonical paths, and drifted server references are
preserved and reported as Pacium-only errors. General terminals, layouts, Git
inspection, and verification remain available. Pacium never auto-migrates,
repairs, renames, deletes, or overwrites invalid state.

## Security boundary

Existing exact Origin and ephemeral-token checks protect both operations. The
browser cannot choose the state-file location or submit commands, arguments,
executables, environments, signals, terminal bytes, queue content,
objective/plan content, answer content, verification definitions, or generic
write targets.

Configured paths are metadata candidates until the local server canonicalizes
them. PC-040 does not log their contents and does not persist provider tokens,
passwords, full environments, or terminal transcripts.
