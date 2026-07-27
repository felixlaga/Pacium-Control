import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { TerminalSurfaceHandle } from "@pacium/terminal-ui";
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
import { CommandPalette, type CommandPaletteView } from "./command-palette.js";
import {
  buildPaletteCatalog,
  type PaletteCommand,
} from "./command-palette-model.js";
import { DirectoryPicker } from "./directory-picker.js";
import { RenameSessionDialog, SessionActionsMenu } from "./session-actions.js";
import {
  duplicateSessionInput,
  relaunchSessionInput,
} from "./session-actions-model.js";
import { SplitWorkspace } from "./split-workspace.js";
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
import {
  MAX_SPLIT_PANES,
  assignSessionToPane,
  clearSessionFromLayout,
  closePane,
  createSplitLayout,
  focusPane,
  focusPaneByOffset,
  getFocusedPane,
  listPanes,
  parseStoredSplitLayout,
  reconcileSplitLayout,
  serializeSplitLayout,
  setSplitRatio,
  showSessionInFocusedPane,
  splitFocusedPane,
  toggleMaximizedPane,
  type SplitDirection,
  type SplitLayoutState,
} from "./split-layout-model.js";

interface TerminalSync {
  sessionId: string;
  surface: TerminalSurfaceHandle;
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
const SPLIT_LAYOUT_STORAGE_KEY = "pacium.splitLayout";

export function App() {
  const terminalRefs = useRef(new Map<string, TerminalSurfaceHandle>());
  const selectedIdRef = useRef<string | null>(null);
  const tabsRef = useRef<TerminalTab[]>([]);
  const syncRefs = useRef(new Map<string, TerminalSync>());
  const layoutRef = useRef<SplitLayoutState>(
    createSplitLayout(`pane-${crypto.randomUUID()}`),
  );
  const paletteInvokerRef = useRef<HTMLElement | null>(null);
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
  const [layout, setLayout] = useState<SplitLayoutState>(() => {
    const restored = parseStoredSplitLayout(
      window.localStorage.getItem(SPLIT_LAYOUT_STORAGE_KEY),
    );
    return restored ?? createSplitLayout(`pane-${crypto.randomUUID()}`);
  });
  const [defaultCwd, setDefaultCwd] = useState("");
  const [launchPresets, setLaunchPresets] = useState(INITIAL_LAUNCH_PRESETS);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [capturedPaneId, setCapturedPaneId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [paletteView, setPaletteView] = useState<CommandPaletteView | null>(
    null,
  );

  selectedIdRef.current = selectedId;
  tabsRef.current = tabs;
  layoutRef.current = layout;

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
      applyTerminalFrame(event.frame, syncRefs, terminalRefs);
      return;
    }
    applyServerMessage(
      event.message,
      selectedIdRef,
      syncRefs,
      terminalRefs,
      setSessions,
      setSessionListReady,
      setSelectedId,
      tabsRef,
      setTabs,
      setLayout,
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
    window.localStorage.setItem(
      SPLIT_LAYOUT_STORAGE_KEY,
      serializeSplitLayout(layout),
    );
  }, [layout]);

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
      return;
    }
    window.localStorage.setItem("pacium.selectedSession", selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!sessionListReady) {
      return;
    }
    const validSessionIds = new Set(sessions.map(({ id }) => id));
    const reconciled = reconcileSplitLayout(layoutRef.current, validSessionIds);
    setLayout(reconciled);
  }, [sessionListReady, sessions]);

  useEffect(() => {
    if (
      !sessionListReady ||
      selectedId === null ||
      !sessions.some(({ id }) => id === selectedId)
    ) {
      return;
    }
    const next = showSessionInFocusedPane(layoutRef.current, selectedId);
    if (
      serializeSplitLayout(next) !== serializeSplitLayout(layoutRef.current)
    ) {
      setLayout(next);
    }
  }, [selectedId, sessionListReady, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessions],
  );
  const actionSession =
    sessions.find(({ id }) => id === actionSessionId) ?? null;
  const renameSession =
    sessions.find(({ id }) => id === renameSessionId) ?? null;
  const renderedSessionIds = useMemo(() => {
    const panes = listPanes(layout.root);
    if (layout.maximizedPaneId !== null) {
      const maximized = panes.find(
        (pane) => pane.id === layout.maximizedPaneId,
      );
      return maximized?.sessionId === null || maximized === undefined
        ? []
        : [maximized.sessionId];
    }
    return panes.flatMap((pane) =>
      pane.sessionId === null ? [] : [pane.sessionId],
    );
  }, [layout]);
  const paletteCommands = useMemo(
    () =>
      buildPaletteCatalog({
        focusedPaneId: getFocusedPane(layout)?.id ?? null,
        maximizedPaneId: layout.maximizedPaneId,
        paneCount: listPanes(layout.root).length,
        selectedSessionId: selectedId,
        sessions,
      }),
    [layout, selectedId, sessions],
  );

  useEffect(() => {
    if (connection !== "connected") {
      syncRefs.current.clear();
      return;
    }
    const rendered = new Set(renderedSessionIds);
    for (const sessionId of syncRefs.current.keys()) {
      if (!rendered.has(sessionId)) {
        syncRefs.current.delete(sessionId);
      }
    }
    for (const sessionId of renderedSessionIds) {
      const surface = terminalRefs.current.get(sessionId);
      if (surface === undefined) {
        continue;
      }
      const existing = syncRefs.current.get(sessionId);
      if (existing?.surface === surface) {
        continue;
      }
      syncRefs.current.set(sessionId, {
        sessionId,
        surface,
        epoch: undefined,
        sequence: 0,
        snapshotApplied: false,
        pending: [],
      });
      surface.clear();
      transportRef.current?.attach(sessionId);
    }
  }, [connection, renderedSessionIds]);
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
    setLayout(showSessionInFocusedPane(layoutRef.current, sessionId));
    setSelectedId(sessionId);
  };

  const selectPane = (paneId: string) => {
    const next = focusPane(layoutRef.current, paneId);
    setLayout(next);
    setSelectedId(getFocusedPane(next)?.sessionId ?? null);
    setCapturedPaneId(null);
  };

  const assignSession = (paneId: string, sessionId: string) => {
    setTabs((current) => openTerminalTab(current, sessionId));
    const next = assignSessionToPane(layoutRef.current, paneId, sessionId);
    setLayout(next);
    setSelectedId(sessionId);
  };

  const splitPane = (direction: SplitDirection) => {
    const next = splitFocusedPane(
      layoutRef.current,
      direction,
      `split-${crypto.randomUUID()}`,
      `pane-${crypto.randomUUID()}`,
    );
    if (next === layoutRef.current) {
      setNotice(`Pacium keeps split layouts to ${MAX_SPLIT_PANES} panes.`);
      return;
    }
    setLayout(next);
    setSelectedId(null);
    setCapturedPaneId(null);
  };

  const closePaneView = (paneId: string) => {
    const pane = listPanes(layoutRef.current.root).find(
      (candidate) => candidate.id === paneId,
    );
    const session = sessions.find(({ id }) => id === pane?.sessionId);
    const next = closePane(layoutRef.current, paneId);
    setLayout(next);
    setSelectedId(getFocusedPane(next)?.sessionId ?? null);
    setCapturedPaneId(null);
    if (session !== undefined) {
      setNotice(
        `${session.displayName} pane closed. Its process and tab are still available.`,
      );
    }
  };

  const focusAdjacentPane = (direction: -1 | 1) => {
    const next = focusPaneByOffset(layoutRef.current, direction);
    setLayout(next);
    setSelectedId(getFocusedPane(next)?.sessionId ?? null);
    setCapturedPaneId(null);
  };

  const closeViewTab = (sessionId: string) => {
    const session = sessions.find(({ id }) => id === sessionId);
    const next = closeTerminalTab(
      tabsRef.current,
      sessionId,
      selectedIdRef.current,
    );
    setTabs(next.tabs);
    setLayout(clearSessionFromLayout(layoutRef.current, sessionId));
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

  const terminateSession = (session: SessionSummary) => {
    const isLive =
      session.processState === "live" || session.processState === "closing";
    const consequence = isLive
      ? `Terminate “${session.displayName}”? Pacium will send SIGTERM and force termination if it does not exit.`
      : `Remove the ended session “${session.displayName}” from Pacium?`;
    if (!window.confirm(consequence)) {
      return;
    }
    transportRef.current?.closeSession(session.id, isLive);
    setActionSessionId(null);
  };

  const copySessionDirectory = async (session: SessionSummary) => {
    try {
      if (navigator.clipboard === undefined) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(session.cwd);
      setNotice(`Copied ${session.cwd}`);
    } catch {
      setNotice(
        `Pacium could not access the clipboard. The path is ${session.cwd}`,
      );
    }
    setActionSessionId(null);
  };

  const duplicateSession = (session: SessionSummary) => {
    transportRef.current?.createSession(duplicateSessionInput(session));
    setNotice(
      `Starting a duplicate of ${session.displayName}. The original process is unchanged.`,
    );
    setActionSessionId(null);
  };

  const relaunchSession = (session: SessionSummary) => {
    const input = relaunchSessionInput(session);
    if (input !== null) {
      transportRef.current?.createSession(input);
      setNotice(
        `Starting a new ${session.displayName} process from its retained preset and directory.`,
      );
    }
    setActionSessionId(null);
  };

  const interruptSession = (session: SessionSummary) => {
    transportRef.current?.interrupt(session.id);
    setNotice(
      `Sent SIGINT to ${session.displayName}. The process may continue running.`,
    );
    setActionSessionId(null);
  };

  const beginRenameSession = (session: SessionSummary) => {
    setRenameSessionId(session.id);
    setActionSessionId(null);
  };

  const revealSessionRepository = (session: SessionSummary) => {
    transportRef.current?.revealRepository(session.id);
    setNotice(
      `Asked the Pacium host to reveal ${session.repositoryName ?? "the repository"}.`,
    );
    setActionSessionId(null);
  };

  const openPalette = (view: CommandPaletteView) => {
    const activeElement = document.activeElement;
    paletteInvokerRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : document.getElementById("command-palette-trigger");
    setCapturedPaneId(null);
    setPaletteView(view);
  };

  const closePalette = (restoreFocus = true) => {
    setPaletteView(null);
    if (!restoreFocus) {
      return;
    }
    const target = paletteInvokerRef.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) {
        target.focus();
        return;
      }
      document.getElementById("command-palette-trigger")?.focus();
    });
  };

  const executePaletteCommand = (command: PaletteCommand) => {
    if (!command.enabled) {
      return;
    }
    if (command.action.type === "show-shortcuts") {
      setPaletteView("shortcuts");
      return;
    }

    closePalette(false);
    switch (command.action.type) {
      case "new-terminal":
        setCreateOpen(true);
        return;
      case "split-pane":
        splitPane(command.action.direction);
        return;
      case "focus-pane":
        focusAdjacentPane(command.action.direction);
        return;
      case "toggle-maximize": {
        const next = toggleMaximizedPane(
          layoutRef.current,
          command.action.paneId,
        );
        setLayout(next);
        setSelectedId(getFocusedPane(next)?.sessionId ?? null);
        return;
      }
      case "select-session":
        selectSession(command.action.sessionId);
        return;
      case "rename-session":
      case "duplicate-session":
      case "relaunch-session":
      case "copy-session-directory":
      case "reveal-session-repository":
      case "close-session-view":
      case "interrupt-session":
      case "review-session-termination": {
        const sessionId = command.action.sessionId;
        const session = sessions.find(({ id }) => id === sessionId);
        if (session === undefined) {
          setNotice("That session is no longer available. Reopen the palette.");
          return;
        }
        switch (command.action.type) {
          case "rename-session":
            beginRenameSession(session);
            return;
          case "duplicate-session":
            duplicateSession(session);
            return;
          case "relaunch-session":
            relaunchSession(session);
            return;
          case "copy-session-directory":
            void copySessionDirectory(session);
            return;
          case "reveal-session-repository":
            revealSessionRepository(session);
            return;
          case "close-session-view":
            closeViewTab(session.id);
            return;
          case "interrupt-session":
            interruptSession(session);
            return;
          case "review-session-termination":
            terminateSession(session);
            return;
        }
      }
    }
  };

  const modalOpen =
    createOpen ||
    actionSession !== null ||
    renameSession !== null ||
    paletteView !== null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = resolveWorkspaceShortcut({
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        editable: isEditableTarget(event.target),
        dialogOpen: modalOpen,
        terminalCaptured: capturedPaneId !== null,
      });
      if (shortcut === null) {
        return;
      }

      event.preventDefault();
      switch (shortcut.type) {
        case "exit-terminal-capture": {
          const capturedPane = listPanes(layoutRef.current.root).find(
            (pane) => pane.id === capturedPaneId,
          );
          if (capturedPane !== undefined && capturedPane.sessionId !== null) {
            terminalRefs.current.get(capturedPane.sessionId)?.blur();
          }
          setCapturedPaneId(null);
          return;
        }
        case "open-command-palette":
          openPalette("commands");
          return;
        case "open-shortcut-reference":
          openPalette("shortcuts");
          return;
        case "new-terminal":
          setCreateOpen(true);
          return;
        case "previous-session":
        case "next-session": {
          const sessionId = adjacentTerminalTabId(
            tabs,
            selectedIdRef.current,
            shortcut.type === "previous-session" ? -1 : 1,
          );
          if (sessionId !== null) {
            selectSession(sessionId);
          }
          return;
        }
        case "select-session": {
          const tab = tabs[shortcut.index];
          if (tab !== undefined) {
            selectSession(tab.sessionId);
          }
          return;
        }
        case "split-horizontal":
          splitPane("horizontal");
          return;
        case "split-vertical":
          splitPane("vertical");
          return;
        case "previous-pane":
          focusAdjacentPane(-1);
          return;
        case "next-pane":
          focusAdjacentPane(1);
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [capturedPaneId, modalOpen, tabs]);

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
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setActionSessionId(session.id);
                          }}
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
              aria-keyshortcuts="Meta+K Control+K"
              id="command-palette-trigger"
              onClick={() => openPalette("commands")}
              title="Command palette (Cmd/Ctrl K)"
              type="button"
            >
              Commands
              <kbd>⌘K</kbd>
            </button>
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
              disabled={selectedSession === null}
              onClick={() => setActionSessionId(selectedSession?.id ?? null)}
              title="Session actions"
              type="button"
            >
              Actions
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
            <div className="terminal-tabs-row">
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
                        draggedTabId ||
                        event.dataTransfer.getData("text/plain");
                      if (sourceId.length > 0) {
                        setTabs((current) =>
                          moveTerminalTab(current, sourceId, session.id),
                        );
                      }
                      setDraggedTabId(null);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setActionSessionId(session.id);
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
              <div className="split-toolbar" aria-label="Split layout actions">
                <button
                  disabled={listPanes(layout.root).length >= MAX_SPLIT_PANES}
                  onClick={() => splitPane("horizontal")}
                  title="Split right (Cmd/Ctrl \\)"
                  type="button"
                >
                  <span aria-hidden="true">▥</span>
                  <span className="visually-hidden">Split right</span>
                </button>
                <button
                  disabled={listPanes(layout.root).length >= MAX_SPLIT_PANES}
                  onClick={() => splitPane("vertical")}
                  title="Split down (Cmd/Ctrl Shift \\)"
                  type="button"
                >
                  <span aria-hidden="true">▤</span>
                  <span className="visually-hidden">Split down</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <section
          aria-label={
            selectedSession === null ? "Terminal split workspace" : undefined
          }
          aria-labelledby={
            selectedSession === null
              ? undefined
              : `terminal-tab-${selectedSession.id}`
          }
          className="terminal-panel split-workspace"
          id="active-terminal-panel"
          role="tabpanel"
        >
          {sessions.length === 0 ? (
            <EmptyWorkspace
              onCreate={() => setCreateOpen(true)}
              onOpenRunning={undefined}
              runningSessionCount={0}
            />
          ) : (
            <SplitWorkspace
              capturedPaneId={capturedPaneId}
              layout={layout}
              onAssignSession={assignSession}
              onCaptureChange={(paneId, captured) => {
                if (captured) {
                  const next = focusPane(layoutRef.current, paneId);
                  setLayout(next);
                  setSelectedId(getFocusedPane(next)?.sessionId ?? null);
                  setCapturedPaneId(paneId);
                  return;
                }
                setCapturedPaneId((current) =>
                  current === paneId ? null : current,
                );
              }}
              onClosePane={closePaneView}
              onFocusPane={selectPane}
              onInput={(sessionId, data) =>
                transportRef.current?.input(sessionId, data)
              }
              onOpenActions={(sessionId) => setActionSessionId(sessionId)}
              onResize={(sessionId, cols, rows) =>
                transportRef.current?.resize(sessionId, cols, rows)
              }
              onSetRatio={(splitId, ratio) =>
                setLayout(setSplitRatio(layoutRef.current, splitId, ratio))
              }
              onSplit={(paneId, direction) => {
                const focused = focusPane(layoutRef.current, paneId);
                const next = splitFocusedPane(
                  focused,
                  direction,
                  `split-${crypto.randomUUID()}`,
                  `pane-${crypto.randomUUID()}`,
                );
                if (next === focused) {
                  setNotice(
                    `Pacium keeps split layouts to ${MAX_SPLIT_PANES} panes.`,
                  );
                  return;
                }
                setLayout(next);
                setSelectedId(null);
                setCapturedPaneId(null);
              }}
              onToggleMaximize={(paneId) => {
                const next = toggleMaximizedPane(layoutRef.current, paneId);
                setLayout(next);
                setSelectedId(getFocusedPane(next)?.sessionId ?? null);
              }}
              sessions={sessions}
              terminalRefs={terminalRefs}
            />
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
      {paletteView !== null && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => closePalette()}
          onExecute={executePaletteCommand}
          onViewChange={setPaletteView}
          view={paletteView}
        />
      )}
      {actionSession !== null && (
        <SessionActionsMenu
          onClose={() => setActionSessionId(null)}
          onCloseView={() => {
            closeViewTab(actionSession.id);
            setActionSessionId(null);
          }}
          onCopyDirectory={() => {
            void copySessionDirectory(actionSession);
          }}
          onDuplicate={() => duplicateSession(actionSession)}
          onInterrupt={() => interruptSession(actionSession)}
          onRelaunch={() => relaunchSession(actionSession)}
          onRename={() => beginRenameSession(actionSession)}
          onRevealRepository={() => revealSessionRepository(actionSession)}
          onTerminate={() => terminateSession(actionSession)}
          session={actionSession}
        />
      )}
      {renameSession !== null && (
        <RenameSessionDialog
          onCancel={() => setRenameSessionId(null)}
          onRename={(displayName) => {
            transportRef.current?.renameSession(renameSession.id, displayName);
            setNotice(`Renaming ${renameSession.displayName}…`);
            setRenameSessionId(null);
          }}
          session={renameSession}
        />
      )}
    </div>
  );
}

