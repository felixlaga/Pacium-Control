# Core workflows

## 1. Start a terminal

1. Operator chooses New terminal.
2. Selects workspace/repository, working directory, and launch preset.
3. UI previews the command label and cwd.
4. Local server validates the request and creates a PTY.
5. Session appears immediately in creating state.
6. Output streams into the terminal.
7. Session becomes live or shows a typed spawn failure.

## 2. Manage several sessions

1. Operator groups sessions by workspace or repository.
2. Unread and attention states update without stealing focus.
3. Keyboard or sidebar selection opens a session.
4. Tabs keep frequently used sessions available.
5. Splits show sessions side by side.
6. Rename and pin affect only Pacium metadata.
7. Interrupt, relaunch, and close state their process consequence.

## 3. Reconnect after browser refresh

1. Browser disconnects.
2. Local server keeps PTYs alive.
3. Browser reconnects with protocol and session epochs.
4. Server returns live sessions and bounded terminal snapshots.
5. Client restores layout and attaches to selected sessions.
6. Terminal input resumes from new user actions only.

No uncertain input is replayed.

## 4. Find what needs attention

1. Observers receive process, terminal, hook, or provider events.
2. Attention reducer updates state with source and freshness.
3. Sidebar row changes icon, text, and unread state.
4. Notification fires only when policy says the operator should look.
5. Operator previews status or opens the terminal.
6. Viewing or acting advances the local attention cursor.

## 5. Inspect agent work

1. Session cwd resolves to a configured repository.
2. Git inspector reads branch, status, changed files, and diff.
3. Operator selects a file.
4. Inspector shows bounded diff and relevant commits.
5. Operator may run an explicit configured verification preset.
6. Result is associated with the repository state or commit observed.

Git facts remain independent of agent narration.

## 6. Enter Pacium mode

1. Operator enables Pacium mode for the workspace.
2. Meta and Orchestrator sessions are pinned or shown as missing.
3. Worker sessions group below them.
4. Queue sources begin conservative observation.
5. Inspector emphasizes items needing attention.
6. Operator may switch back to General mode without losing terminal layout.

## 7. Answer a Pacium question

1. Queue adapter observes stable source content.
2. Item is parsed with source, hash, confidence, and requesting context.
3. Operator opens the item and reviews original text.
4. Operator chooses an answer and optional note.
5. Pacium records an immutable local decision.
6. Configured compatibility transport delivers the decision once.
7. UI shows delivered, acknowledged, applied, unknown, failed, or conflicted according to evidence.

## 8. Approve a Pacium action

1. Item is classified as an approval, not a question.
2. Inspector shows the concrete action, target, consequence, and risk.
3. Operator denies or approves the exact action.
4. Decision identity is bound to that action content.
5. A changed action requires a new approval.

## 9. Recover or relaunch

1. Direct PTY exits or local-server restart ends it.
2. Session shows ended with exit evidence where available.
3. Operator chooses relaunch from the saved preset/manifest.
4. A new process instance starts under the existing logical session or a clearly linked successor.
5. Optional tmux-backed sessions may reconnect instead.

The interface never pretends a direct PTY survived a server restart.
