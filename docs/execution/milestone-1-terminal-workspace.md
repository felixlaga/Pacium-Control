# Milestone 1 — Terminal workspace

## Goal

Deliver a polished local terminal manager that is useful before any Pacium-specific workflow exists.

## Scope

### PTY lifecycle

- create a PTY in a selected working directory;
- explicit shell or launch preset;
- input, output, resize, signal, exit, and cleanup;
- process-group ownership;
- bounded buffering;
- relaunch manifest;
- honest state after local-server failure.

### Browser terminal

- xterm rendering;
- input focus and application escape chord;
- resize observation;
- Unicode, mouse, paste, alternate-screen, and hyperlink behavior;
- terminal titles and clipboard safety;
- connection and process states;
- bounded screen restoration after refresh.

### Session workspace

- multiple sessions;
- workspace and repository grouping;
- tabs and splits;
- create, rename, pin, duplicate, interrupt, relaunch, and close;
- shell, Claude Code, and Codex presets;
- unread activity;
- command palette, contextual menus, and stable keyboard shortcuts;
- light and dark themes using shared tokens.

## Non-scope

- semantic Claude/Codex transcript reconstruction;
- Git mutation;
- Pacium queue;
- tmux durability;
- remote access.

## Acceptance criteria

1. Shell, Claude Code, and Codex can run simultaneously in separate PTYs.
2. Browser refresh does not terminate them.
3. Reconnect restores a bounded visible terminal state.
4. Input is never duplicated after reconnect.
5. Resize and process signals target the correct session.
6. Closing a session distinguishes graceful close from forced termination.
7. Tabs, splits, sidebar selection, and terminal focus work by keyboard.
8. Large output remains bounded and responsive.
9. Terminal content cannot inject application HTML or unsafe navigation.
10. Empty, connecting, live, reconnecting, exited, and failed states are complete.

## Demo

Launch three sessions in two repositories, run an alternate-screen application, split the workspace, refresh the browser, interrupt one process, relaunch it, and close all sessions without leaks.

## Evidence

- PTY integration matrix;
- browser workflow recording;
- reconnect and duplicate-input tests;
- focus and keyboard test results;
- terminal security test results;
- memory/buffer measurements.
