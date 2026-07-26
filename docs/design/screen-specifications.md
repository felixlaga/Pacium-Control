# Screen specifications

## Global shell

### Top bar

- workspace and repository breadcrumb;
- search;
- General/Pacium segmented toggle;
- connection health;
- command palette;
- settings.

The top bar is compact and stable. Screen-specific actions live near the relevant panel rather than accumulating globally.

### Session sidebar

Sections:

- favorites;
- workspace/repository groups;
- sessions;
- ungrouped;
- recently closed;
- New terminal.

Session row:

- attention icon and text;
- display name;
- agent or command label;
- repository abbreviation;
- unread marker;
- optional branch;
- context menu.

The selected row and keyboard-focused row are distinguishable.

### Terminal canvas

- tab strip when more than one tab is open;
- one or more split panes;
- focused-pane indicator;
- compact terminal header with session name, cwd/repository, process state, and actions;
- empty pane picker;
- connection and exit overlays that do not destroy scrollback.

### Inspector

Tabs:

```text
Overview · Changes · Activity · Queue
```

The inspector remembers width and selected tab per workspace. It collapses with a shortcut and must not steal terminal focus on background updates.

## New terminal flow

Fields:

- workspace;
- repository or folder;
- launch preset;
- optional display name;
- optional keep-alive mode when tmux support exists.

Show the working directory and command label before launch. Do not expose or persist complete environment contents.

States:

- ready;
- validating;
- creating;
- failed with retained values.

## Session overview

- display name;
- command/agent type;
- process state;
- attention state with source and freshness;
- cwd;
- repository, branch, and commit;
- start time and duration;
- direct PTY or tmux-backed capability;
- relaunch availability;
- actions.

## Changes

Header:

- repository;
- branch;
- changed file count;
- additions/deletions;
- refresh;
- verification action.

Body:

- file list;
- selected diff;
- large/binary/renamed/deleted states;
- recent commits;
- verification result.

## Activity

Show meaningful entries:

- session started, interrupted, exited, relaunched;
- attention change;
- provider-native tool or plan event;
- Git state change;
- verification result;
- Pacium decision or delivery.

Do not reproduce every terminal line.

## Pacium mode

### Sidebar emphasis

```text
Meta
Orchestrator
Workers
```

Missing configured sessions remain visible with launch or attach action.

### Queue

Sections:

1. Blocking questions.
2. Approvals.
3. Failures.
4. Reviews.
5. Non-blocking questions.
6. Conflicts and unclassified items.

Queue row:

- type;
- concise title;
- source session;
- waiting time;
- blocking or risk indicator;
- unread state.

Queue inspector:

- original source text;
- parse confidence;
- reason and consequence;
- options or exact approval action;
- recommendation where present;
- related terminal and Git evidence;
- answer controls;
- delivery and acknowledgement history;
- source path and provenance in secondary details.

## Settings

Sections:

- appearance and density;
- terminal font, cursor, scrollback, and paste;
- workspaces and repositories;
- launch presets;
- keyboard shortcuts;
- notifications;
- Pacium configuration;
- local server and security;
- diagnostics.

## Error states

Every error answers:

1. What failed?
2. Is the PTY still running?
3. Did Git or queue source data change?
4. Can the action be retried safely?
5. What should the operator do?
