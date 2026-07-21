# Users and jobs

## Primary persona: founder-operator

The founder-operator combines product judgment, technical depth, and execution responsibility. They are willing to run advanced CLI workflows but do not want to spend the day reconstructing terminal state.

### Goals

- Keep several coding efforts moving at once.
- Make high-leverage decisions quickly.
- Preserve direct control over sensitive operations.
- Know whether work is actually correct.
- Avoid becoming the message bus between agents.
- Share operational visibility with the team.

### Frustrations

- Badly named tmux sessions.
- Repeatedly scanning terminal panes.
- Questions without enough context.
- Queue files that require manual editing.
- Unclear acknowledgement of answers.
- Agents modifying the wrong checkout.
- Difficulty knowing what happened while away.
- Provider usage becoming visible only when exhausted.
- Teammates needing shell access merely to observe work.

### Desired feeling

Calm control. The operator should feel that the system is active but not chaotic, autonomous but not opaque, fast but not reckless.

## Team operator

A trusted engineer who can answer assigned questions, send structured steering prompts, and control selected sessions.

### Needs

- Clear scope of authority.
- No ambiguity about who currently controls a terminal.
- Repository-specific access.
- A personal unread state.
- Enough context to decide without reading the whole run.
- An audit trail that protects both the team and operator.

## Reviewer

A technical reviewer cares about quality, not terminal activity.

### Needs

- Objective and acceptance criteria.
- Decisions and tradeoffs.
- Diff and commit structure.
- Tests and verification artifacts.
- Known limitations and unverified claims.
- Ability to request revision or independent review.

## Infrastructure owner

The infrastructure owner protects hosts, credentials, backups, and network boundaries.

### Needs

- Host health and versions.
- Explicit execution identities.
- Narrow broker privileges.
- No public exposure.
- Credential-expiry visibility.
- Backup and restore evidence.
- Incident and break-glass procedures.

## Observer

An observer needs awareness without control.

### Needs

- Readable summaries.
- Progress and blockers.
- Review status.
- No raw secrets or unrestricted terminal access.

## Core jobs to be done

### Resume context

**When** I return after a meeting or overnight,
**help me** see what changed since my last visit,
**so I can** make the next decision without replaying every conversation.

### Resolve a blocker

**When** an agent cannot proceed,
**help me** understand the exact decision or permission needed,
**so I can** unblock it safely in seconds.

### Steer the system

**When** priorities or assumptions change,
**help me** direct the meta agent, orchestrator, run, or worker at the correct level,
**so I can** alter course without disrupting unrelated work.

### Verify completion

**When** an agent reports completion,
**help me** inspect evidence against acceptance criteria,
**so I can** trust, revise, merge, or reject the result.

### Recover from failure

**When** a session, provider, host, or integration fails,
**help me** understand what survived and what action is safe,
**so I can** recover without losing work or duplicating commands.

### Share operations

**When** several teammates participate,
**help us** see ownership, unread state, authority, and history,
**so we can** collaborate without giving everyone unrestricted shell access.

## Anti-persona

The first version is not for a nontechnical user seeking a one-click app builder. It assumes familiarity with repositories, branches, tests, and the consequences of running commands on a server. The interface should reduce operational complexity without concealing technical reality.
