# Information architecture

## Application shell

The interface uses a calm three-panel layout with a compact top bar:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Workspace / repository · search       General ○  Pacium ●       │
├──────────────────┬───────────────────────────────┬───────────────┤
│ Session sidebar  │ Terminal canvas               │ Inspector     │
│                  │                               │               │
│ Workspaces       │ Tabs                          │ Overview      │
│ Repositories     │ One terminal or splits        │ Changes       │
│ Sessions         │                               │ Activity      │
│                  │                               │ Queue         │
│ + New terminal   │                               │               │
├──────────────────┴───────────────────────────────┴───────────────┤
│ Status / focused session / shortcut hints                        │
└──────────────────────────────────────────────────────────────────┘
```

The terminal canvas is visually dominant. The sidebar supports orientation and recedes. The inspector appears when it has useful context and can collapse completely.

## General mode

The sidebar hierarchy is:

```text
Favorites
Workspaces
  Repository
    Sessions
Ungrouped
Recently closed
```

The primary actions are:

- create terminal;
- choose workspace/repository;
- choose launch preset;
- switch session;
- split;
- inspect work;
- interrupt, relaunch, or close.

## Pacium mode

Pacium mode keeps the same shell and terminal layout. It changes emphasis:

```text
Pacium
  Meta
  Orchestrator
  Workers

Needs me
  Questions
  Approvals
  Failures
  Reviews
```

The inspector defaults to the queue or Pacium context. The selected terminal remains fully interactive.

## Inspector

Tabs are contextual and stable:

```text
Overview · Changes · Activity · Queue
```

- Overview: session, process, agent, cwd, repository, branch, freshness, actions.
- Changes: files, diff, commits, verification.
- Activity: meaningful process, provider, terminal-attention, Git, and decision events.
- Queue: visible in Pacium mode or when a queue item relates to the session.

The inspector updates with selection without forced navigation. Full-screen diff or settings use dedicated routes.

## URL model

The local app uses stable routes:

```text
/
/w/:workspaceId
/w/:workspaceId/s/:sessionId
/w/:workspaceId/s/:sessionId/changes
/w/:workspaceId/pacium
/w/:workspaceId/pacium/q/:queueItemId
/settings
/diagnostics
```

Local access tokens never appear in durable URLs.

## Selection and focus

- One active terminal pane owns keyboard input.
- Sidebar selection may preview a session without stealing terminal focus.
- Opening a session makes it active only through an explicit action.
- The focused split has an unmistakable but restrained border.
- `Esc` exits terminal capture through the documented focus model; it does not send bytes accidentally.
- Browser navigation preserves workspace, selection, split layout, and inspector tab.

## Search and command palette

Search covers:

- workspace, repository, session, preset, agent, branch, and changed file names;
- bounded activity summaries;
- queue titles and decisions.

The command palette is contextual. It ranks actions for the selected session or queue item before global navigation.

## Empty states

- No sessions: “Create a terminal in this workspace.”
- No repository: “Choose a folder or start an ungrouped shell.”
- No changes: “Working tree clean.”
- No attention items: “Nothing needs you.”
- Pacium not configured: “Choose Meta, Orchestrator, and queue sources.”
- Session ended: state what exited and offer relaunch or close.
