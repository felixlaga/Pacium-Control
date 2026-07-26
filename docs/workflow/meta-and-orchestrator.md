# Meta and Orchestrator

## Purpose

Pacium mode gives two existing terminal sessions dedicated roles:

- **Meta** helps the operator understand, summarize, decide, and route intent.
- **Orchestrator** coordinates execution, workers, queue items, and completion evidence.

Pacium Control does not require either role to adopt a new hidden protocol before the terminal workspace is useful.

## Session configuration

Each role may reference:

- an existing Pacium terminal session;
- a launch preset;
- an explicit tmux target when optional tmux support exists.

Missing or ended sessions remain visible with launch, relaunch, or attach actions.

## Meta in the UI

- pinned in Pacium mode;
- one-keystroke focus;
- explicit target in the prompt composer;
- recent meaningful activity;
- related queue items;
- source-labelled summaries.

Meta may clarify queue presentation but cannot change the original source text or silently answer for the operator.

## Orchestrator in the UI

- pinned separately from Meta;
- explicit target and status;
- related workers;
- current objective or plan context from configured sources;
- queue items it created;
- decisions and observable application evidence.

## Worker sessions

Workers are ordinary terminal sessions classified for Pacium mode. The first product shows:

- name;
- provider/command;
- repository;
- attention state;
- freshness;
- related queue count;
- changed-file summary where available.

Pacium does not require a generalized task graph before this view works.

## Steering

The composer always displays the target:

```text
Meta | Orchestrator | Selected worker
```

Changing workspace or mode cannot silently preserve an unsafe target. Terminal input and structured prompt delivery remain distinct interactions.

## Evidence

Meta and Orchestrator may narrate progress. Pacium separately shows terminal/process state, Git changes, verification, queue provenance, and provider events where available.
