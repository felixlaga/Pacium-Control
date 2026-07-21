# Governance and decision rights

Pacium Control begins as an owner-led product with agent-assisted implementation. Governance should preserve velocity without allowing architectural drift.

## Roles

### Product owner

The product owner has final authority over:

- vision and product scope;
- milestone priority;
- user experience direction;
- frozen architectural decisions;
- security risk acceptance;
- release readiness;
- licensing and public distribution.

### Technical lead

The technical lead owns:

- architecture consistency;
- implementation sequencing;
- technical quality;
- dependency policy;
- operational design;
- review assignment;
- ADR recommendations.

Initially, product owner and technical lead may be the same person.

### Security reviewer

A designated reviewer must approve changes to:

- identity and authorization;
- terminal transport;
- broker protocol;
- provider credentials;
- approval policy;
- state integrity and backup;
- public/network exposure.

### Maintainer

Maintainers may merge changes within accepted architecture and milestone scope. They may not unilaterally supersede frozen decisions.

### Implementation agent

An implementation agent executes bounded tasks. It does not own product strategy, security risk acceptance, or release declarations.

## Decision classes

### Class 1 — Local implementation decision

Examples: internal function shape, file organization, test helper. Decided in pull request review.

### Class 2 — Cross-module design decision

Examples: shared schema field, event naming, API error contract. Requires an implementation plan and affected-owner review.

### Class 3 — Architecture decision

Examples: persistence model, protocol, trust boundary, major dependency. Requires an ADR.

### Class 4 — Product or security policy decision

Examples: public exposure, role authority, approval semantics, credential model. Requires explicit product-owner approval and security review.

## ADR process

1. Copy [the ADR template](docs/templates/architecture-decision.md).
2. Describe context, decision, alternatives, consequences, migration, and validation.
3. Mark status `Proposed`.
4. Request required reviews.
5. Product owner or delegated authority marks `Accepted`, `Rejected`, or `Superseded`.
6. Link implementation issues.
7. Update canonical docs when implementation lands.

An ADR records a decision; it does not itself implement it.

## Documentation authority

When documents conflict, authority is:

1. accepted ADR for the specific decision;
2. root architecture/security/product documents;
3. detailed specifications;
4. implementation plan;
5. issue discussion;
6. code comments.

Code may reveal drift, but it does not silently redefine the intended architecture.

## Change control for frozen decisions

A proposal to change a frozen decision must include:

- the concrete problem encountered;
- evidence that the current design cannot satisfy requirements reasonably;
- at least two alternatives;
- security and operational consequences;
- migration and rollback plan;
- impact on roadmap and existing state;
- explicit owner approval.

Convenience alone is insufficient.

## Release authority

A release requires:

- milestone acceptance criteria met or explicitly waived;
- clean-clone installation and build evidence;
- automated tests;
- migration and rollback plan;
- security checklist;
- backup/restore evidence for state-affecting changes;
- known limitations;
- owner approval.

Agents may prepare a release candidate. They may not declare production readiness without the required evidence and human authority.
