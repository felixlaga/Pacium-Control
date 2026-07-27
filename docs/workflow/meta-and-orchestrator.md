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
- changed-file summary where available.

The implemented compact Worker group projects every accepted configured worker
once and in order. An exact session binding resolves only its UUID; Pacium does
not infer a replacement from a name, command, repository, branch, or terminal
output. A launch-preset binding remains `Configured · not started` and exposes
no automatic Launch action. Open selects only an existing exact PTY.

Process, attention, provider/command classification, repository, and freshness
remain source-labelled. Changed-file evidence appears only when that exact
worker is already the selected session with accepted Changes evidence; Pacium
does not fan out background Git reads. None of these facts proves task
progress, authorship, or completion.

Pacium does not require or create a generalized task graph before this view
works.

## Steering

The composer always displays the target:

```text
Meta | Orchestrator | Selected worker
```

Changing workspace or mode cannot silently preserve an unsafe target. Terminal input and structured prompt delivery remain distinct interactions.

## Evidence

Meta and Orchestrator may narrate progress. Pacium separately shows terminal/process state, Git changes, verification, queue provenance, and provider events where available.

The implemented Control-context inspector reads only the accepted objective and
plan paths when the operator opens it or chooses Refresh. Each source is a
bounded, stable, no-follow regular-file read and renders only as inert text.
The inspector also reconstructs at most twelve newest immutable queue
decisions, keeping the local response, latest durable transport attempt, and
latest human-labelled lifecycle state distinct.

Decision evidence does not prove provider acknowledgement, application,
completion, or resulting Git/terminal work. Provider-native observation and
causal correlation remain later enrichment.
