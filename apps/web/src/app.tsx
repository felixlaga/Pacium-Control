import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  TerminalSurface,
  type TerminalSurfaceHandle,
} from "@pacium/terminal-ui";
import type {
  DirectoryListing,
  LaunchPresetCapability,
  LaunchPresetId,
  ServerMessage,
  SessionSummary,
  TerminalDataFrame,
} from "@pacium/contracts";

import {
  PaciumTransport,
  type ConnectionState,
  type TransportEvent,
} from "./transport.js";
import { DirectoryPicker } from "./directory-picker.js";
import {
  adjacentTerminalTabId,
  closeTerminalTab,
  groupSessions,
  moveTerminalTab,
  moveTerminalTabByOffset,
  openTerminalTab,
  parseStoredTerminalTabs,
  reconcileTerminalTabs,
  resolveWorkspaceShortcut,
  serializeTerminalTabs,
  toggleTerminalTabPin,
  type TerminalTab,
} from "./session-model.js";

interface TerminalSync {
  sessionId: string;
  epoch: number | undefined;
  sequence: number;
  snapshotApplied: boolean;
  pending: TerminalDataFrame[];
}

const INITIAL_LAUNCH_PRESETS: LaunchPresetCapability[] = [
  {
    id: "shell",
    label: "Shell",
    available: true,
    unavailableReason: null,
  },
  {
    id: "codex",
    label: "Codex",
    available: false,
    unavailableReason: "Waiting for the local server.",
  },
  {
    id: "claude",
    label: "Claude Code",
    available: false,
    unavailableReason: "Waiting for the local server.",
  },
];

const TERMINAL_TABS_STORAGE_KEY = "pacium.terminalTabs";

