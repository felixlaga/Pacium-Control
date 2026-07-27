# Verification configuration

PC-037 verification is optional and fail-closed. Pacium reads no command from a
repository, package manifest, terminal, provider, queue, or browser field.

## Configure

Create a JSON file outside every repository it configures:

```json
{
  "version": 1,
  "repositories": [
    {
      "root": "/Users/operator/Code/project",
      "presets": [
        {
          "id": "verify",
          "label": "Project verification",
          "description": "Run the local verification gate",
          "executable": "/opt/homebrew/bin/pnpm",
          "args": ["verify"],
          "timeoutMs": 600000
        }
      ]
    }
  ]
}
```

Start Pacium with the absolute configuration path:

```bash
PACIUM_VERIFICATION_CONFIG=/Users/operator/.config/pacium/verification.json pnpm dev
```

The configuration is read once at server startup. Invalid JSON, unknown fields,
relative or missing paths, duplicate roots or IDs, excessive values, a symlinked
configuration file, or a configuration file inside a configured repository
stops startup. No valid subset is accepted.

## Command contract

- Repository roots must exist and are canonicalized.
- Executables must be absolute, executable files and are canonicalized.
- A repository has at most 16 presets; the whole file has at most 32
  repositories and is at most 64 KiB.
- Each preset has a required timeout between one second and ten minutes.
- Pacium uses the configured executable and argument vector with `shell: false`
  and the canonical repository root as cwd.
- Browser messages carry only session, preset, request, and run identities.
- Pacium inherits only its existing bounded child-environment allowlist.
  Additional variable names require the explicit `PACIUM_ENV_ALLOWLIST`
  setting. Do not use that setting for secrets unless the verification command
  genuinely requires them.

The operator-owned file is trusted code configuration. Pacium does not sandbox
the configured executable or claim that it is read-only. Review the exact
executable and arguments before adding a preset.

## Runtime and evidence

Pacium permits one active check per terminal session and two active checks
across the local server. It captures stdout and stderr separately, retaining at
most 24 KiB of each with explicit truncation. Terminal control bytes are
normalized and output is rendered only as text.

Each result distinguishes pass, nonzero/signal failure, timeout, cancellation,
and execution error. It records duration, exit or signal evidence, whether
termination required force, and fresh HEAD observations before and after the
process. A HEAD comparison does not freeze or fingerprint the working tree; the
repository may change while a check runs.

Browser refresh does not stop a check. Reopening Checks inspects the active run
or latest bounded result while the same local-server process remains alive.
Results are memory-only and disappear on server restart. Graceful shutdown
terminates tracked check process groups; after a hard server crash, a prior
process and result are explicitly unknown and must be inspected at the
operating-system level before retrying.
