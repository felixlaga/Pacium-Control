# Backup and restore

## Scope

Backups protect Pacium coordination state and safe configuration. Git repositories should also be protected through normal remotes and repository backup practices. tmux process memory cannot be backed up meaningfully; session manifests and worktrees enable recovery.

## Included

- authoritative entity files;
- append-only events required by retention policy;
- state format and instance metadata;
- policies;
- safe repository/host configuration;
- session manifests;
- snapshot manifests and hashes;
- migration records.

## Excluded

- provider access tokens;
- Tailscale auth keys;
- SSH private keys;
- full terminal scrollback unless explicitly retained;
- build caches;
- dependency caches;
- temporary files;
- worktrees as a substitute for Git remotes;
- operating-system secrets.

## Backup process

1. Ask state coordinator for a consistent snapshot at revision `R`.
2. Validate snapshot manifest and file hashes.
3. Package snapshot plus required later event segments if using incremental design.
4. Encrypt using an approved standard tool and recipient policy.
5. Copy to off-host destination.
6. Verify destination size/hash.
7. Record backup event with revision, manifest hash, destination label, and result.
8. Apply retention only after verified copy.

## Frequency

Initial proposal:

- local snapshot after meaningful state migrations and at least daily;
- encrypted off-host backup at least daily;
- additional backup before deployment, migration, or restore testing;
- retention tiers for recent daily, weekly, and monthly copies.

Final frequency depends on measured state change and recovery objectives.

## Encryption

- Use established encryption tooling.
- Keep private recovery keys off the VPS.
- Test decryption from a separate machine.
- Record key ownership and rotation.
- Do not store encryption private keys beside backups.

## Restore process

1. Declare maintenance/pause state.
2. Preserve current state directory as a rollback copy.
3. Download and decrypt backup into a staging path.
4. Verify archive and file manifest.
5. Validate format version and schemas.
6. Run reference and event integrity checks.
7. Confirm expected revision and backup time with operator.
8. Activate staged state through atomic directory switch or documented service-stop rename.
9. Start state coordinator in validation mode.
10. Rebuild projections.
11. Start API/broker.
12. Reconcile live tmux sessions and Git worktrees.
13. Run smoke test.
14. Keep prior state until acceptance window passes.
15. Record restore event and incident/change reference.

## Restore caveats

A state backup does not recreate:

- processes lost in a host reboot;
- uncommitted files deleted outside backup scope;
- expired provider sessions;
- external GitHub state;
- credentials.

The UI should show restored historical state separately from newly observed live reality until reconciliation completes.

## Drill schedule

Before beta:

- restore into an empty temporary directory in CI/integration;
- restore on a separate clean VPS;
- verify owner can decrypt;
- measure total time;
- test one corrupt backup;
- test unsupported newer format;
- test missing event segment;
- document failures.

After beta, repeat at a regular cadence and after major state-format changes.

## Recovery evidence

Store:

- backup revision and timestamp;
- manifest hash;
- encryption recipient label;
- destination label;
- verification result;
- restore drill date;
- restore duration;
- issues found;
- responsible operator.

“Backup completed” without restore evidence is not sufficient assurance.