function applyServerMessage(
  message: ServerMessage,
  selectedIdRef: React.MutableRefObject<string | null>,
  syncRefs: React.MutableRefObject<Map<string, TerminalSync>>,
  terminalRefs: React.MutableRefObject<Map<string, TerminalSurfaceHandle>>,
  setSessions: React.Dispatch<React.SetStateAction<SessionSummary[]>>,
  setSessionListReady: React.Dispatch<React.SetStateAction<boolean>>,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
  tabsRef: React.MutableRefObject<TerminalTab[]>,
  setTabs: React.Dispatch<React.SetStateAction<TerminalTab[]>>,
  setLayout: React.Dispatch<React.SetStateAction<SplitLayoutState>>,
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
      syncRefs.current.delete(message.sessionId);
      terminalRefs.current.delete(message.sessionId);
      setSessions((current) =>
        current.filter(({ id }) => id !== message.sessionId),
      );
      setLayout((current) =>
        clearSessionFromLayout(current, message.sessionId),
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
      const sync = syncRefs.current.get(message.sessionId);
      if (sync === undefined) {
        return;
      }
      sync.epoch = message.epoch;
      sync.sequence = message.sequence;
      sync.snapshotApplied = true;
      const terminal = terminalRefs.current.get(message.sessionId);
      terminal?.applySnapshot(message);
      for (const frame of sync.pending) {
        if (frame.epoch === sync.epoch && frame.sequence > sync.sequence) {
          terminal?.write(frame.data);
          sync.sequence = frame.sequence;
        }
      }
      sync.pending = [];
      if (message.truncated) {
        setNotice(
          "This session exceeded the reconnect snapshot limit; the newest screen state was restored.",
        );
      }
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
  syncRefs: React.MutableRefObject<Map<string, TerminalSync>>,
  terminalRefs: React.MutableRefObject<Map<string, TerminalSurfaceHandle>>,
): void {
  const sync = syncRefs.current.get(frame.sessionId);
  if (sync === undefined) {
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
  terminalRefs.current.get(frame.sessionId)?.write(frame.data);
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
