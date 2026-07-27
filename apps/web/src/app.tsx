import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  type TerminalDisplayPreferences,
  type TerminalSurfaceHandle,
} from "@pacium/terminal-ui";
import type {
  DirectoryListing,
  GitChangedFile,
  LaunchPresetCapability,
  LaunchPresetId,
  PaciumBinding,
  PaciumRoleId,
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
import { handleModalKeyDown } from "./modal-focus.js";
import { AgentClassificationCard } from "./agent-classification.js";
import { sessionAccessibleName } from "./agent-classification-model.js";
import { AttentionEvidenceCard } from "./attention.js";
import {
  AttentionCursorHeader,
  UnreadAttentionMarker,
} from "./attention-inbox.js";
import {
  acknowledgeAttention,
  buildAttentionNotificationContent,
  cursorEntry,
  isAttentionUnread,
  loadAttentionInbox,
  markAttentionNotified,
  saveAttentionInbox,
  setSessionMuted,
  shouldDeliverAttentionNotification,
  type AttentionInboxState,
} from "./attention-inbox-model.js";
import {
  attentionStateLabel,
  deriveProcessAttention,
} from "./attention-model.js";
import {
  loadPanelView,
  savePanelView,
  toggleInspector,
  toggleSidebar,
  workspaceStatusText,
} from "./panel-model.js";
import {
  IDLE_PACIUM_CONFIG,
  acceptPaciumConfigResponse,
  beginPaciumConfigRequest,
  interruptPaciumConfigRequest,
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import { buildPaciumModeSummary } from "./pacium-mode-summary-model.js";
import { PaciumModeSummaryCard } from "./pacium-mode-summary.js";
import { PaciumPromptComposer } from "./pacium-prompt-composer.js";
import {
  EMPTY_PACIUM_PROMPT,
  acceptPaciumPromptResult,
  beginPaciumPromptSend,
  interruptPaciumPrompt,
  paciumPromptTerminalInput,
  reconcilePaciumPromptTarget,
  rejectPaciumPromptResult,
  type PaciumPromptState,
} from "./pacium-prompt-model.js";
import {
  availablePaciumPromptTarget,
  buildPaciumPromptTargets,
  type PaciumPromptTargetId,
  type PaciumPromptTargetProjection,
} from "./pacium-prompt-target-model.js";
import {
  IDLE_PACIUM_QUEUE,
  acceptPaciumQueueResponse,
  acceptPaciumQueueUpdate,
  beginPaciumQueueRequest,
  buildPaciumQueueProjection,
  interruptPaciumQueueRequest,
  type PaciumQueueViewState,
} from "./pacium-queue-model.js";
import { PaciumQueueSources } from "./pacium-queue-sources.js";
import { PaciumRoleBindingDialog } from "./pacium-role-binding.js";
import {
  buildPaciumRoleBindingOptions,
  createMinimalPaciumWorkspace,
  replacePaciumRoleBinding,
} from "./pacium-role-binding-model.js";
import { PaciumRoleGroup } from "./pacium-role-card.js";
import {
  buildPaciumRoleModels,
  roleLabel,
  type PendingPaciumRoleLaunch,
} from "./pacium-role-model.js";
import {
  TERMINAL_FONT_STACKS,
  loadPreferences,
  resolveDefaultLaunchPreset,
  resolveEffectiveTheme,
  savePreferences,
  type WorkspacePreferences,
} from "./preferences-model.js";
import { PreferencesDialog } from "./preferences.js";
import {
  InspectorTabs,
  RepositoryChangesPanel,
  type InspectorTab,
} from "./repository-changes.js";
import {
  IDLE_REPOSITORY_CHANGES,
  acceptRepositoryChangesResponse,
  beginRepositoryChangesRequest,
  interruptRepositoryChangesRequest,
  type RepositoryChangesViewState,
} from "./repository-changes-model.js";
import { RepositoryDiffPanel } from "./repository-diff.js";
import {
  IDLE_REPOSITORY_DIFF,
  acceptRepositoryDiffResponse,
  beginRepositoryDiffRequest,
  interruptRepositoryDiffRequest,
  repositoryDiffKey,
  type RepositoryDiffViewState,
} from "./repository-diff-model.js";
import { RepositoryHistoryPanel } from "./repository-history.js";
import {
  IDLE_REPOSITORY_HISTORY,
  acceptRepositoryHistoryResponse,
  beginRepositoryHistoryRequest,
  interruptRepositoryHistoryRequest,
  type RepositoryHistoryViewState,
} from "./repository-history-model.js";
import { RepositoryVerificationPanel } from "./repository-verification.js";
import {
  acceptVerificationResponse,
  acceptVerificationUpdate,
  beginVerificationAction,
  beginVerificationInspect,
  IDLE_REPOSITORY_VERIFICATION,
  rejectVerificationRequest,
  type RepositoryVerificationViewState,
} from "./repository-verification-model.js";
import { buildRecentActivity } from "./recent-activity-model.js";
import { RecentActivityPanel } from "./recent-activity.js";
import { RepositoryContextCard } from "./repository-context.js";
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
  IDLE_WORKSPACE_MODE_CHORD,
  advanceWorkspaceModeChord,
} from "./workspace-mode-shortcut.js";
import {
  loadWorkspaceMode,
  saveWorkspaceMode,
  type WorkspaceMode,
} from "./workspace-mode.js";
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
  const actionInvokerRef = useRef<HTMLElement | null>(null);
  const createInvokerRef = useRef<HTMLElement | null>(null);
  const paletteInvokerRef = useRef<HTMLElement | null>(null);
  const panelViewRef = useRef<ReturnType<typeof loadPanelView> | null>(null);
  const renameInvokerRef = useRef<HTMLElement | null>(null);
  const roleEditorInvokerRef = useRef<HTMLElement | null>(null);
  const settingsInvokerRef = useRef<HTMLElement | null>(null);
  const transportRef = useRef<PaciumTransport | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() =>
    loadWorkspaceMode(window.localStorage),
  );
  const workspaceModeRef = useRef(workspaceMode);
  const workspaceModeChordRef = useRef(IDLE_WORKSPACE_MODE_CHORD);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() =>
    loadPreferences(window.localStorage),
  );
  const [attentionInbox, setAttentionInbox] = useState<AttentionInboxState>(
    () => loadAttentionInbox(window.localStorage),
  );
  const attentionInboxRef = useRef(attentionInbox);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [pageVisibility, setPageVisibility] = useState<DocumentVisibilityState>(
    () => document.visibilityState,
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [panelView, setPanelView] = useState(() =>
    loadPanelView(window.localStorage, window.innerWidth),
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("overview");
  const [repositoryChangesBySession, setRepositoryChangesBySession] = useState(
    new Map<string, RepositoryChangesViewState>(),
  );
  const repositoryChangesRef = useRef(repositoryChangesBySession);
  const [repositoryDiffByKey, setRepositoryDiffByKey] = useState(
    new Map<string, RepositoryDiffViewState>(),
  );
  const repositoryDiffRef = useRef(repositoryDiffByKey);
  const [selectedDiffPathBySession, setSelectedDiffPathBySession] = useState(
    new Map<string, string>(),
  );
  const [repositoryHistoryBySession, setRepositoryHistoryBySession] = useState(
    new Map<string, RepositoryHistoryViewState>(),
  );
  const repositoryHistoryRef = useRef(repositoryHistoryBySession);
  const [repositoryVerificationBySession, setRepositoryVerificationBySession] =
    useState(new Map<string, RepositoryVerificationViewState>());
  const repositoryVerificationRef = useRef(repositoryVerificationBySession);
  const [paciumConfig, setPaciumConfig] =
    useState<PaciumConfigViewState>(IDLE_PACIUM_CONFIG);
  const paciumConfigRef = useRef(paciumConfig);
  const [paciumPrompt, setPaciumPrompt] =
    useState<PaciumPromptState>(EMPTY_PACIUM_PROMPT);
  const paciumPromptRef = useRef(paciumPrompt);
  const paciumPromptTargetsRef = useRef<PaciumPromptTargetProjection>({
    status: "loading",
    message: "Reading configured prompt targets.",
    targets: [],
  });
  const [paciumQueue, setPaciumQueue] =
    useState<PaciumQueueViewState>(IDLE_PACIUM_QUEUE);
  const paciumQueueRef = useRef(paciumQueue);
  const [editingPaciumRole, setEditingPaciumRole] =
    useState<PaciumRoleId | null>(null);
  const roleSaveRequestRef = useRef<{
    role: PaciumRoleId;
    requestId: string;
  } | null>(null);
  const [pendingPaciumRoleLaunch, setPendingPaciumRoleLaunch] =
    useState<PendingPaciumRoleLaunch | null>(null);
  const pendingPaciumRoleLaunchRef = useRef<PendingPaciumRoleLaunch | null>(
    null,
  );

  panelViewRef.current = panelView;
  selectedIdRef.current = selectedId;
  tabsRef.current = tabs;
  layoutRef.current = layout;
  attentionInboxRef.current = attentionInbox;
  repositoryChangesRef.current = repositoryChangesBySession;
  repositoryDiffRef.current = repositoryDiffByKey;
  repositoryHistoryRef.current = repositoryHistoryBySession;
  repositoryVerificationRef.current = repositoryVerificationBySession;
  paciumConfigRef.current = paciumConfig;
  paciumPromptRef.current = paciumPrompt;
  paciumQueueRef.current = paciumQueue;
  pendingPaciumRoleLaunchRef.current = pendingPaciumRoleLaunch;
  workspaceModeRef.current = workspaceMode;

  const effectiveTheme = resolveEffectiveTheme(
    preferences.theme,
    systemPrefersDark,
  );
  const terminalPreferences = useMemo<TerminalDisplayPreferences>(
    () => ({
      fontFamily: TERMINAL_FONT_STACKS[preferences.terminalFont],
      fontSize: preferences.terminalFontSize,
      lineHeight: preferences.terminalLineHeight,
      scrollback: preferences.terminalScrollback,
      theme: effectiveTheme,
    }),
    [effectiveTheme, preferences],
  );

  const onTransportEvent = useCallback((event: TransportEvent) => {
    if (event.type === "connection") {
      setConnection(event.state);
      if (event.state !== "connected") {
        const pendingRoleLaunch = pendingPaciumRoleLaunchRef.current;
        if (pendingRoleLaunch !== null) {
          pendingPaciumRoleLaunchRef.current = null;
          setPendingPaciumRoleLaunch(null);
          setNotice(
            pendingRoleLaunch.stage === "launching"
              ? `${roleLabel(pendingRoleLaunch.role)} launch outcome is unknown after disconnect. Inspect the refreshed terminal list before retrying.`
              : `The new terminal remains available, but ${roleLabel(pendingRoleLaunch.role)} binding outcome is unknown after disconnect. Fresh configuration will be read before another action.`,
          );
        }
        if (roleSaveRequestRef.current !== null) {
          roleSaveRequestRef.current = null;
          setNotice(
            "Role assignment outcome is unknown after disconnect. The editor remains open and fresh configuration will be read before another save.",
          );
        }
        const interruptedPaciumConfig = interruptPaciumConfigRequest(
          paciumConfigRef.current,
        );
        if (interruptedPaciumConfig !== paciumConfigRef.current) {
          paciumConfigRef.current = interruptedPaciumConfig;
          setPaciumConfig(interruptedPaciumConfig);
        }
        let changed = false;
        const next = new Map(repositoryChangesRef.current);
        for (const [sessionId, state] of next) {
          const interrupted = interruptRepositoryChangesRequest(state);
          if (interrupted !== state) {
            next.set(sessionId, interrupted);
            changed = true;
          }
        }
        if (changed) {
          repositoryChangesRef.current = next;
          setRepositoryChangesBySession(next);
        }
        let diffChanged = false;
        const nextDiffs = new Map(repositoryDiffRef.current);
        for (const [key, state] of nextDiffs) {
          const interrupted = interruptRepositoryDiffRequest(state);
          if (interrupted !== state) {
            nextDiffs.set(key, interrupted);
            diffChanged = true;
          }
        }
        if (diffChanged) {
          repositoryDiffRef.current = nextDiffs;
          setRepositoryDiffByKey(nextDiffs);
        }
        let historyChanged = false;
        const nextHistory = new Map(repositoryHistoryRef.current);
        for (const [sessionId, state] of nextHistory) {
          const interrupted = interruptRepositoryHistoryRequest(state);
          if (interrupted !== state) {
            nextHistory.set(sessionId, interrupted);
            historyChanged = true;
          }
        }
        if (historyChanged) {
          repositoryHistoryRef.current = nextHistory;
          setRepositoryHistoryBySession(nextHistory);
        }
        if (repositoryVerificationRef.current.size > 0) {
          const reset = new Map<string, RepositoryVerificationViewState>();
          repositoryVerificationRef.current = reset;
          setRepositoryVerificationBySession(reset);
        }
        const interruptedPrompt = interruptPaciumPrompt(
          paciumPromptRef.current,
        );
        if (interruptedPrompt !== paciumPromptRef.current) {
          const outcomeUnknown = paciumPromptRef.current.pending !== null;
          paciumPromptRef.current = interruptedPrompt;
          setPaciumPrompt(interruptedPrompt);
          if (outcomeUnknown) {
            setNotice(
              "Prompt delivery outcome is unknown after disconnect. The draft remains, but inspect the target terminal before choosing it again.",
            );
          }
        }
        const interruptedQueue = interruptPaciumQueueRequest(
          paciumQueueRef.current,
        );
        if (interruptedQueue !== paciumQueueRef.current) {
          paciumQueueRef.current = interruptedQueue;
          setPaciumQueue(interruptedQueue);
        }
      }
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
    if (event.type === "pacium.config.requested") {
      const next = beginPaciumConfigRequest(
        paciumConfigRef.current,
        event.requestId,
        event.intent,
      );
      paciumConfigRef.current = next;
      setPaciumConfig(next);
      return;
    }
    if (event.message.type === "command.result") {
      const currentPrompt = paciumPromptRef.current;
      const acceptedPrompt = acceptPaciumPromptResult(
        currentPrompt,
        event.message.requestId,
      );
      if (acceptedPrompt !== currentPrompt) {
        const targetLabel =
          paciumPromptTargetsRef.current.targets.find(
            (target) => target.id === currentPrompt.pending?.targetId,
          )?.label ?? "the selected target";
        paciumPromptRef.current = acceptedPrompt;
        setPaciumPrompt(acceptedPrompt);
        setNotice(
          `Terminal input accepted for ${targetLabel}. Agent handling is not confirmed.`,
        );
      }
      return;
    }
    if (event.message.type === "pacium.queue.sources") {
      const accepted = acceptPaciumQueueResponse(
        paciumQueueRef.current,
        event.message.requestId,
        event.message.observation,
      );
      if (accepted !== paciumQueueRef.current) {
        paciumQueueRef.current = accepted;
        setPaciumQueue(accepted);
      }
      return;
    }
    if (event.message.type === "pacium.queue.sources.updated") {
      const accepted = acceptPaciumQueueUpdate(
        paciumQueueRef.current,
        event.message.observation,
      );
      if (accepted !== paciumQueueRef.current) {
        paciumQueueRef.current = accepted;
        setPaciumQueue(accepted);
      }
      return;
    }
    if (event.message.type === "pacium.config") {
      const accepted = acceptPaciumConfigResponse(
        paciumConfigRef.current,
        event.message.requestId,
        event.message.observation,
      );
      if (accepted !== paciumConfigRef.current) {
        paciumConfigRef.current = accepted;
        setPaciumConfig(accepted);
        const transport = transportRef.current;
        if (transport !== null) {
          const requestId = transport.requestQueueObservation();
          const queueRequest = beginPaciumQueueRequest(
            paciumQueueRef.current,
            requestId,
          );
          paciumQueueRef.current = queueRequest;
          setPaciumQueue(queueRequest);
        }
      }
      const savedRole = roleSaveRequestRef.current;
      if (savedRole?.requestId === event.message.requestId) {
        roleSaveRequestRef.current = null;
        if (event.message.observation.status === "ready") {
          setEditingPaciumRole(null);
          setNotice(`${roleLabel(savedRole.role)} binding saved.`);
          window.requestAnimationFrame(() => {
            roleEditorInvokerRef.current?.focus();
          });
        } else {
          setNotice(
            `${roleLabel(savedRole.role)} binding was not accepted. The editor remains open and terminals are unchanged.`,
          );
        }
      }
      const pendingRoleLaunch = pendingPaciumRoleLaunchRef.current;
      const acceptedRoleBinding =
        pendingRoleLaunch?.stage === "binding" &&
        event.message.observation.status === "ready"
          ? event.message.observation.workspace?.roles[pendingRoleLaunch.role]
          : null;
      const matchingBindingResponse =
        pendingRoleLaunch?.stage === "binding" &&
        pendingRoleLaunch.requestId === event.message.requestId;
      if (
        matchingBindingResponse &&
        acceptedRoleBinding?.type === "session" &&
        acceptedRoleBinding.sessionId === pendingRoleLaunch.sessionId
      ) {
        pendingPaciumRoleLaunchRef.current = null;
        setPendingPaciumRoleLaunch(null);
        setNotice(
          `${roleLabel(pendingRoleLaunch.role)} is bound to the new terminal.`,
        );
      } else if (matchingBindingResponse) {
        pendingPaciumRoleLaunchRef.current = null;
        setPendingPaciumRoleLaunch(null);
        setNotice(
          `The new terminal is running, but ${roleLabel(pendingRoleLaunch.role)} was not bound. Refresh configuration and assign it explicitly.`,
        );
      }
      return;
    }
    if (event.message.type === "session.created") {
      const pendingRoleLaunch = pendingPaciumRoleLaunchRef.current;
      if (
        pendingRoleLaunch?.stage === "launching" &&
        pendingRoleLaunch.requestId === event.message.requestId
      ) {
        const observation = visiblePaciumConfig(paciumConfigRef.current);
        const transport = transportRef.current;
        if (
          observation?.status === "ready" &&
          observation.revision === pendingRoleLaunch.sourceRevision &&
          observation.workspace !== null &&
          transport !== null
        ) {
          const requestId = transport.replacePaciumConfig(
            observation.revision,
            replacePaciumRoleBinding(
              observation.workspace,
              pendingRoleLaunch.role,
              {
                type: "session",
                sessionId: event.message.session.id,
              },
            ),
          );
          const bindingLaunch: PendingPaciumRoleLaunch = {
            ...pendingRoleLaunch,
            requestId,
            stage: "binding",
            sessionId: event.message.session.id,
          };
          pendingPaciumRoleLaunchRef.current = bindingLaunch;
          setPendingPaciumRoleLaunch(bindingLaunch);
        } else {
          pendingPaciumRoleLaunchRef.current = null;
          setPendingPaciumRoleLaunch(null);
          setNotice(
            `${roleLabel(pendingRoleLaunch.role)} terminal started, but the workspace definition changed before it could be bound. The terminal remains available; refresh and bind it explicitly.`,
          );
        }
      }
    }
    if (event.message.type === "repository.changes") {
      const current =
        repositoryChangesRef.current.get(event.message.sessionId) ??
        IDLE_REPOSITORY_CHANGES;
      const accepted = acceptRepositoryChangesResponse(
        current,
        event.message.requestId,
        event.message.observation,
      );
      if (accepted !== current) {
        const next = new Map(repositoryChangesRef.current);
        next.set(event.message.sessionId, accepted);
        repositoryChangesRef.current = next;
        setRepositoryChangesBySession(next);
      }
      return;
    }
    if (event.message.type === "repository.diff") {
      const key = repositoryDiffKey(
        event.message.sessionId,
        event.message.observation.path,
      );
      const current =
        repositoryDiffRef.current.get(key) ?? IDLE_REPOSITORY_DIFF;
      const accepted = acceptRepositoryDiffResponse(
        current,
        event.message.requestId,
        event.message.sessionId,
        event.message.observation,
      );
      if (accepted !== current) {
        const next = new Map(repositoryDiffRef.current);
        next.set(key, accepted);
        repositoryDiffRef.current = next;
        setRepositoryDiffByKey(next);
      }
      return;
    }
    if (event.message.type === "repository.history") {
      const current =
        repositoryHistoryRef.current.get(event.message.sessionId) ??
        IDLE_REPOSITORY_HISTORY;
      const accepted = acceptRepositoryHistoryResponse(
        current,
        event.message.requestId,
        event.message.sessionId,
        event.message.observation,
      );
      if (accepted !== current) {
        const next = new Map(repositoryHistoryRef.current);
        next.set(event.message.sessionId, accepted);
        repositoryHistoryRef.current = next;
        setRepositoryHistoryBySession(next);
      }
      return;
    }
    if (event.message.type === "repository.verification") {
      const current =
        repositoryVerificationRef.current.get(event.message.sessionId) ??
        IDLE_REPOSITORY_VERIFICATION;
      const accepted = acceptVerificationResponse(
        current,
        event.message.requestId,
        event.message.sessionId,
        event.message.observation,
      );
      if (accepted !== current) {
        const next = new Map(repositoryVerificationRef.current);
        next.set(event.message.sessionId, accepted);
        repositoryVerificationRef.current = next;
        setRepositoryVerificationBySession(next);
      }
      return;
    }
    if (event.message.type === "repository.verification.updated") {
      const current =
        repositoryVerificationRef.current.get(event.message.sessionId) ??
        IDLE_REPOSITORY_VERIFICATION;
      const accepted = acceptVerificationUpdate(
        current,
        event.message.sessionId,
        event.message.observation,
      );
      if (accepted !== current) {
        const next = new Map(repositoryVerificationRef.current);
        next.set(event.message.sessionId, accepted);
        repositoryVerificationRef.current = next;
        setRepositoryVerificationBySession(next);
      }
      return;
    }
    if (
      event.message.type === "error" &&
      event.message.requestId !== undefined
    ) {
      const rejectedPrompt = rejectPaciumPromptResult(
        paciumPromptRef.current,
        event.message.requestId,
      );
      if (rejectedPrompt !== paciumPromptRef.current) {
        paciumPromptRef.current = rejectedPrompt;
        setPaciumPrompt(rejectedPrompt);
        setNotice(
          `Prompt was not delivered. ${event.message.message} Pacium did not retry it.`,
        );
        return;
      }
      const interruptedQueue = interruptPaciumQueueRequest(
        paciumQueueRef.current,
        event.message.requestId,
      );
      if (interruptedQueue !== paciumQueueRef.current) {
        paciumQueueRef.current = interruptedQueue;
        setPaciumQueue(interruptedQueue);
        setNotice(
          `Queue source refresh failed. ${event.message.message} Terminals and source files are unchanged.`,
        );
        return;
      }
      const interruptedPaciumConfig = interruptPaciumConfigRequest(
        paciumConfigRef.current,
        event.message.requestId,
      );
      if (interruptedPaciumConfig !== paciumConfigRef.current) {
        paciumConfigRef.current = interruptedPaciumConfig;
        setPaciumConfig(interruptedPaciumConfig);
      }
      const pendingRoleLaunch = pendingPaciumRoleLaunchRef.current;
      if (pendingRoleLaunch?.requestId === event.message.requestId) {
        pendingPaciumRoleLaunchRef.current = null;
        setPendingPaciumRoleLaunch(null);
        setNotice(
          pendingRoleLaunch.stage === "launching"
            ? `${roleLabel(pendingRoleLaunch.role)} terminal was not started. ${event.message.message}`
            : `The new terminal is running, but ${roleLabel(pendingRoleLaunch.role)} was not bound. ${event.message.message}`,
        );
        return;
      }
      const savedRole = roleSaveRequestRef.current;
      if (savedRole?.requestId === event.message.requestId) {
        roleSaveRequestRef.current = null;
        setNotice(
          `${roleLabel(savedRole.role)} binding was not changed. ${event.message.message}`,
        );
        return;
      }
      let changed = false;
      const next = new Map(repositoryVerificationRef.current);
      for (const [sessionId, state] of next) {
        const rejected = rejectVerificationRequest(
          state,
          event.message.requestId,
        );
        if (rejected !== state) {
          next.set(sessionId, rejected);
          changed = true;
        }
      }
      if (changed) {
        repositoryVerificationRef.current = next;
        setRepositoryVerificationBySession(next);
      }
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

  const requestRepositoryChanges = useCallback(
    (sessionId: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Changed-file evidence needs a live Pacium connection. The terminal process is unaffected.",
        );
        return;
      }
      const requestId = transport.requestRepositoryChanges(sessionId);
      const current =
        repositoryChangesRef.current.get(sessionId) ?? IDLE_REPOSITORY_CHANGES;
      const nextState = beginRepositoryChangesRequest(current, requestId);
      const next = new Map(repositoryChangesRef.current);
      next.set(sessionId, nextState);
      repositoryChangesRef.current = next;
      setRepositoryChangesBySession(next);
    },
    [connection],
  );

  const requestRepositoryDiff = useCallback(
    (sessionId: string, path: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "File diff evidence needs a live Pacium connection. The terminal process is unaffected.",
        );
        return;
      }
      const requestId = transport.requestRepositoryDiff(sessionId, path);
      const key = repositoryDiffKey(sessionId, path);
      const current =
        repositoryDiffRef.current.get(key) ?? IDLE_REPOSITORY_DIFF;
      const nextState = beginRepositoryDiffRequest(
        current,
        sessionId,
        path,
        requestId,
      );
      const next = new Map(repositoryDiffRef.current);
      next.set(key, nextState);
      repositoryDiffRef.current = next;
      setRepositoryDiffByKey(next);
    },
    [connection],
  );

  const requestRepositoryHistory = useCallback(
    (sessionId: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Commit history needs a live Pacium connection. The terminal process is unaffected.",
        );
        return;
      }
      const requestId = transport.requestRepositoryHistory(sessionId);
      const current =
        repositoryHistoryRef.current.get(sessionId) ?? IDLE_REPOSITORY_HISTORY;
      const nextState = beginRepositoryHistoryRequest(
        current,
        sessionId,
        requestId,
      );
      const next = new Map(repositoryHistoryRef.current);
      next.set(sessionId, nextState);
      repositoryHistoryRef.current = next;
      setRepositoryHistoryBySession(next);
    },
    [connection],
  );

  const requestRepositoryVerification = useCallback(
    (sessionId: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Verification checks need a live Pacium connection. Running terminals and checks are unaffected.",
        );
        return;
      }
      const requestId = transport.requestRepositoryVerification(sessionId);
      const current =
        repositoryVerificationRef.current.get(sessionId) ??
        IDLE_REPOSITORY_VERIFICATION;
      const nextState = beginVerificationInspect(current, sessionId, requestId);
      const next = new Map(repositoryVerificationRef.current);
      next.set(sessionId, nextState);
      repositoryVerificationRef.current = next;
      setRepositoryVerificationBySession(next);
    },
    [connection],
  );

  const runRepositoryVerification = useCallback(
    (sessionId: string, presetId: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Pacium is disconnected, so no verification process was started.",
        );
        return;
      }
      const current =
        repositoryVerificationRef.current.get(sessionId) ??
        IDLE_REPOSITORY_VERIFICATION;
      if (current.status !== "loaded") {
        setNotice(
          "Refresh configured checks before starting verification. No process was started.",
        );
        return;
      }
      const requestId = transport.runRepositoryVerification(
        sessionId,
        presetId,
      );
      const nextState = beginVerificationAction(
        current,
        sessionId,
        requestId,
        "run",
      );
      const next = new Map(repositoryVerificationRef.current);
      next.set(sessionId, nextState);
      repositoryVerificationRef.current = next;
      setRepositoryVerificationBySession(next);
    },
    [connection],
  );

  const cancelRepositoryVerification = useCallback(
    (sessionId: string, runId: string) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Pacium is disconnected, so cancellation was not requested. The process outcome is unknown.",
        );
        return;
      }
      const current =
        repositoryVerificationRef.current.get(sessionId) ??
        IDLE_REPOSITORY_VERIFICATION;
      if (current.status !== "loaded") {
        setNotice(
          "Refresh the active verification state before cancelling. No signal was sent.",
        );
        return;
      }
      const requestId = transport.cancelRepositoryVerification(
        sessionId,
        runId,
      );
      const nextState = beginVerificationAction(
        current,
        sessionId,
        requestId,
        "cancel",
      );
      const next = new Map(repositoryVerificationRef.current);
      next.set(sessionId, nextState);
      repositoryVerificationRef.current = next;
      setRepositoryVerificationBySession(next);
    },
    [connection],
  );

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
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => {
      setPageVisibility(document.visibilityState);
      if (typeof Notification !== "undefined") {
        setNotificationPermission(Notification.permission);
      }
    };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.density = preferences.density;
  }, [effectiveTheme, preferences.density]);

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
  const selectedRepositoryChanges =
    selectedId === null
      ? IDLE_REPOSITORY_CHANGES
      : (repositoryChangesBySession.get(selectedId) ?? IDLE_REPOSITORY_CHANGES);
  const selectedDiffPath =
    selectedId === null
      ? null
      : (selectedDiffPathBySession.get(selectedId) ?? null);
  const selectedRepositoryDiff =
    selectedId === null || selectedDiffPath === null
      ? IDLE_REPOSITORY_DIFF
      : (repositoryDiffByKey.get(
          repositoryDiffKey(selectedId, selectedDiffPath),
        ) ?? IDLE_REPOSITORY_DIFF);
  const selectedRepositoryHistory =
    selectedId === null
      ? IDLE_REPOSITORY_HISTORY
      : (repositoryHistoryBySession.get(selectedId) ?? IDLE_REPOSITORY_HISTORY);
  const selectedRepositoryVerification =
    selectedId === null
      ? IDLE_REPOSITORY_VERIFICATION
      : (repositoryVerificationBySession.get(selectedId) ??
        IDLE_REPOSITORY_VERIFICATION);

  useEffect(() => {
    if (
      inspectorTab !== "changes" ||
      selectedId === null ||
      connection !== "connected" ||
      selectedRepositoryChanges.status !== "idle"
    ) {
      return;
    }
    requestRepositoryChanges(selectedId);
  }, [
    connection,
    inspectorTab,
    requestRepositoryChanges,
    selectedId,
    selectedRepositoryChanges.status,
  ]);

  useEffect(() => {
    if (
      inspectorTab !== "changes" ||
      selectedId === null ||
      selectedDiffPath === null ||
      connection !== "connected" ||
      selectedRepositoryDiff.status !== "idle"
    ) {
      return;
    }
    requestRepositoryDiff(selectedId, selectedDiffPath);
  }, [
    connection,
    inspectorTab,
    requestRepositoryDiff,
    selectedDiffPath,
    selectedId,
    selectedRepositoryDiff.status,
  ]);

  useEffect(() => {
    if (
      inspectorTab !== "history" ||
      selectedId === null ||
      connection !== "connected" ||
      selectedRepositoryHistory.status !== "idle"
    ) {
      return;
    }
    requestRepositoryHistory(selectedId);
  }, [
    connection,
    inspectorTab,
    requestRepositoryHistory,
    selectedId,
    selectedRepositoryHistory.status,
  ]);

  useEffect(() => {
    if (
      inspectorTab !== "checks" ||
      selectedId === null ||
      connection !== "connected" ||
      selectedRepositoryVerification.status !== "idle"
    ) {
      return;
    }
    requestRepositoryVerification(selectedId);
  }, [
    connection,
    inspectorTab,
    requestRepositoryVerification,
    selectedId,
    selectedRepositoryVerification.status,
  ]);

  useEffect(() => {
    if (
      inspectorTab !== "activity" ||
      selectedId === null ||
      connection !== "connected"
    ) {
      return;
    }
    if (selectedRepositoryChanges.status === "idle") {
      requestRepositoryChanges(selectedId);
    }
    if (selectedRepositoryHistory.status === "idle") {
      requestRepositoryHistory(selectedId);
    }
    if (selectedRepositoryVerification.status === "idle") {
      requestRepositoryVerification(selectedId);
    }
  }, [
    connection,
    inspectorTab,
    requestRepositoryChanges,
    requestRepositoryHistory,
    requestRepositoryVerification,
    selectedId,
    selectedRepositoryChanges.status,
    selectedRepositoryHistory.status,
    selectedRepositoryVerification.status,
  ]);

  const openSelectedRepositoryDiff = useCallback(
    (file: GitChangedFile) => {
      if (selectedId === null) {
        return;
      }
      const previousPath = selectedDiffPathBySession.get(selectedId);
      if (previousPath !== undefined && previousPath !== file.path) {
        const nextDiffs = new Map(repositoryDiffRef.current);
        nextDiffs.delete(repositoryDiffKey(selectedId, previousPath));
        repositoryDiffRef.current = nextDiffs;
        setRepositoryDiffByKey(nextDiffs);
      }
      setSelectedDiffPathBySession((current) => {
        const next = new Map(current);
        next.set(selectedId, file.path);
        return next;
      });
    },
    [selectedDiffPathBySession, selectedId],
  );

  const closeSelectedRepositoryDiff = useCallback(() => {
    if (selectedId === null || selectedDiffPath === null) {
      return;
    }
    const closedSessionId = selectedId;
    const closedPath = selectedDiffPath;
    setSelectedDiffPathBySession((current) => {
      const next = new Map(current);
      next.delete(closedSessionId);
      return next;
    });
    const nextDiffs = new Map(repositoryDiffRef.current);
    nextDiffs.delete(repositoryDiffKey(closedSessionId, closedPath));
    repositoryDiffRef.current = nextDiffs;
    setRepositoryDiffByKey(nextDiffs);
    window.requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLButtonElement>(
        ".changed-file-button",
      );
      for (const row of rows) {
        if (row.dataset.diffPath === closedPath) {
          row.focus();
          break;
        }
      }
    });
  }, [selectedDiffPath, selectedId]);

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
        sidebarOpen: panelView.sidebarOpen,
        inspectorOpen: panelView.inspectorOpen,
        workspaceMode,
      }),
    [layout, panelView, selectedId, sessions, workspaceMode],
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
  const paciumModeSummary = useMemo(
    () => buildPaciumModeSummary(paciumConfig, connection),
    [connection, paciumConfig],
  );
  const paciumRoleModels = useMemo(
    () =>
      buildPaciumRoleModels({
        config: paciumConfig,
        connection,
        sessions,
        launchPresets,
        defaultCwd,
        pendingLaunch: pendingPaciumRoleLaunch,
      }),
    [
      connection,
      defaultCwd,
      launchPresets,
      paciumConfig,
      pendingPaciumRoleLaunch,
      sessions,
    ],
  );
  const paciumPromptTargets = useMemo(
    () =>
      buildPaciumPromptTargets({
        config: paciumConfig,
        connection,
        sessions,
      }),
    [connection, paciumConfig, sessions],
  );
  const paciumQueueProjection = useMemo(
    () =>
      buildPaciumQueueProjection({
        config: paciumConfig,
        queue: paciumQueue,
        connection,
      }),
    [connection, paciumConfig, paciumQueue],
  );
  paciumPromptTargetsRef.current = paciumPromptTargets;
  useEffect(() => {
    const reconciled = reconcilePaciumPromptTarget(
      paciumPromptRef.current,
      paciumPromptTargets,
    );
    if (reconciled !== paciumPromptRef.current) {
      paciumPromptRef.current = reconciled;
      setPaciumPrompt(reconciled);
      setNotice(
        "The selected prompt target is no longer live. The draft remains; choose an available target.",
      );
    }
  }, [paciumPromptTargets]);
  const visiblePaciumObservation = visiblePaciumConfig(paciumConfig);
  const readyPaciumWorkspace =
    visiblePaciumObservation?.status === "ready"
      ? visiblePaciumObservation.workspace
      : null;
  const editingPaciumRoleBinding =
    editingPaciumRole === null
      ? null
      : (readyPaciumWorkspace?.roles[editingPaciumRole] ?? null);
  const paciumRoleBindingOptions = useMemo(
    () =>
      editingPaciumRole === null
        ? null
        : buildPaciumRoleBindingOptions({
            role: editingPaciumRole,
            workspace: readyPaciumWorkspace,
            sessions,
            launchPresets,
          }),
    [editingPaciumRole, launchPresets, readyPaciumWorkspace, sessions],
  );
  const attentionBySession = useMemo(() => {
    const observedAt = new Date().toISOString();
    return new Map(
      sessions.map((session) => [
        session.id,
        deriveProcessAttention(session, observedAt),
      ]),
    );
  }, [sessions]);
  const selectedAttention =
    selectedSession === null
      ? null
      : (attentionBySession.get(selectedSession.id) ?? null);
  const selectedRecentActivity =
    selectedSession === null || selectedAttention === null
      ? null
      : buildRecentActivity({
          session: selectedSession,
          attention: selectedAttention,
          changes: selectedRepositoryChanges,
          history: selectedRepositoryHistory,
          verification: selectedRepositoryVerification,
        });
  const selectedAttentionCursor =
    selectedSession === null
      ? null
      : cursorEntry(attentionInbox, selectedSession.id);
  const selectedAttentionUnread =
    selectedSession !== null &&
    selectedAttention !== null &&
    isAttentionUnread(attentionInbox, selectedSession.id, selectedAttention);
  const persistAttentionInbox = useCallback((next: AttentionInboxState) => {
    attentionInboxRef.current = next;
    setAttentionInbox(next);
    if (!saveAttentionInbox(window.localStorage, next)) {
      setNotice(
        "Attention state is active, but this browser could not save it for refresh.",
      );
    }
  }, []);

  useEffect(() => {
    if (
      selectedId === null ||
      selectedAttention === null ||
      pageVisibility !== "visible" ||
      !isAttentionUnread(
        attentionInboxRef.current,
        selectedId,
        selectedAttention,
      )
    ) {
      return;
    }
    persistAttentionInbox(
      acknowledgeAttention(
        attentionInboxRef.current,
        selectedId,
        selectedAttention,
      ),
    );
  }, [pageVisibility, persistAttentionInbox, selectedAttention, selectedId]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      return;
    }
    let nextInbox = attentionInboxRef.current;
    let delivered = false;
    for (const session of sessions) {
      const attention = attentionBySession.get(session.id);
      if (
        attention === undefined ||
        !shouldDeliverAttentionNotification({
          attention,
          entry: cursorEntry(nextInbox, session.id),
          permission: notificationPermission,
          preference: preferences.notifications,
          visibility: pageVisibility,
        })
      ) {
        continue;
      }
      const content = buildAttentionNotificationContent(session.id, attention);
      if (content === null) {
        continue;
      }
      try {
        const notification = new Notification(content.title, {
          body: content.body,
          silent: true,
          tag: content.tag,
        });
        notification.onclick = () => {
          window.focus();
          selectSession(session.id);
          notification.close();
        };
        nextInbox = markAttentionNotified(nextInbox, session.id, attention);
        delivered = true;
      } catch {
        setNotice(
          "The browser could not show an attention alert. The event remains unread inside Pacium.",
        );
      }
    }
    if (delivered) {
      persistAttentionInbox(nextInbox);
    }
  }, [
    attentionBySession,
    notificationPermission,
    pageVisibility,
    persistAttentionInbox,
    preferences.notifications,
    sessions,
  ]);

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

  const toggleSelectedSessionMuted = () => {
    if (selectedSession === null || selectedAttentionCursor === null) {
      return;
    }
    const muted = !selectedAttentionCursor.muted;
    persistAttentionInbox(
      setSessionMuted(attentionInboxRef.current, selectedSession.id, muted),
    );
    setNotice(
      muted
        ? `${selectedSession.displayName} browser alerts muted. Attention still appears in Pacium.`
        : `${selectedSession.displayName} browser alerts unmuted.`,
    );
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
    closeCreateDialog();
  };

  const openPaciumRoleEditor = (role: PaciumRoleId) => {
    if (pendingPaciumRoleLaunchRef.current !== null) {
      setNotice(
        "Finish the current role launch before changing another binding.",
      );
      return;
    }
    roleEditorInvokerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setCapturedPaneId(null);
    setEditingPaciumRole(role);
  };

  const closePaciumRoleEditor = () => {
    if (roleSaveRequestRef.current !== null) {
      return;
    }
    setEditingPaciumRole(null);
    window.requestAnimationFrame(() => {
      roleEditorInvokerRef.current?.focus();
    });
  };

  const savePaciumRoleBinding = (
    role: PaciumRoleId,
    binding: PaciumBinding,
  ) => {
    const transport = transportRef.current;
    const observation = visiblePaciumConfig(paciumConfigRef.current);
    if (
      connection !== "connected" ||
      transport === null ||
      roleSaveRequestRef.current !== null
    ) {
      setNotice(
        "Reconnect and accept fresh Pacium configuration before saving a role. Terminals are unchanged.",
      );
      return;
    }

    let expectedRevision: number;
    let workspace;
    if (observation?.status === "unconfigured") {
      expectedRevision = 0;
      workspace = createMinimalPaciumWorkspace(role, binding);
    } else if (
      observation?.status === "ready" &&
      observation.revision !== null &&
      observation.workspace !== null
    ) {
      expectedRevision = observation.revision;
      workspace = replacePaciumRoleBinding(
        observation.workspace,
        role,
        binding,
      );
    } else {
      setNotice(
        "Role assignment needs a valid current Pacium definition. Retry configuration first.",
      );
      return;
    }

    const requestId = transport.replacePaciumConfig(
      expectedRevision,
      workspace,
    );
    roleSaveRequestRef.current = { role, requestId };
    setNotice(`Saving ${roleLabel(role)} binding…`);
  };

  const launchPaciumRole = (role: PaciumRoleId) => {
    const transport = transportRef.current;
    const model = paciumRoleModels.find((candidate) => candidate.role === role);
    const observation = visiblePaciumConfig(paciumConfigRef.current);
    if (
      transport === null ||
      connection !== "connected" ||
      pendingPaciumRoleLaunchRef.current !== null ||
      model?.canLaunch !== true ||
      model.launchPreset === null ||
      model.launchCwd === null ||
      observation?.status !== "ready" ||
      observation.revision === null
    ) {
      setNotice(
        `${roleLabel(role)} cannot launch until its fixed preset, working directory, connection, and current config are ready.`,
      );
      return;
    }
    const requestId = transport.createSession({
      cwd: model.launchCwd,
      displayName: roleLabel(role),
      launchPreset: model.launchPreset,
      cols: 100,
      rows: 30,
    });
    const pending: PendingPaciumRoleLaunch = {
      role,
      requestId,
      sourceRevision: observation.revision,
      stage: "launching",
    };
    pendingPaciumRoleLaunchRef.current = pending;
    setPendingPaciumRoleLaunch(pending);
    setNotice(`Starting ${roleLabel(role)} from its fixed preset…`);
  };

  const updatePaciumPromptDraft = (draft: string) => {
    if (paciumPromptRef.current.pending !== null) {
      return;
    }
    const next = { ...paciumPromptRef.current, draft };
    paciumPromptRef.current = next;
    setPaciumPrompt(next);
  };

  const updatePaciumPromptTarget = (targetId: PaciumPromptTargetId | null) => {
    if (paciumPromptRef.current.pending !== null) {
      return;
    }
    const next = { ...paciumPromptRef.current, targetId };
    paciumPromptRef.current = next;
    setPaciumPrompt(next);
  };

  const sendPaciumPrompt = () => {
    const current = paciumPromptRef.current;
    const target = availablePaciumPromptTarget(
      paciumPromptTargetsRef.current,
      current.targetId,
    );
    const terminalInput = paciumPromptTerminalInput(current.draft);
    const transport = transportRef.current;
    if (
      current.pending !== null ||
      target?.sessionId === null ||
      target === null ||
      terminalInput === null ||
      connection !== "connected" ||
      transport === null
    ) {
      setNotice(
        "Choose one live explicit target and enter a valid prompt before sending.",
      );
      return;
    }
    const requestId = transport.input(target.sessionId, terminalInput);
    const next = beginPaciumPromptSend(current, {
      requestId,
      targetId: target.id,
      sessionId: target.sessionId,
    });
    paciumPromptRef.current = next;
    setPaciumPrompt(next);
    setNotice(`Sending terminal input to ${target.label}…`);
  };

  const refreshPaciumQueue = () => {
    const transport = transportRef.current;
    if (
      connection !== "connected" ||
      transport === null ||
      paciumQueueRef.current.requestId !== null
    ) {
      setNotice(
        "Queue source evidence needs a live Pacium connection. Terminals and source files are unchanged.",
      );
      return;
    }
    const requestId = transport.requestQueueObservation();
    const next = beginPaciumQueueRequest(paciumQueueRef.current, requestId);
    paciumQueueRef.current = next;
    setPaciumQueue(next);
  };

  const openCreateDialog = () => {
    createInvokerRef.current = activeControl("new-terminal-trigger");
    setCapturedPaneId(null);
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    restoreControlFocus(createInvokerRef, "new-terminal-trigger");
  };

  const openSessionActions = (sessionId: string) => {
    actionInvokerRef.current = activeControl("session-actions-trigger");
    setCapturedPaneId(null);
    setActionSessionId(sessionId);
  };

  const closeSessionActions = () => {
    setActionSessionId(null);
    restoreControlFocus(actionInvokerRef, "session-actions-trigger");
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
    closeSessionActions();
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
    closeSessionActions();
  };

  const duplicateSession = (session: SessionSummary) => {
    transportRef.current?.createSession(duplicateSessionInput(session));
    setNotice(
      `Starting a duplicate of ${session.displayName}. The original process is unchanged.`,
    );
    closeSessionActions();
  };

  const relaunchSession = (session: SessionSummary) => {
    const input = relaunchSessionInput(session);
    if (input !== null) {
      transportRef.current?.createSession(input);
      setNotice(
        `Starting a new ${session.displayName} process from its retained preset and directory.`,
      );
    }
    closeSessionActions();
  };

  const interruptSession = (session: SessionSummary) => {
    transportRef.current?.interrupt(session.id);
    setNotice(
      `Sent SIGINT to ${session.displayName}. The process may continue running.`,
    );
    closeSessionActions();
  };

  const beginRenameSession = (session: SessionSummary) => {
    renameInvokerRef.current =
      actionSessionId !== null
        ? actionInvokerRef.current
        : paletteView !== null
          ? paletteInvokerRef.current
          : activeControl("session-actions-trigger");
    setRenameSessionId(session.id);
    setActionSessionId(null);
  };

  const closeRenameDialog = () => {
    setRenameSessionId(null);
    restoreControlFocus(renameInvokerRef, "session-actions-trigger");
  };

  const revealSessionRepository = (session: SessionSummary) => {
    transportRef.current?.revealRepository(session.id);
    setNotice(
      `Asked the Pacium host to reveal ${session.repository.name ?? "the repository"}.`,
    );
    closeSessionActions();
  };

  const refreshSelectedRepository = () => {
    if (selectedSession === null) {
      return;
    }
    transportRef.current?.refreshRepository(selectedSession.id);
    setNotice(
      `Refreshing Git evidence for ${selectedSession.displayName}. Its terminal is unchanged.`,
    );
  };

  const openPalette = (view: CommandPaletteView) => {
    paletteInvokerRef.current = activeControl("command-palette-trigger");
    setCapturedPaneId(null);
    setPaletteView(view);
  };

  const closePalette = (restoreFocus = true) => {
    setPaletteView(null);
    if (!restoreFocus) {
      return;
    }
    restoreControlFocus(paletteInvokerRef, "command-palette-trigger");
  };

  const openSettings = () => {
    settingsInvokerRef.current = activeControl("settings-trigger");
    setCapturedPaneId(null);
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    restoreControlFocus(settingsInvokerRef, "settings-trigger");
  };

  const applyPreferences = (next: WorkspacePreferences) => {
    setPreferences(next);
    setSettingsOpen(false);
    restoreControlFocus(settingsInvokerRef, "settings-trigger");
    if (savePreferences(window.localStorage, next)) {
      setNotice("Workspace settings applied and saved in this browser.");
      return;
    }
    setNotice(
      "Workspace settings are active, but this browser could not save them for refresh.",
    );
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      setNotice("This browser does not support local notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotice(
        permission === "granted"
          ? "Browser alerts allowed. Delivery still follows your notification setting."
          : "Browser alerts were not allowed. Pacium will keep attention inside the app.",
      );
    } catch {
      setNotice(
        "The browser could not request notification permission. Pacium will keep attention inside the app.",
      );
    }
  };

  const setPanelVisibility = (next: typeof panelView) => {
    panelViewRef.current = next;
    setPanelView(next);
    if (!savePanelView(window.localStorage, next)) {
      setNotice(
        "Panel visibility changed, but this browser could not save it for refresh.",
      );
    }
  };

  const toggleSidebarPanel = () => {
    setPanelVisibility(toggleSidebar(panelViewRef.current ?? panelView));
  };

  const toggleInspectorPanel = () => {
    setPanelVisibility(toggleInspector(panelViewRef.current ?? panelView));
  };

  const changeWorkspaceMode = useCallback((next: WorkspaceMode) => {
    if (workspaceModeRef.current === next) {
      return;
    }
    workspaceModeRef.current = next;
    setWorkspaceMode(next);
    if (next === "general") {
      paciumPromptRef.current = EMPTY_PACIUM_PROMPT;
      setPaciumPrompt(EMPTY_PACIUM_PROMPT);
    }
    const saved = saveWorkspaceMode(window.localStorage, next);
    setNotice(
      saved
        ? `${next === "pacium" ? "Pacium" : "General"} mode active. Terminal selection and layout are unchanged.`
        : `${next === "pacium" ? "Pacium" : "General"} mode is active for this page, but this browser could not save it for refresh.`,
    );
  }, []);

  const toggleWorkspaceMode = useCallback(() => {
    changeWorkspaceMode(
      workspaceModeRef.current === "pacium" ? "general" : "pacium",
    );
  }, [changeWorkspaceMode]);

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
        openCreateDialog();
        return;
      case "open-settings":
        openSettings();
        return;
      case "toggle-sidebar":
        toggleSidebarPanel();
        return;
      case "toggle-inspector":
        toggleInspectorPanel();
        return;
      case "toggle-workspace-mode":
        toggleWorkspaceMode();
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
    editingPaciumRole !== null ||
    paletteView !== null ||
    settingsOpen;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editable = isEditableTarget(event.target);
      const modeChord = advanceWorkspaceModeChord(
        workspaceModeChordRef.current,
        {
          code: event.code,
          now: performance.now(),
          blocked:
            editable || modalOpen || capturedPaneId !== null || event.repeat,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        },
      );
      workspaceModeChordRef.current = modeChord.state;
      if (modeChord.handled) {
        event.preventDefault();
        if (modeChord.toggle) {
          toggleWorkspaceMode();
        }
        return;
      }

      const shortcut = resolveWorkspaceShortcut({
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        editable,
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
        case "open-settings":
          openSettings();
          return;
        case "toggle-sidebar":
          toggleSidebarPanel();
          return;
        case "toggle-inspector":
          toggleInspectorPanel();
          return;
        case "new-terminal":
          openCreateDialog();
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
  }, [capturedPaneId, modalOpen, tabs, toggleWorkspaceMode]);

  return (
    <div
      className={`app-shell ${
        panelView.sidebarOpen ? "" : "is-sidebar-collapsed"
      } ${panelView.inspectorOpen ? "" : "is-inspector-collapsed"}`}
      data-workspace-mode={workspaceMode}
    >
      <a className="skip-link" href="#primary-workspace">
        Skip to terminal workspace
      </a>
      <button
        aria-label="Close open side panel"
        className="panel-drawer-scrim"
        onClick={() =>
          setPanelVisibility({
            ...panelView,
            sidebarOpen: false,
            inspectorOpen: false,
          })
        }
        type="button"
      />
      <aside
        aria-label="Session navigation"
        className="sidebar"
        id="session-sidebar"
      >
        <header className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <strong>Pacium</strong>
            <span>Control</span>
          </div>
          <button
            aria-label="Close session sidebar"
            className="sidebar-close"
            onClick={toggleSidebarPanel}
            type="button"
          >
            ×
          </button>
        </header>

        <button
          className="new-terminal-button"
          id="new-terminal-trigger"
          onClick={openCreateDialog}
          title="New terminal (Cmd/Ctrl Shift T)"
          type="button"
        >
          <span aria-hidden="true">＋</span>
          New terminal
        </button>

        <nav aria-label="Terminal sessions" className="session-navigation">
          {workspaceMode === "pacium" && (
            <>
              <PaciumModeSummaryCard
                onRetry={() => transportRef.current?.requestPaciumConfig()}
                summary={paciumModeSummary}
              />
              <PaciumRoleGroup
                onConfigure={openPaciumRoleEditor}
                onLaunch={launchPaciumRole}
                onOpen={selectSession}
                onRetry={() => transportRef.current?.requestPaciumConfig()}
                roles={paciumRoleModels}
              />
              <PaciumQueueSources
                onRefresh={refreshPaciumQueue}
                projection={paciumQueueProjection}
              />
            </>
          )}
          <div className="section-heading">
            <span>
              {workspaceMode === "pacium" ? "Pacium sessions" : "Terminals"}
            </span>
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
                    {group.sessions.map((session) => {
                      const attention =
                        attentionBySession.get(session.id) ?? null;
                      const unread =
                        attention !== null &&
                        isAttentionUnread(
                          attentionInbox,
                          session.id,
                          attention,
                        );
                      return (
                        <li key={session.id}>
                          <button
                            aria-label={`${sessionAccessibleName(session)}, attention ${attentionStateLabel(
                              attention?.state ?? "unknown",
                            )}${unread ? ", unread attention" : ""}`}
                            aria-current={
                              session.id === selectedId ? "page" : undefined
                            }
                            className="session-item"
                            onClick={() => selectSession(session.id)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              openSessionActions(session.id);
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
                              <span className="session-name-row">
                                <strong>{session.displayName}</strong>
                                <UnreadAttentionMarker unread={unread} />
                              </span>
                              <span className="session-row-meta">
                                <span className="preset-label">
                                  {session.commandLabel}
                                </span>
                                <span
                                  className={`attention-label attention-${
                                    attention?.state ?? "unknown"
                                  }`}
                                >
                                  {attentionStateLabel(
                                    attention?.state ?? "unknown",
                                  )}
                                </span>
                                <span>{compactPath(session.cwd)}</span>
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="workspace-mode-switch">
            <span id="workspace-mode-label">Workspace mode</span>
            <div
              aria-labelledby="workspace-mode-label"
              className="workspace-mode-options"
              role="group"
            >
              {(["general", "pacium"] as const).map((mode) => (
                <button
                  aria-pressed={workspaceMode === mode}
                  key={mode}
                  onClick={() => changeWorkspaceMode(mode)}
                  type="button"
                >
                  {mode === "general" ? "General" : "Pacium"}
                </button>
              ))}
            </div>
            <small>
              {workspaceMode === "pacium"
                ? "Focused oversight · terminals unchanged"
                : "All terminal sessions"}
            </small>
          </div>
        </div>
      </aside>

      <main
        aria-label="Terminal workspace"
        className="workspace"
        id="primary-workspace"
        tabIndex={-1}
      >
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
            <button
              aria-controls="session-sidebar"
              aria-expanded={panelView.sidebarOpen}
              aria-keyshortcuts="Meta+B Control+B"
              aria-label={`${
                panelView.sidebarOpen ? "Hide" : "Show"
              } session sidebar`}
              className="panel-toggle"
              onClick={toggleSidebarPanel}
              title="Toggle sessions (Cmd/Ctrl B)"
              type="button"
            >
              <span aria-hidden="true">▌</span>
            </button>
            <button
              aria-controls="session-inspector"
              aria-expanded={panelView.inspectorOpen}
              aria-keyshortcuts="Meta+Shift+B Control+Shift+B"
              aria-label={`${panelView.inspectorOpen ? "Hide" : "Show"} inspector`}
              className="panel-toggle"
              onClick={toggleInspectorPanel}
              title="Toggle inspector (Cmd/Ctrl Shift B)"
              type="button"
            >
              <span aria-hidden="true">▐</span>
            </button>
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
              aria-keyshortcuts="Meta+, Control+,"
              aria-label="Open workspace settings"
              id="settings-trigger"
              onClick={openSettings}
              title="Workspace settings (Cmd/Ctrl ,)"
              type="button"
            >
              <span aria-hidden="true">⚙</span>
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
              id="session-actions-trigger"
              onClick={() => {
                if (selectedSession !== null) {
                  openSessionActions(selectedSession.id);
                }
              }}
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
                      openSessionActions(session.id);
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
              onCreate={openCreateDialog}
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
              onOpenActions={openSessionActions}
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
              terminalPreferences={terminalPreferences}
              terminalRefs={terminalRefs}
            />
          )}
        </section>
        {workspaceMode === "pacium" && (
          <PaciumPromptComposer
            onDraftChange={updatePaciumPromptDraft}
            onSend={sendPaciumPrompt}
            onTargetChange={updatePaciumPromptTarget}
            projection={paciumPromptTargets}
            state={paciumPrompt}
          />
        )}
        <WorkspaceStatus
          connection={connection}
          selectedSessionName={selectedSession?.displayName ?? null}
          terminalCaptured={capturedPaneId !== null}
        />
      </main>

      <aside
        aria-label="Session inspector"
        className="inspector"
        id="session-inspector"
      >
        <header>
          <span>Session</span>
          <span>
            <span className="panel-label">Details</span>
            <button
              aria-label="Close inspector"
              className="inspector-close"
              onClick={toggleInspectorPanel}
              type="button"
            >
              ×
            </button>
          </span>
        </header>
        <InspectorTabs active={inspectorTab} onChange={setInspectorTab} />
        {inspectorTab === "overview" ? (
          <div
            aria-labelledby="inspector-overview-tab"
            id="inspector-overview-panel"
            role="tabpanel"
            tabIndex={0}
          >
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
                <Metadata label="Preset">
                  {selectedSession.commandLabel}
                </Metadata>
                <Metadata label="Command">{selectedSession.shell}</Metadata>
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
            <section className="inspector-section repository-section">
              <div className="inspector-section-heading">
                <h2>Repository</h2>
                {selectedSession !== null && (
                  <button
                    disabled={connection !== "connected"}
                    onClick={refreshSelectedRepository}
                    title="Refresh branch, HEAD, and worktree evidence"
                    type="button"
                  >
                    Refresh
                  </button>
                )}
              </div>
              {selectedSession !== null && (
                <RepositoryContextCard
                  repository={selectedSession.repository}
                />
              )}
            </section>
            <section className="inspector-section">
              <h2>Agent evidence</h2>
              {selectedSession !== null && (
                <AgentClassificationCard
                  classification={selectedSession.agentClassification}
                />
              )}
            </section>
            <section className="inspector-section attention-section">
              {selectedAttention !== null &&
                selectedAttentionCursor !== null && (
                  <>
                    <AttentionCursorHeader
                      muted={selectedAttentionCursor.muted}
                      onToggleMuted={toggleSelectedSessionMuted}
                      unread={selectedAttentionUnread}
                    />
                    <AttentionEvidenceCard attention={selectedAttention} />
                  </>
                )}
            </section>
          </div>
        ) : inspectorTab === "changes" ? (
          selectedDiffPath === null ? (
            <RepositoryChangesPanel
              onOpenDiff={openSelectedRepositoryDiff}
              onRefresh={() => {
                if (selectedId !== null) {
                  requestRepositoryChanges(selectedId);
                }
              }}
              repository={selectedSession?.repository ?? null}
              state={selectedRepositoryChanges}
            />
          ) : (
            <RepositoryDiffPanel
              key={repositoryDiffKey(selectedId!, selectedDiffPath)}
              onBack={closeSelectedRepositoryDiff}
              onRefresh={() => {
                if (selectedId !== null) {
                  requestRepositoryDiff(selectedId, selectedDiffPath);
                }
              }}
              state={selectedRepositoryDiff}
            />
          )
        ) : inspectorTab === "history" ? (
          <RepositoryHistoryPanel
            onRefresh={() => {
              if (selectedId !== null) {
                requestRepositoryHistory(selectedId);
              }
            }}
            repository={selectedSession?.repository ?? null}
            state={selectedRepositoryHistory}
          />
        ) : inspectorTab === "checks" ? (
          <RepositoryVerificationPanel
            onCancel={(runId) => {
              if (selectedId !== null) {
                cancelRepositoryVerification(selectedId, runId);
              }
            }}
            onRefresh={() => {
              if (selectedId !== null) {
                requestRepositoryVerification(selectedId);
              }
            }}
            onRun={(presetId) => {
              if (selectedId !== null) {
                runRepositoryVerification(selectedId, presetId);
              }
            }}
            repository={selectedSession?.repository ?? null}
            state={selectedRepositoryVerification}
          />
        ) : (
          <RecentActivityPanel
            activity={selectedRecentActivity}
            onRefresh={() => {
              if (selectedId !== null) {
                requestRepositoryChanges(selectedId);
                requestRepositoryHistory(selectedId);
                requestRepositoryVerification(selectedId);
              }
            }}
          />
        )}
      </aside>

      {createOpen && (
        <CreateTerminalDialog
          defaultCwd={defaultCwd}
          defaultLaunchPreset={resolveDefaultLaunchPreset(
            preferences.defaultLaunchPreset,
            launchPresets,
          )}
          launchPresets={launchPresets}
          loadDirectories={loadDirectories}
          onCancel={closeCreateDialog}
          onCreate={createSession}
        />
      )}
      {editingPaciumRole !== null && paciumRoleBindingOptions !== null && (
        <PaciumRoleBindingDialog
          binding={editingPaciumRoleBinding}
          connected={connection === "connected"}
          key={editingPaciumRole}
          onCancel={closePaciumRoleEditor}
          onSave={(binding) =>
            savePaciumRoleBinding(editingPaciumRole, binding)
          }
          options={paciumRoleBindingOptions}
          role={editingPaciumRole}
          saving={
            roleSaveRequestRef.current?.role === editingPaciumRole &&
            paciumConfig.status === "replacing"
          }
        />
      )}
      {settingsOpen && (
        <PreferencesDialog
          launchPresets={launchPresets}
          notificationPermission={notificationPermission}
          onApply={applyPreferences}
          onCancel={closeSettings}
          onRequestNotificationPermission={() => {
            void requestNotificationPermission();
          }}
          preferences={preferences}
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
          onClose={closeSessionActions}
          onCloseView={() => {
            closeViewTab(actionSession.id);
            closeSessionActions();
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
          onCancel={closeRenameDialog}
          onRename={(displayName) => {
            transportRef.current?.renameSession(renameSession.id, displayName);
            setNotice(`Renaming ${renameSession.displayName}…`);
            closeRenameDialog();
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

export function CreateTerminalDialog({
  defaultCwd,
  defaultLaunchPreset,
  launchPresets,
  loadDirectories,
  onCancel,
  onCreate,
}: {
  defaultCwd: string;
  defaultLaunchPreset: LaunchPresetId;
  launchPresets: LaunchPresetCapability[];
  loadDirectories: (path?: string) => Promise<DirectoryListing>;
  onCancel: () => void;
  onCreate: (input: {
    cwd: string;
    displayName?: string;
    launchPreset: LaunchPresetId;
  }) => void;
}) {
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [cwd, setCwd] = useState(defaultCwd);
  const [displayName, setDisplayName] = useState("");
  const [launchPreset, setLaunchPreset] =
    useState<LaunchPresetId>(defaultLaunchPreset);
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

  const closeDirectoryPicker = () => {
    setPickerOpen(false);
    window.requestAnimationFrame(() => {
      browseButtonRef.current?.focus();
    });
  };

  if (pickerOpen) {
    return (
      <DirectoryPicker
        initialPath={cwd.trim() || defaultCwd}
        loadDirectories={loadDirectories}
        onCancel={closeDirectoryPicker}
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
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
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
              ref={browseButtonRef}
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

export function WorkspaceStatus({
  connection,
  selectedSessionName,
  terminalCaptured,
}: {
  connection: ConnectionState;
  selectedSessionName: string | null;
  terminalCaptured: boolean;
}) {
  return (
    <footer
      aria-atomic="true"
      aria-live="polite"
      className="workspace-status"
      role="status"
    >
      <span>
        {workspaceStatusText({
          connection,
          selectedSessionName,
          terminalCaptured,
        })}
      </span>
      <span>
        {terminalCaptured
          ? "Ctrl+Shift+. returns to application controls"
          : "Click a terminal to enter capture"}
      </span>
    </footer>
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

function activeControl(fallbackId: string): HTMLElement | null {
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement && activeElement !== document.body
    ? activeElement
    : document.getElementById(fallbackId);
}

function restoreControlFocus(
  invokerRef: React.MutableRefObject<HTMLElement | null>,
  fallbackId: string,
): void {
  const target = invokerRef.current;
  window.requestAnimationFrame(() => {
    if (target?.isConnected) {
      target.focus();
      return;
    }
    document.getElementById(fallbackId)?.focus();
  });
}