export function App() {
  const terminalRef = useRef<TerminalSurfaceHandle>(null);
  const selectedIdRef = useRef<string | null>(null);
  const tabsRef = useRef<TerminalTab[]>([]);
  const syncRef = useRef<TerminalSync | null>(null);
  const transportRef = useRef<PaciumTransport | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionListReady, setSessionListReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.localStorage.getItem("pacium.selectedSession"),
  );
  const [tabs, setTabs] = useState<TerminalTab[]>(() =>
    parseStoredTerminalTabs(
      window.localStorage.getItem(TERMINAL_TABS_STORAGE_KEY),
    ),
  );
  const [defaultCwd, setDefaultCwd] = useState("");
  const [launchPresets, setLaunchPresets] = useState(INITIAL_LAUNCH_PRESETS);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [terminalCaptured, setTerminalCaptured] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  selectedIdRef.current = selectedId;
  tabsRef.current = tabs;

  const onTransportEvent = useCallback((event: TransportEvent) => {
    if (event.type === "connection") {
      setConnection(event.state);
      return;
    }
    if (event.type === "transport.error") {
      setNotice(event.message);
      return;
    }
    if (event.type === "terminal.data") {
      applyTerminalFrame(event.frame, selectedIdRef, syncRef, terminalRef);
      return;
    }
    applyServerMessage(
      event.message,
      selectedIdRef,
      syncRef,
      terminalRef,
      setSessions,
      setSessionListReady,
      setSelectedId,
      tabsRef,
      setTabs,
      setDefaultCwd,
      setLaunchPresets,
      setNotice,
    );
  }, []);

  useEffect(() => {
    const transport = new PaciumTransport(onTransportEvent);
    transportRef.current = transport;
    transport.start();
    return () => {
      transport.stop();
      transportRef.current = null;
    };
  }, [onTransportEvent]);

  useEffect(() => {
    window.localStorage.setItem(
      TERMINAL_TABS_STORAGE_KEY,
      serializeTerminalTabs(tabs),
    );
  }, [tabs]);

  useEffect(() => {
    if (!sessionListReady) {
      return;
    }
    const reconciled = reconcileTerminalTabs(tabs, sessions, selectedId);
    if (!sameTerminalTabs(tabs, reconciled.tabs)) {
      setTabs(reconciled.tabs);
    }
    if (selectedId !== reconciled.selectedId) {
      setSelectedId(reconciled.selectedId);
    }
  }, [selectedId, sessionListReady, sessions, tabs]);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    document.getElementById(`terminal-tab-${selectedId}`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId, tabs]);

  useEffect(() => {
    if (selectedId === null) {
      window.localStorage.removeItem("pacium.selectedSession");
      syncRef.current = null;
      terminalRef.current?.clear();
      return;
    }
    window.localStorage.setItem("pacium.selectedSession", selectedId);
    syncRef.current = {
      sessionId: selectedId,
      epoch: undefined,
      sequence: 0,
      snapshotApplied: false,
      pending: [],
    };
    terminalRef.current?.clear();
    if (connection === "connected") {
      transportRef.current?.attach(selectedId);
    }
  }, [connection, selectedId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessions],
  );
  const sessionGroups = useMemo(() => groupSessions(sessions), [sessions]);
  const tabSessions = useMemo(
    () =>
      tabs.flatMap((tab) => {
        const session = sessions.find(({ id }) => id === tab.sessionId);
        return session === undefined ? [] : [{ tab, session }];
      }),
    [sessions, tabs],
  );
  const sessionShortcutNumbers = useMemo(
    () =>
      new Map(
        tabs.map((tab, index) => [tab.sessionId, index < 9 ? index + 1 : null]),
      ),
    [tabs],
  );

  const selectSession = (sessionId: string) => {
    setNotice(null);
    setTabs((current) => openTerminalTab(current, sessionId));
    setSelectedId(sessionId);
  };

  const closeViewTab = (sessionId: string) => {
    const session = sessions.find(({ id }) => id === sessionId);
    const next = closeTerminalTab(
      tabsRef.current,
      sessionId,
      selectedIdRef.current,
    );
    setTabs(next.tabs);
    setSelectedId(next.selectedId);
    setNotice(
      `${
        session?.displayName ?? "Terminal"
      } tab closed. Its process is still running in the sidebar.`,
    );
  };

  const createSession = (input: {
    cwd: string;
    displayName?: string;
    launchPreset: LaunchPresetId;
  }) => {
    transportRef.current?.createSession({
      ...input,
      cols: 100,
      rows: 30,
    });
    setCreateOpen(false);
  };

  const loadDirectories = useCallback(
    (path?: string): Promise<DirectoryListing> => {
      const transport = transportRef.current;
      if (transport === null) {
        return Promise.reject(
          new Error("Pacium is still connecting to the host."),
        );
      }
      return transport.listDirectories(path);
    },
    [],
  );

  const closeSelected = () => {
    if (selectedSession === null) {
      return;
    }
    const isLive =
      selectedSession.processState === "live" ||
      selectedSession.processState === "closing";
    if (
      isLive &&
      !window.confirm(
        `Close “${selectedSession.displayName}” and terminate its running shell?`,
      )
    ) {
      return;
    }
    transportRef.current?.closeSession(selectedSession.id, isLive);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = resolveWorkspaceShortcut({
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        editable: isEditableTarget(event.target),
        dialogOpen: createOpen,
      });
      if (shortcut === null) {
        return;
      }

      event.preventDefault();
      switch (shortcut.type) {
        case "exit-terminal-capture":
          terminalRef.current?.blur();
          setTerminalCaptured(false);
          return;
        case "new-terminal":
          setCreateOpen(true);
          return;
        case "previous-session":
        case "next-session":
          setSelectedId((current) =>
            adjacentTerminalTabId(
              tabs,
              current,
              shortcut.type === "previous-session" ? -1 : 1,
            ),
          );
          return;
        case "select-session": {
          const tab = tabs[shortcut.index];
          if (tab !== undefined) {
            setSelectedId(tab.sessionId);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [createOpen, tabs]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <strong>Pacium</strong>
            <span>Control</span>
          </div>
        </header>

        <button
          className="new-terminal-button"
          onClick={() => setCreateOpen(true)}
          title="New terminal (Cmd/Ctrl Shift T)"
          type="button"
        >
          <span aria-hidden="true">＋</span>
          New terminal
        </button>

        <nav aria-label="Terminal sessions" className="session-navigation">
          <div className="section-heading">
            <span>Terminals</span>
            <span>{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="sidebar-empty">
              Your running shells will stay here when the browser refreshes.
            </p>
          ) : (
            <div className="session-groups">
              {sessionGroups.map((group) => (
                <section className="session-group" key={group.key}>
                  <div className="session-group-heading">
                    <span>{group.label}</span>
                    <span>{group.sessions.length}</span>
                  </div>
                  <ul className="session-list">
                    {group.sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          aria-current={
                            session.id === selectedId ? "page" : undefined
                          }
                          className="session-item"
                          onClick={() => selectSession(session.id)}
                          title={`${session.commandLabel} in ${session.cwd}${
                            sessionShortcutNumbers.get(session.id) == null
                              ? ""
                              : ` · Cmd/Ctrl ${sessionShortcutNumbers.get(
                                  session.id,
                                )}`
                          }`}
                          type="button"
                        >
                          <StatusDot state={session.processState} />
                          <span className="session-copy">
                            <strong>{session.displayName}</strong>
                            <span className="session-row-meta">
                              <span className="preset-label">
                                {session.commandLabel}
                              </span>
                              <span>{compactPath(session.cwd)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            aria-describedby="pacium-mode-note"
            className="pacium-toggle"
            disabled
            type="button"
          >
            <span className="toggle-track" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>Pacium mode</strong>
              <small id="pacium-mode-note">Meta · Orchestrator · Queue</small>
            </span>
            <span className="soon-label">Soon</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            <StatusDot state={selectedSession?.processState ?? "idle"} />
            <div>
              <h1>{selectedSession?.displayName ?? "Terminal workspace"}</h1>
              <p>
                {selectedSession?.cwd ??
                  "Create a terminal to begin a local agent session."}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <ConnectionBadge state={connection} />
            <button
              disabled={selectedSession?.processState !== "live"}
              onClick={() => {
                if (selectedSession !== null) {
                  transportRef.current?.interrupt(selectedSession.id);
                }
              }}
              title="Send SIGINT"
              type="button"
            >
              Interrupt
            </button>
            <button
              className="danger-ghost"
              disabled={selectedSession === null}
              onClick={closeSelected}
              type="button"
            >
              Close
            </button>
          </div>
        </header>

        {notice !== null && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} type="button">
              Dismiss
            </button>
          </div>
        )}

        {tabSessions.length > 0 && (
          <div className="terminal-tabs-shell">
            <div
              aria-label="Open terminal tabs"
              className="terminal-tab-list"
              role="tablist"
            >
              {tabSessions.map(({ tab, session }) => (
                <div
                  className={`terminal-tab ${
                    session.id === selectedId ? "is-active" : ""
                  } ${tab.pinned ? "is-pinned" : ""} ${
                    draggedTabId === session.id ? "is-dragging" : ""
                  }`}
                  draggable
                  key={session.id}
                  onDragEnd={() => setDraggedTabId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={(event) => {
                    setDraggedTabId(session.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", session.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId =
                      draggedTabId || event.dataTransfer.getData("text/plain");
                    if (sourceId.length > 0) {
                      setTabs((current) =>
                        moveTerminalTab(current, sourceId, session.id),
                      );
                    }
                    setDraggedTabId(null);
                  }}
                >
                  <button
                    aria-controls="active-terminal-panel"
                    aria-selected={session.id === selectedId}
                    className="terminal-tab-select"
                    id={`terminal-tab-${session.id}`}
                    onClick={() => selectSession(session.id)}
                    onKeyDown={(event) => {
                      if (
                        !event.altKey &&
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !event.shiftKey &&
                        (event.code === "ArrowLeft" ||
                          event.code === "ArrowRight" ||
                          event.code === "Home" ||
                          event.code === "End")
                      ) {
                        event.preventDefault();
                        const nextId =
                          event.code === "Home"
                            ? tabsRef.current[0]?.sessionId
                            : event.code === "End"
                              ? tabsRef.current.at(-1)?.sessionId
                              : adjacentTerminalTabId(
                                  tabsRef.current,
                                  session.id,
                                  event.code === "ArrowLeft" ? -1 : 1,
                                );
                        if (nextId !== undefined && nextId !== null) {
                          selectSession(nextId);
                          window.requestAnimationFrame(() => {
                            document
                              .getElementById(`terminal-tab-${nextId}`)
                              ?.focus();
                          });
                        }
                        return;
                      }
                      if (
                        event.altKey &&
                        event.shiftKey &&
                        (event.code === "ArrowLeft" ||
                          event.code === "ArrowRight")
                      ) {
                        event.preventDefault();
                        setTabs((current) =>
                          moveTerminalTabByOffset(
                            current,
                            session.id,
                            event.code === "ArrowLeft" ? -1 : 1,
                          ),
                        );
                      }
                    }}
                    role="tab"
                    tabIndex={session.id === selectedId ? 0 : -1}
                    title={`${session.displayName} · Alt Shift Left/Right reorders inside ${
                      tab.pinned ? "pinned" : "regular"
                    } tabs`}
                    type="button"
                  >
                    <StatusDot state={session.processState} />
                    <span className="terminal-tab-copy">
                      <strong>{session.displayName}</strong>
                      <small>{session.commandLabel}</small>
                    </span>
                  </button>
                  <button
                    aria-label={`${tab.pinned ? "Unpin" : "Pin"} ${
                      session.displayName
                    } tab`}
                    aria-pressed={tab.pinned}
                    className="terminal-tab-action"
                    onClick={() =>
                      setTabs((current) =>
                        toggleTerminalTabPin(current, session.id),
                      )
                    }
                    title={tab.pinned ? "Unpin tab" : "Pin tab"}
                    type="button"
                  >
                    <span aria-hidden="true">{tab.pinned ? "◆" : "◇"}</span>
                  </button>
                  <button
                    aria-label={`Close ${session.displayName} tab; terminal keeps running`}
                    className="terminal-tab-action close-tab-action"
                    onClick={() => closeViewTab(session.id)}
                    title="Close tab · terminal keeps running"
                    type="button"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <section
          aria-label="Active terminal"
          aria-labelledby={
            selectedSession === null
              ? undefined
              : `terminal-tab-${selectedSession.id}`
          }
          className="terminal-panel"
          id="active-terminal-panel"
          role="tabpanel"
        >
          {selectedSession === null ? (
            <EmptyWorkspace
              onCreate={() => setCreateOpen(true)}
              onOpenRunning={
                sessions[0] === undefined
                  ? undefined
                  : () => selectSession(sessions[0]!.id)
              }
              runningSessionCount={sessions.length}
            />
          ) : (
            <>
              <div className="terminal-chrome">
                <span>{selectedSession.commandLabel}</span>
                <span>
                  {terminalCaptured
                    ? "Terminal capture · Ctrl Shift ."
                    : `${selectedSession.cols} × ${selectedSession.rows}`}
                </span>
              </div>
              <TerminalSurface
                ref={terminalRef}
                ariaLabel={`${selectedSession.displayName} terminal`}
                disabled={selectedSession.processState !== "live"}
                onCaptureChange={setTerminalCaptured}
                onInput={(data) => {
                  if (selectedSession.processState === "live") {
                    transportRef.current?.input(selectedSession.id, data);
                  }
                }}
                onResize={(cols, rows) => {
                  if (
                    selectedSession.processState === "live" &&
                    (cols !== selectedSession.cols ||
                      rows !== selectedSession.rows)
                  ) {
                    transportRef.current?.resize(
                      selectedSession.id,
                      cols,
                      rows,
                    );
                  }
                }}
              />
            </>
          )}
        </section>
      </main>

      <aside className="inspector">
        <header>
          <span>Session</span>
          <span className="panel-label">Details</span>
        </header>
        {selectedSession === null ? (
          <p className="inspector-empty">
            Runtime details and agent context appear here.
          </p>
        ) : (
          <dl className="metadata">
            <Metadata label="State">
              <span className="state-value">
                <StatusDot state={selectedSession.processState} />
                {selectedSession.processState}
              </span>
            </Metadata>
            <Metadata label="Runtime">Direct PTY</Metadata>
            <Metadata label="Preset">{selectedSession.commandLabel}</Metadata>
            <Metadata label="Command">{selectedSession.shell}</Metadata>
            <Metadata label="Repository">
              {selectedSession.repositoryName ?? "Not detected"}
            </Metadata>
            <Metadata label="Process">
              {selectedSession.pid ?? "Exited"}
            </Metadata>
            <Metadata label="Started">
              {formatTime(selectedSession.createdAt)}
            </Metadata>
            {selectedSession.exitedAt !== null && (
              <Metadata label="Exited">
                {formatTime(selectedSession.exitedAt)}
              </Metadata>
            )}
          </dl>
        )}
        <section className="inspector-section">
          <h2>Agent context</h2>
          <div className="planned-card">
            <span className="planned-icon" aria-hidden="true">
              ◇
            </span>
            <div>
              <strong>CLI awareness comes next</strong>
              <p>
                Provider status, Git changes, and work evidence will live here
                without replacing terminal truth.
              </p>
            </div>
          </div>
        </section>
      </aside>

      {createOpen && (
        <CreateTerminalDialog
          defaultCwd={defaultCwd}
          launchPresets={launchPresets}
          loadDirectories={loadDirectories}
          onCancel={() => setCreateOpen(false)}
          onCreate={createSession}
        />
      )}
    </div>
  );
}

function applyServerMessage(
  message: ServerMessage,
  selectedIdRef: React.MutableRefObject<string | null>,
  syncRef: React.MutableRefObject<TerminalSync | null>,
  terminalRef: React.MutableRefObject<TerminalSurfaceHandle | null>,
  setSessions: React.Dispatch<React.SetStateAction<SessionSummary[]>>,
  setSessionListReady: React.Dispatch<React.SetStateAction<boolean>>,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
  tabsRef: React.MutableRefObject<TerminalTab[]>,
  setTabs: React.Dispatch<React.SetStateAction<TerminalTab[]>>,
  setDefaultCwd: React.Dispatch<React.SetStateAction<string>>,
  setLaunchPresets: React.Dispatch<
    React.SetStateAction<LaunchPresetCapability[]>
  >,
  setNotice: React.Dispatch<React.SetStateAction<string | null>>,
): void {
  switch (message.type) {
    case "server.welcome":
      setDefaultCwd(message.defaultCwd);
      setLaunchPresets(message.capabilities.launchPresets);
      return;
    case "session.list":
      setSessions(message.sessions);
      setSessionListReady(true);
      setSelectedId((current) => {
        if (
          current !== null &&
          message.sessions.some(({ id }) => id === current)
        ) {
          return current;
        }
        const restoredTab = tabsRef.current.find((tab) =>
          message.sessions.some(({ id }) => id === tab.sessionId),
        );
        return restoredTab?.sessionId ?? message.sessions[0]?.id ?? null;
      });
      return;
    case "session.created":
      setSessions((current) => upsertSession(current, message.session));
      setTabs((current) => openTerminalTab(current, message.session.id));
      setSelectedId(message.session.id);
      return;
    case "session.updated":
    case "session.exited":
      setSessions((current) => upsertSession(current, message.session));
      return;
    case "session.closed":
      setSessions((current) =>
        current.filter(({ id }) => id !== message.sessionId),
      );
      {
        const next = closeTerminalTab(
          tabsRef.current,
          message.sessionId,
          selectedIdRef.current,
        );
        setTabs(next.tabs);
        setSelectedId(next.selectedId);
      }
      return;
    case "terminal.snapshot": {
      if (selectedIdRef.current !== message.sessionId) {
        return;
      }
      const sync = syncRef.current;
      if (sync === null || sync.sessionId !== message.sessionId) {
        return;
      }
      sync.epoch = message.epoch;
      sync.sequence = message.sequence;
      sync.snapshotApplied = true;
      terminalRef.current?.applySnapshot(message);
      for (const frame of sync.pending) {
        if (frame.epoch === sync.epoch && frame.sequence > sync.sequence) {
          terminalRef.current?.write(frame.data);
          sync.sequence = frame.sequence;
        }
      }
      sync.pending = [];
      if (message.truncated) {
        setNotice(
          "This session exceeded the reconnect snapshot limit; the newest screen state was restored.",
        );
      }
      terminalRef.current?.focus();
      return;
    }
    case "error":
      setNotice(message.message);
      return;
    case "command.result":
      return;
  }
}

function applyTerminalFrame(
  frame: TerminalDataFrame,
  selectedIdRef: React.MutableRefObject<string | null>,
  syncRef: React.MutableRefObject<TerminalSync | null>,
  terminalRef: React.MutableRefObject<TerminalSurfaceHandle | null>,
): void {
  if (selectedIdRef.current !== frame.sessionId) {
    return;
  }
  const sync = syncRef.current;
  if (sync === null || sync.sessionId !== frame.sessionId) {
    return;
  }
  if (!sync.snapshotApplied) {
    if (sync.pending.length < 1_000) {
      sync.pending.push(frame);
    }
    return;
  }
  if (frame.epoch !== sync.epoch || frame.sequence <= sync.sequence) {
    return;
  }
  terminalRef.current?.write(frame.data);
  sync.sequence = frame.sequence;
}

function upsertSession(
  sessions: SessionSummary[],
  incoming: SessionSummary,
): SessionSummary[] {
  const index = sessions.findIndex(({ id }) => id === incoming.id);
  if (index === -1) {
    return [...sessions, incoming];
  }
  return sessions.map((session) =>
    session.id === incoming.id ? incoming : session,
  );
}

function CreateTerminalDialog({
  defaultCwd,
  launchPresets,
  loadDirectories,
  onCancel,
  onCreate,
}: {
  defaultCwd: string;
  launchPresets: LaunchPresetCapability[];
  loadDirectories: (path?: string) => Promise<DirectoryListing>;
  onCancel: () => void;
  onCreate: (input: {
    cwd: string;
    displayName?: string;
    launchPreset: LaunchPresetId;
  }) => void;
}) {
  const [cwd, setCwd] = useState(defaultCwd);
  const [displayName, setDisplayName] = useState("");
  const [launchPreset, setLaunchPreset] = useState<LaunchPresetId>("shell");
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedPreset = launchPresets.find(
    (preset) => preset.id === launchPreset,
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = displayName.trim();
    onCreate({
      cwd: cwd.trim(),
      launchPreset,
      ...(name.length > 0 ? { displayName: name } : {}),
    });
  };

  if (pickerOpen) {
    return (
      <DirectoryPicker
        initialPath={cwd.trim() || defaultCwd}
        loadDirectories={loadDirectories}
        onCancel={() => setPickerOpen(false)}
        onSelect={(path) => {
          setCwd(path);
          setPickerOpen(false);
        }}
      />
    );
  }

  return (
    <div
      aria-labelledby="create-terminal-title"
      aria-modal="true"
      className="dialog-backdrop"
      role="dialog"
    >
      <form className="dialog-card" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">New session</span>
            <h2 id="create-terminal-title">Open a terminal</h2>
          </div>
          <button aria-label="Cancel" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <fieldset className="preset-fieldset">
          <legend>Launch preset</legend>
          <div className="preset-options">
            {launchPresets.map((preset) => (
              <label
                className={`preset-option ${
                  launchPreset === preset.id ? "is-selected" : ""
                }`}
                key={preset.id}
                title={preset.unavailableReason ?? preset.label}
              >
                <input
                  checked={launchPreset === preset.id}
                  disabled={!preset.available}
                  name="launch-preset"
                  onChange={() => setLaunchPreset(preset.id)}
                  type="radio"
                  value={preset.id}
                />
                <span className="preset-glyph" aria-hidden="true">
                  {preset.id === "shell"
                    ? ">_"
                    : preset.id === "codex"
                      ? "C"
                      : "A"}
                </span>
                <span>
                  <strong>{preset.label}</strong>
                  <small>{preset.available ? "Ready" : "Not installed"}</small>
                </span>
              </label>
            ))}
          </div>
          {selectedPreset?.unavailableReason !== null &&
            selectedPreset?.unavailableReason !== undefined && (
              <p className="preset-unavailable">
                {selectedPreset.unavailableReason}
              </p>
            )}
        </fieldset>
        <div className="dialog-field">
          <label htmlFor="working-directory">Working directory</label>
          <div className="path-input-row">
            <input
              autoFocus
              id="working-directory"
              onChange={(event) => setCwd(event.target.value)}
              placeholder="/Users/you/Projects/project"
              required
              spellCheck={false}
              value={cwd}
            />
            <button
              className="browse-directory-button"
              onClick={() => setPickerOpen(true)}
              type="button"
            >
              <span aria-hidden="true">⌘</span>
              Browse
            </button>
          </div>
          <small className="field-helper">
            Choose a folder on the Pacium host or enter an absolute path.
          </small>
        </div>
        <label>
          <span>
            Name <small>Optional</small>
          </span>
          <input
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Project shell"
            value={displayName}
          />
        </label>
        <p className="dialog-note">
          {selectedPreset?.label ?? "The command"} runs as your local user and
          remains alive while this Pacium server is running.
        </p>
        <div className="dialog-actions">
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Open terminal
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyWorkspace({
  onCreate,
  onOpenRunning,
  runningSessionCount,
}: {
  onCreate: () => void;
  onOpenRunning: (() => void) | undefined;
  runningSessionCount: number;
}) {
  const hasRunningSessions = runningSessionCount > 0;
  return (
    <div className="empty-workspace">
      <div className="empty-glyph" aria-hidden="true">
        &gt;_
      </div>
      <h2>
        {hasRunningSessions
          ? "No terminal tabs are open"
          : "Your terminal workspace is ready"}
      </h2>
      <p>
        {hasRunningSessions
          ? `${runningSessionCount} ${
              runningSessionCount === 1 ? "terminal is" : "terminals are"
            } still running safely in the sidebar.`
          : "Open a shell for a project. Refreshing the browser reconnects to the same process while the local server stays running."}
      </p>
      {hasRunningSessions && onOpenRunning !== undefined ? (
        <button
          className="primary-button"
          onClick={onOpenRunning}
          type="button"
        >
          Reopen running terminal
        </button>
      ) : (
        <button className="primary-button" onClick={onCreate} type="button">
          Open first terminal
        </button>
      )}
      <span className="shortcut-hint">
        {hasRunningSessions
          ? "Closing a tab never stops its terminal process."
          : "Cmd/Ctrl Shift T opens this launcher from anywhere in the workspace."}
      </span>
    </div>
  );
}

function StatusDot({ state }: { state: string }) {
  return <span aria-hidden="true" className={`status-dot state-${state}`} />;
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <span className={`connection-badge connection-${state}`}>
      <StatusDot state={state === "connected" ? "live" : "waiting"} />
      {state}
    </span>
  );
}

function Metadata({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function compactPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return `…/${parts.slice(-2).join("/")}`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function sameTerminalTabs(left: TerminalTab[], right: TerminalTab[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (tab, index) =>
        tab.sessionId === right[index]?.sessionId &&
        tab.pinned === right[index]?.pinned,
    )
  );
}
