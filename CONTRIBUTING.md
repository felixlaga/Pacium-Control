# Contributing

Pacium Control should be built with the discipline of an infrastructure product and the care of a first-class user application.

## Before contributing

Read:

- [STATUS.md](STATUS.md)
- [AGENTS.md](AGENTS.md)
- [PRINCIPLES.md](PRINCIPLES.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SECURITY.md](SECURITY.md)
- the relevant detailed specification and ADRs.

## Issue first

Every material change begins with an issue that includes:

- user or system problem;
- scope;
- non-scope;
- acceptance criteria;
- dependencies;
- failure cases;
- security considerations;
- validation plan.

Use [docs/templates/issue.md](docs/templates/issue.md).

## Branches

Suggested naming:

```text
feat/<area>-<short-description>
fix/<area>-<short-description>
docs/<short-description>
refactor/<area>-<short-description>
security/<short-description>
```

For implementation agents, the assigned branch and worktree are part of the task contract.

## Pull requests

A pull request should:

- solve one coherent problem;
- link the issue and specification;
- explain architecture and user-visible behavior;
- include test and verification evidence;
- identify security implications;
- document limitations and follow-up work;
- update docs when behavior changes;
- avoid unrelated formatting churn.

Use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

## Architecture changes

Write an ADR when a change:

- alters a frozen decision;
- adds a major dependency or service;
- changes a persistence or protocol contract;
- changes a trust boundary;
- changes the provider-neutral domain model;
- introduces public exposure;
- affects recovery or data compatibility.

ADRs are proposals until accepted. See [GOVERNANCE.md](GOVERNANCE.md).

## Documentation style

- Prefer concrete language over slogans.
- State current behavior separately from future intent.
- Use canonical terms from [GLOSSARY.md](GLOSSARY.md).
- Link to evidence or acceptance criteria.
- Record uncertainty and open questions.
- Keep diagrams synchronized with text.
- Avoid claims like “secure,” “production-ready,” or “complete” without scope and evidence.

## Review expectations

Reviewers evaluate:

1. product fit;
2. architectural consistency;
3. security and privilege;
4. failure and recovery behavior;
5. concurrency and idempotency;
6. user experience and accessibility;
7. test quality;
8. operational burden;
9. documentation accuracy.

A passing test suite does not override a violated invariant.

## Commit quality

Commits should be understandable and intentional. Avoid committing:

- secrets;
- `.env` files;
- build output;
- dependency caches;
- runtime state;
- backups;
- terminal captures containing credentials;
- machine-specific absolute paths;
- editor or agent scratch files.

## Definition of done

Use [docs/execution/definition-of-done.md](docs/execution/definition-of-done.md). Every pull request should state which criteria apply and provide evidence.

## Respect the scope

The project should not become a generic agent platform merely because a contributor can imagine one. Strong contributions deepen the operating loops defined in the product strategy.
