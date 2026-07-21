# Publishing and GitHub setup

This repository is documentation-only and ready to initialize as a Git repository.

## Recommended initial visibility

Use a **private GitHub repository** until licensing, credential policy, security review, and product disclosure are deliberate decisions.

Absence of an open-source license means no broad reuse rights are granted by default. Do not make the repository public accidentally.

## Initialize

```bash
git init -b main
git add .
git commit -m "docs: establish Pacium Control product and engineering blueprint"
```

Then create and push a private GitHub repository:

```bash
gh repo create pacium-control \
  --private \
  --source=. \
  --remote=origin \
  --push
```

## Branch protection

Protect `main` with:

- pull request required;
- at least one approving review;
- conversation resolution required;
- status checks required once CI exists;
- force pushes disabled;
- branch deletion disabled;
- administrator bypass limited and audited.

For security-critical areas, require code-owner review when maintainers are established.

## Suggested labels

### Type

- `type:feature`
- `type:bug`
- `type:architecture`
- `type:security`
- `type:design`
- `type:research`
- `type:operations`
- `type:documentation`

### Area

- `area:state`
- `area:broker`
- `area:tmux`
- `area:terminal`
- `area:auth`
- `area:claude`
- `area:codex`
- `area:git`
- `area:workflow`
- `area:web`
- `area:host`
- `area:observability`

### Priority

- `priority:p0`
- `priority:p1`
- `priority:p2`
- `priority:p3`

### Status

- `status:ready`
- `status:blocked`
- `status:needs-design`
- `status:needs-security-review`
- `status:needs-owner-decision`

### Milestone

- `milestone:0` through `milestone:6`

## Suggested GitHub Projects fields

- Milestone.
- Workstream.
- Priority.
- Status.
- Owner.
- Agent.
- Repository/worktree.
- Risk.
- Verification state.
- Blocked by.

## Release naming

Documentation blueprint releases may use:

```text
blueprint-v0.1.0
```

Product releases should begin only after executable software exists and passes release criteria:

```text
v0.1.0-alpha.1
v0.1.0-beta.1
v0.1.0
```

Do not use `v1.0.0` as a statement of ambition. Use it when the operational and compatibility promises are genuinely stable.

## Repository hygiene

Before every public or private push, scan for:

- secrets and tokens;
- personal emails not intended for publication;
- hostnames and tailnet details;
- absolute machine paths;
- terminal captures;
- generated state and backups;
- provider credentials;
- private issue references;
- unsupported implementation claims.

## Licensing decision

Before public release, choose deliberately among:

- proprietary source-available or private;
- an OSI-approved open-source license;
- open-core separation;
- dual licensing.

Record the decision in an ADR and add the corresponding `LICENSE` file. Until then, keep the repository private.
