import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  TerminalSurface,
  type TerminalDisplayPreferences,
  type TerminalSurfaceHandle,
} from "@pacium/terminal-ui";
import type {
  ConnectionAccess,
  DirectoryListing,
  GitChangedFile,
  LaunchPresetCapability,
  LaunchPresetId,
  MetaSessionCapability,
  QueueSourcesObservation,
  RelaunchManifest,
  ServerMessage,
  SessionSummary,
  TerminalDataFrame,
  TmuxCapability,
  TmuxSessionsObservation,
} from "@pacium/contracts";

import { ConnectionBadge } from "./connection-badge.js";
import {
  PaciumTransport,
  type ConnectionState,
  type TransportEvent,
} from "./transport.js";
import { DirectoryPicker } from "./directory-picker.js";
import { DiagnosticsDialog } from "./diagnostics.js";
import { isDiagnosticsRoute } from "./diagnostics-model.js";
import { handleModalKeyDown } from "./modal-focus.js";
import { initialMetaSessionId } from "./meta-session-focus-model.js";
import { TmuxAttachDialog } from "./tmux-attach-dialog.js";
import {
  attentionSourceLabel,
  attentionStateLabel,
  deriveSessionAttention,
  type AttentionResult,
} from "./attention-model.js";
import {
  IDLE_PACIUM_CONFIG,
  acceptPaciumConfigResponse,
  beginPaciumConfigRequest,
  interruptPaciumConfigRequest,
  visiblePaciumConfig,
  type PaciumConfigViewState,
} from "./pacium-config-model.js";
import {
  TERMINAL_FONT_STACKS,
  loadPreferences,
  resolveDefaultLaunchPreset,
  resolveEffectiveTheme,
  savePreferences,
  type WorkspacePreferences,
} from "./preferences-model.js";
import { PreferencesDialog } from "./preferences.js";
import { RepositoryChangesPanel } from "./repository-changes.js";
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
import { startProviderFreshnessClock } from "./provider-freshness-clock.js";
import {
  RelaunchSessionDialog,
  RenameSessionDialog,
  SessionActionsMenu,
} from "./session-actions.js";
import { duplicateSessionInput } from "./session-actions-model.js";
import { groupSessions, type SessionGroup } from "./session-model.js";
import { RepoDocsPanel } from "./repo-docs-panel.js";
import {
  buildHarnessLoginCommand,
  isValidHarnessTarget,
  loadHarnessTarget,
  saveHarnessTarget,
} from "./harness-model.js";
import {
  INITIAL_TAILSCALE_URL_SCAN,
  scanForTailscaleLoginUrl,
  type TailscaleUrlScan,
} from "./tailscale-login-model.js";
import { HarnessLoginButton, TailscaleLoginBanner } from "./harness-login.js";
import {
  assignRepoRoles,
  isPaciumOrgRepository,
  type RepoRoleAssignment,
} from "./repo-role-model.js";

interface TerminalSync {
  sessionId: string;
  surface: TerminalSurfaceHandle;
  epoch: number | undefined;
  sequence: number;
  snapshotApplied: boolean;
  pending: TerminalDataFrame[];
}

interface HarnessLaunch {
  requestId: string;
  command: string;
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

const INITIAL_TMUX_CAPABILITY: TmuxCapability = {
  state: "unconfigured",
  serverId: null,
  executable: null,
  version: null,
  detail: "Waiting for the local server.",
};

const INITIAL_META_SESSION_CAPABILITY: MetaSessionCapability = {
  state: "unconfigured",
  sessionId: null,
  detail: "Waiting for the local server.",
};

// Injected input is delivered as text first and Enter afterwards: agent TUIs
// (Claude Code, Codex) treat text and Enter arriving in one chunk as a paste
// and leave it sitting in the input box without submitting.
const COMPOSER_ENTER_DELAY_MS = 150;
// A freshly spawned shell needs a moment before injected input survives
// profile startup and line-editor initialisation.
const HARNESS_COMMAND_DELAY_MS = 600;

const SELECTED_SESSION_STORAGE_KEY = "pacium.selectedSession";
const RAIL_OPEN_STORAGE_KEY = "pacium.railOpen";
const FILES_OPEN_STORAGE_KEY = "pacium.filesOpen";

type FilesTab = "files" | "git";
type GitTab = "changes" | "checks";

export function App() {
  const terminalRefs = useRef(new Map<string, TerminalSurfaceHandle>());
  const syncRefs = useRef(new Map<string, TerminalSync>());
  const selectedIdRef = useRef<string | null>(null);
  const transportRef = useRef<PaciumTransport | null>(null);
  const tmuxListRequestRef = useRef<string | null>(null);
  const tmuxAttachRequestRef = useRef<string | null>(null);
  const metaFocusAppliedRef = useRef(false);
  const harnessLaunchRef = useRef<HarnessLaunch | null>(null);
  const tailscaleScansRef = useRef(new Map<string, TailscaleUrlScan>());
  const dismissedTailscaleUrlRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const surfaceRef = useRef<TerminalSurfaceHandle | null>(null);

  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [connectionAccess, setConnectionAccess] =
    useState<ConnectionAccess | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionListReady, setSessionListReady] = useState(false);
  const [relaunchManifests, setRelaunchManifests] = useState<
    RelaunchManifest[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.localStorage.getItem(SELECTED_SESSION_STORAGE_KEY),
  );
  const restoredSelectionRef = useRef<string | null>(
    window.localStorage.getItem(SELECTED_SESSION_STORAGE_KEY),
  );
  const [defaultCwd, setDefaultCwd] = useState("");
  const [launchPresets, setLaunchPresets] = useState(INITIAL_LAUNCH_PRESETS);
  const [tmuxCapability, setTmuxCapability] = useState(INITIAL_TMUX_CAPABILITY);
  const [metaSessionCapability, setMetaSessionCapability] =
    useState<MetaSessionCapability>(INITIAL_META_SESSION_CAPABILITY);
  const [tmuxObservation, setTmuxObservation] =
    useState<TmuxSessionsObservation | null>(null);
  const [tmuxOpen, setTmuxOpen] = useState(false);
  const [tmuxLoading, setTmuxLoading] = useState(false);
  const [tmuxAttaching, setTmuxAttaching] = useState(false);
  const [tmuxError, setTmuxError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(() =>
    isDiagnosticsRoute(window.location.pathname),
  );
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [terminateSessionId, setTerminateSessionId] = useState<string | null>(
    null,
  );
  const [relaunchManifestId, setRelaunchManifestId] = useState<string | null>(
    null,
  );
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() =>
    loadPreferences(window.localStorage),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [railOpen, setRailOpen] = useState(
    () => window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY) !== "closed",
  );
  const [filesOpen, setFilesOpen] = useState(
    () => window.localStorage.getItem(FILES_OPEN_STORAGE_KEY) !== "closed",
  );
  const [filesTab, setFilesTab] = useState<FilesTab>("files");
  const [gitTab, setGitTab] = useState<GitTab>("changes");
  const [providerFreshnessNow, setProviderFreshnessNow] = useState(() =>
    new Date().toISOString(),
  );
  const [captured, setCaptured] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [surfaceTick, setSurfaceTick] = useState(0);
  const [harnessTarget, setHarnessTarget] = useState(() =>
    loadHarnessTarget(window.localStorage),
  );
  const [tailscaleUrl, setTailscaleUrl] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
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
  const [repositoryVerificationBySession, setRepositoryVerificationBySession] =
    useState(new Map<string, RepositoryVerificationViewState>());
  const repositoryVerificationRef = useRef(repositoryVerificationBySession);
  const [paciumConfig, setPaciumConfig] =
    useState<PaciumConfigViewState>(IDLE_PACIUM_CONFIG);
  const paciumConfigRef = useRef(paciumConfig);
  const [queueObservation, setQueueObservation] =
    useState<QueueSourcesObservation | null>(null);

  selectedIdRef.current = selectedId;
  repositoryChangesRef.current = repositoryChangesBySession;
  repositoryDiffRef.current = repositoryDiffByKey;
  repositoryVerificationRef.current = repositoryVerificationBySession;
  paciumConfigRef.current = paciumConfig;

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

  const scanFrameForTailscaleUrl = useCallback((frame: TerminalDataFrame) => {
    const scans = tailscaleScansRef.current;
    if (!scans.has(frame.sessionId) && scans.size >= 16) {
      scans.clear();
    }
    const scan = scans.get(frame.sessionId) ?? INITIAL_TAILSCALE_URL_SCAN;
    const result = scanForTailscaleLoginUrl(scan, frame.data);
    scans.set(frame.sessionId, result.scan);
    if (
      result.url !== null &&
      result.url !== dismissedTailscaleUrlRef.current
    ) {
      setTailscaleUrl(result.url);
    }
  }, []);

  const onTransportEvent = useCallback(
    (event: TransportEvent) => {
      if (event.type === "connection") {
        setConnection(event.state);
        if (event.state === "connected") {
          setApiToken(transportRef.current?.apiAccessToken ?? null);
        }
        if (event.state !== "connected") {
          setConnectionAccess(null);
          if (
            tmuxListRequestRef.current !== null ||
            tmuxAttachRequestRef.current !== null
          ) {
            tmuxListRequestRef.current = null;
            tmuxAttachRequestRef.current = null;
            setTmuxLoading(false);
            setTmuxAttaching(false);
            setTmuxError(
              "The tmux request outcome is unknown after disconnect. Refresh the list before another attachment.",
            );
          }
          if (harnessLaunchRef.current !== null) {
            harnessLaunchRef.current = null;
            setNotice(
              "The harness login terminal outcome is unknown after disconnect. Check the session list before retrying.",
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
          if (repositoryVerificationRef.current.size > 0) {
            const reset = new Map<string, RepositoryVerificationViewState>();
            repositoryVerificationRef.current = reset;
            setRepositoryVerificationBySession(reset);
          }
        }
        return;
      }
      if (event.type === "transport.error") {
        setNotice(event.message);
        return;
      }
      if (event.type === "terminal.data") {
        scanFrameForTailscaleUrl(event.frame);
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
      if (event.type === "pacium.queue.requested") {
        return;
      }
      if (event.message.type === "server.welcome") {
        setConnectionAccess(event.message.connection);
        setMetaSessionCapability(event.message.capabilities.metaSession);
        setTmuxCapability(event.message.capabilities.tmux);
      }
      if (event.message.type === "session.list") {
        setMetaSessionCapability(event.message.metaSession);
      }
      if (
        event.message.type === "tmux.sessions" &&
        event.message.requestId === tmuxListRequestRef.current
      ) {
        tmuxListRequestRef.current = null;
        setTmuxLoading(false);
        setTmuxError(null);
        setTmuxObservation(event.message.observation);
        return;
      }
      if (event.message.type === "session.created") {
        if (event.message.requestId === tmuxAttachRequestRef.current) {
          tmuxAttachRequestRef.current = null;
          setTmuxAttaching(false);
          setTmuxOpen(false);
          setTmuxError(null);
          setNotice(
            `${event.message.session.displayName} attached through tmux. Closing this client will not kill the tmux server session.`,
          );
        }
        const harnessLaunch = harnessLaunchRef.current;
        if (
          harnessLaunch !== null &&
          event.message.requestId === harnessLaunch.requestId
        ) {
          harnessLaunchRef.current = null;
          const harnessSessionId = event.message.session.id;
          window.setTimeout(() => {
            transportRef.current?.input(
              harnessSessionId,
              harnessLaunch.command,
            );
            window.setTimeout(() => {
              transportRef.current?.input(harnessSessionId, "\r");
            }, COMPOSER_ENTER_DELAY_MS);
          }, HARNESS_COMMAND_DELAY_MS);
        }
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
        }
        return;
      }
      if (
        event.message.type === "pacium.queue.sources" ||
        event.message.type === "pacium.queue.sources.updated"
      ) {
        setQueueObservation(event.message.observation);
        return;
      }
      if (
        event.message.type === "pacium.queue.item" ||
        event.message.type === "pacium.queue.decision" ||
        event.message.type === "pacium.queue.delivery" ||
        event.message.type === "pacium.queue.resolution" ||
        event.message.type === "pacium.context"
      ) {
        return;
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
        if (event.message.requestId === tmuxListRequestRef.current) {
          tmuxListRequestRef.current = null;
          setTmuxLoading(false);
          setTmuxError(event.message.message);
          return;
        }
        if (event.message.requestId === tmuxAttachRequestRef.current) {
          tmuxAttachRequestRef.current = null;
          setTmuxAttaching(false);
          setTmuxError(
            `${event.message.message} No attachment was retried automatically.`,
          );
          return;
        }
        if (event.message.requestId === harnessLaunchRef.current?.requestId) {
          harnessLaunchRef.current = null;
          setNotice(
            `The harness login terminal was not started. ${event.message.message}`,
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
        setRelaunchManifests,
        setSelectedId,
        setDefaultCwd,
        setLaunchPresets,
        setNotice,
      );
    },
    [scanFrameForTailscaleUrl],
  );

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

  useEffect(
    () =>
      startProviderFreshnessClock(
        {
          get visibilityState() {
            return document.visibilityState === "visible"
              ? "visible"
              : "hidden";
          },
          setInterval: (handler, timeout) =>
            window.setInterval(handler, timeout),
          clearInterval: (handle) => window.clearInterval(handle),
          addEventListener: (_type, listener) =>
            document.addEventListener("visibilitychange", listener),
          removeEventListener: (_type, listener) =>
            document.removeEventListener("visibilitychange", listener),
        },
        setProviderFreshnessNow,
      ),
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.density = preferences.density;
  }, [effectiveTheme, preferences.density]);

  useEffect(() => {
    if (selectedId === null) {
      window.localStorage.removeItem(SELECTED_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_SESSION_STORAGE_KEY, selectedId);
  }, [selectedId]);

  useEffect(() => {
    window.localStorage.setItem(
      RAIL_OPEN_STORAGE_KEY,
      railOpen ? "open" : "closed",
    );
  }, [railOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      FILES_OPEN_STORAGE_KEY,
      filesOpen ? "open" : "closed",
    );
  }, [filesOpen]);

  useEffect(() => {
    if (!sessionListReady) {
      return;
    }
    const sessionId = initialMetaSessionId({
      applied: metaFocusAppliedRef.current,
      capability: metaSessionCapability,
      sessions,
    });
    if (sessionId === null) {
      return;
    }
    metaFocusAppliedRef.current = true;
    // A selection restored from the previous visit wins over Meta auto-focus;
    // stealing it on reload would detach the terminal the operator was using.
    const restored = restoredSelectionRef.current;
    if (restored !== null && sessions.some(({ id }) => id === restored)) {
      return;
    }
    setSelectedId(sessionId);
  }, [metaSessionCapability, sessionListReady, sessions]);

  // The terminal surface remounts per selection (keyed below); attach exactly
  // once per (connection, session, mounted surface) combination.
  useEffect(() => {
    if (connection !== "connected") {
      syncRefs.current.clear();
      return;
    }
    if (selectedId === null) {
      return;
    }
    const surface = surfaceRef.current;
    if (surface === null) {
      return;
    }
    for (const sessionId of syncRefs.current.keys()) {
      if (sessionId !== selectedId) {
        syncRefs.current.delete(sessionId);
      }
    }
    terminalRefs.current.clear();
    terminalRefs.current.set(selectedId, surface);
    const existing = syncRefs.current.get(selectedId);
    if (existing?.surface === surface) {
      return;
    }
    syncRefs.current.set(selectedId, {
      sessionId: selectedId,
      surface,
      epoch: undefined,
      sequence: 0,
      snapshotApplied: false,
      pending: [],
    });
    surface.clear();
    transportRef.current?.attach(selectedId);
  }, [connection, selectedId, surfaceTick]);

  // Escape chord: leave terminal capture without touching the process.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === ".") {
        event.preventDefault();
        surfaceRef.current?.blur();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessions],
  );
  const sessionGroups = useMemo(() => groupSessions(sessions), [sessions]);
  const configWorkspace = visiblePaciumConfig(paciumConfig)?.workspace ?? null;
  const configBindings = useMemo(() => {
    const roles = configWorkspace?.roles;
    return {
      meta: roles?.meta?.type === "session" ? roles.meta.sessionId : null,
      orchestrator:
        roles?.orchestrator?.type === "session"
          ? roles.orchestrator.sessionId
          : null,
    };
  }, [configWorkspace]);
  const roleAssignments = useMemo(() => {
    const assignments = new Map<string, RepoRoleAssignment>();
    for (const group of sessionGroups) {
      if (group.kind !== "repository") {
        continue;
      }
      const root = group.sessions[0]?.repository.root ?? null;
      if (root === null || !isPaciumOrgRepository(root)) {
        continue;
      }
      assignments.set(
        group.key,
        assignRepoRoles(group.sessions, configBindings),
      );
    }
    return assignments;
  }, [configBindings, sessionGroups]);
  const attentionBySession = useMemo(() => {
    const map = new Map<string, AttentionResult>();
    for (const session of sessions) {
      map.set(
        session.id,
        deriveSessionAttention(session, providerFreshnessNow),
      );
    }
    return map;
  }, [providerFreshnessNow, sessions]);
  const queueAttentionRoots = useMemo(() => {
    const roots = new Set<string>();
    if (queueObservation === null || configWorkspace === null) {
      return roots;
    }
    const pathsBySource = new Map(
      configWorkspace.queueSources.map((source) => [source.id, source.path]),
    );
    for (const source of queueObservation.sources) {
      if (source.classification?.status !== "candidate") {
        continue;
      }
      const path = pathsBySource.get(source.sourceId);
      if (path === undefined) {
        continue;
      }
      for (const repository of configWorkspace.repositories) {
        if (path.startsWith(`${repository.root}/`)) {
          roots.add(repository.root);
        }
      }
    }
    return roots;
  }, [configWorkspace, queueObservation]);

  const selectedRepositoryRoot =
    selectedSession?.repository.status === "ready"
      ? selectedSession.repository.root
      : null;
  const selectedRepositoryName =
    selectedSession?.repository.status === "ready"
      ? selectedSession.repository.name
      : null;
  const selectedRole = useMemo(() => {
    if (selectedSession === null) {
      return null;
    }
    for (const assignment of roleAssignments.values()) {
      if (assignment.meta?.id === selectedSession.id) {
        return "meta" as const;
      }
      if (assignment.orchestrator?.id === selectedSession.id) {
        return "orchestrator" as const;
      }
    }
    return null;
  }, [roleAssignments, selectedSession]);

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
  const selectedRepositoryVerification =
    selectedId === null
      ? IDLE_REPOSITORY_VERIFICATION
      : (repositoryVerificationBySession.get(selectedId) ??
        IDLE_REPOSITORY_VERIFICATION);

  useEffect(() => {
    if (
      !filesOpen ||
      filesTab !== "git" ||
      gitTab !== "changes" ||
      selectedId === null ||
      connection !== "connected" ||
      selectedRepositoryChanges.status !== "idle"
    ) {
      return;
    }
    requestRepositoryChanges(selectedId);
  }, [
    connection,
    filesOpen,
    filesTab,
    gitTab,
    requestRepositoryChanges,
    selectedId,
    selectedRepositoryChanges.status,
  ]);

  useEffect(() => {
    if (
      !filesOpen ||
      filesTab !== "git" ||
      gitTab !== "changes" ||
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
    filesOpen,
    filesTab,
    gitTab,
    requestRepositoryDiff,
    selectedDiffPath,
    selectedId,
    selectedRepositoryDiff.status,
  ]);

  useEffect(() => {
    if (
      !filesOpen ||
      filesTab !== "git" ||
      gitTab !== "checks" ||
      selectedId === null ||
      connection !== "connected" ||
      selectedRepositoryVerification.status !== "idle"
    ) {
      return;
    }
    requestRepositoryVerification(selectedId);
  }, [
    connection,
    filesOpen,
    filesTab,
    gitTab,
    requestRepositoryVerification,
    selectedId,
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
  }, [selectedDiffPath, selectedId]);

  const handleSurfaceRef = useCallback(
    (handle: TerminalSurfaceHandle | null) => {
      surfaceRef.current = handle;
      if (handle !== null) {
        setSurfaceTick((tick) => tick + 1);
      }
    },
    [],
  );

  const handleSelect = useCallback((sessionId: string) => {
    setSelectedId(sessionId);
  }, []);

  const handleCreate = useCallback(
    (input: {
      cwd: string;
      displayName?: string;
      launchPreset: LaunchPresetId;
      keepAlive?: boolean;
    }) => {
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice("Pacium is disconnected, so no terminal was started.");
        return;
      }
      transport.createSession({ ...input, cols: 120, rows: 32 });
      setCreateOpen(false);
    },
    [connection],
  );

  const closeCreateDialog = useCallback(() => {
    setCreateOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("new-terminal-trigger")?.focus();
    });
  }, []);

  const handleComposerSend = useCallback(() => {
    const transport = transportRef.current;
    const text = composerText.replace(/\r\n/g, "\n").replace(/\n$/, "");
    if (
      text.trim().length === 0 ||
      transport === null ||
      connection !== "connected" ||
      selectedId === null
    ) {
      return;
    }
    const sessionId = selectedId;
    transport.input(sessionId, composerTextPayload(text));
    // Agent TUIs treat text and Enter arriving in one chunk as a paste and
    // never submit; a separate Enter keystroke after a beat submits reliably.
    window.setTimeout(() => {
      transportRef.current?.input(sessionId, "\r");
    }, COMPOSER_ENTER_DELAY_MS);
    setComposerText("");
    composerRef.current?.focus();
  }, [composerText, connection, selectedId]);

  const handleComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleComposerSend();
    },
    [handleComposerSend],
  );

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleComposerSend();
      }
    },
    [handleComposerSend],
  );

  const handleHarnessConnect = useCallback(
    (target: string) => {
      if (!isValidHarnessTarget(target)) {
        return;
      }
      saveHarnessTarget(window.localStorage, target);
      setHarnessTarget(target);
      const transport = transportRef.current;
      if (connection !== "connected" || transport === null) {
        setNotice(
          "Pacium is disconnected, so the harness login terminal was not started.",
        );
        return;
      }
      dismissedTailscaleUrlRef.current = null;
      const command = buildHarnessLoginCommand(target);
      const requestId = transport.createSession({
        cwd: defaultCwd || "/",
        launchPreset: "shell",
        displayName: `Harness · ${target}`,
        cols: 120,
        rows: 32,
      });
      harnessLaunchRef.current = { requestId, command };
    },
    [connection, defaultCwd],
  );

  const handleTailscaleDismiss = useCallback(() => {
    dismissedTailscaleUrlRef.current = tailscaleUrl;
    setTailscaleUrl(null);
  }, [tailscaleUrl]);

  const openTmuxDialog = useCallback(() => {
    setTmuxOpen(true);
    setTmuxError(null);
    const transport = transportRef.current;
    if (connection !== "connected" || transport === null) {
      setTmuxError("Pacium is disconnected. tmux sessions cannot be listed.");
      return;
    }
    setTmuxLoading(true);
    tmuxListRequestRef.current = transport.listTmuxSessions();
  }, [connection]);

  const refreshTmuxSessions = useCallback(() => {
    const transport = transportRef.current;
    if (connection !== "connected" || transport === null) {
      setTmuxError("Pacium is disconnected. tmux sessions cannot be listed.");
      return;
    }
    setTmuxError(null);
    setTmuxLoading(true);
    tmuxListRequestRef.current = transport.listTmuxSessions();
  }, [connection]);

  const actionSession =
    sessions.find(({ id }) => id === actionSessionId) ?? null;
  const renameSession =
    sessions.find(({ id }) => id === renameSessionId) ?? null;
  const terminateSession =
    sessions.find(({ id }) => id === terminateSessionId) ?? null;
  const relaunchManifest =
    relaunchManifests.find(({ id }) => id === relaunchManifestId) ?? null;

  const selectedAttention =
    selectedSession === null
      ? null
      : (attentionBySession.get(selectedSession.id) ?? null);
  const liveSelected =
    selectedSession !== null && selectedSession.processState === "live";
  const composerPlaceholder =
    selectedRole === "meta"
      ? "Message Meta — Enter sends, Shift+Enter for a new line"
      : selectedSession === null
        ? "Select a session to talk to it"
        : `Send to ${selectedSession.displayName}`;

  return (
    <div
      className={`shell ${railOpen ? "" : "is-rail-closed"} ${
        filesOpen ? "" : "is-files-closed"
      }`}
    >
      <a className="skip-link" href="#shell-terminal">
        Skip to terminal
      </a>
      {railOpen && (
        <aside aria-label="Repositories and sessions" className="rail">
          <div className="rail-brand">
            <span className="rail-brand-name">Pacium</span>
            <button
              aria-label="New terminal"
              className="rail-new-button"
              id="new-terminal-trigger"
              onClick={() => setCreateOpen(true)}
              title="New terminal"
              type="button"
            >
              +
            </button>
          </div>
          <nav aria-label="Sessions by repository" className="rail-groups">
            {sessionGroups.length === 0 && (
              <p className="rail-empty">
                No sessions yet. Open a terminal to get started.
              </p>
            )}
            {sessionGroups.map((group) => (
              <RepoGroup
                assignment={
                  group.kind === "repository"
                    ? (roleAssignments.get(group.key) ?? null)
                    : null
                }
                attentionBySession={attentionBySession}
                group={group}
                key={group.key}
                onOpenActions={setActionSessionId}
                onSelect={handleSelect}
                queueAttention={
                  group.kind === "repository" &&
                  queueAttentionRoots.has(
                    group.sessions[0]?.repository.root ?? "",
                  )
                }
                selectedId={selectedId}
              />
            ))}
          </nav>
          <div className="rail-footer">
            {tmuxCapability.state === "ready" && (
              <button
                className="rail-footer-button"
                id="attach-tmux-trigger"
                onClick={openTmuxDialog}
                type="button"
              >
                Attach tmux
              </button>
            )}
            <button
              className="rail-footer-button"
              onClick={() => setSettingsOpen(true)}
              type="button"
            >
              Settings
            </button>
            <button
              className="rail-footer-button"
              onClick={() => setDiagnosticsOpen(true)}
              type="button"
            >
              Diagnostics
            </button>
          </div>
        </aside>
      )}
      <main className="stage">
        <header className="stage-header">
          <button
            aria-expanded={railOpen}
            aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
            className="stage-toggle"
            onClick={() => setRailOpen((open) => !open)}
            type="button"
          >
            ☰
          </button>
          <div className="stage-title">
            <h1>
              {selectedSession === null
                ? "Pacium"
                : sessionTitle(selectedSession, selectedRole)}
            </h1>
            {selectedSession !== null && selectedAttention !== null && (
              <span
                className={`stage-status attention-${selectedAttention.state}`}
              >
                <span
                  aria-hidden="true"
                  className={`status-dot state-${statusDotState(
                    selectedSession,
                    selectedAttention,
                  )}`}
                />
                {statusLine(selectedSession, selectedAttention)}
              </span>
            )}
          </div>
          <div className="stage-actions">
            <ConnectionBadge access={connectionAccess} state={connection} />
            <HarnessLoginButton
              disabled={connection !== "connected"}
              onConnect={handleHarnessConnect}
              onTargetChange={setHarnessTarget}
              target={harnessTarget}
            />
            <button
              aria-expanded={filesOpen}
              aria-label={filesOpen ? "Hide files panel" : "Show files panel"}
              className="stage-toggle"
              onClick={() => setFilesOpen((open) => !open)}
              type="button"
            >
              ☷
            </button>
          </div>
        </header>
        {tailscaleUrl !== null && (
          <TailscaleLoginBanner
            onDismiss={handleTailscaleDismiss}
            url={tailscaleUrl}
          />
        )}
        {notice !== null && (
          <div className="notice-bar" role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notice"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        )}
        <section className="stage-terminal" id="shell-terminal">
          {selectedSession === null ? (
            <div className="stage-empty">
              <div className="stage-empty-glyph" aria-hidden="true">
                &gt;_
              </div>
              <h2>
                {sessions.length > 0
                  ? "Pick a session from the sidebar"
                  : "Your workspace is ready"}
              </h2>
              <p>
                {sessions.length > 0
                  ? "Sessions keep running while unselected. Selecting one reconnects to its live screen."
                  : "Open a terminal for a repository. Refreshing the browser reconnects to the same process."}
              </p>
              <button
                className="primary-button"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                Open a terminal
              </button>
            </div>
          ) : (
            <TerminalSurface
              ariaLabel={`Terminal for ${selectedSession.displayName}`}
              key={`${selectedSession.id}:${selectedSession.epoch}`}
              onCaptureChange={setCaptured}
              onInput={(data) => {
                if (connection === "connected" && selectedId !== null) {
                  transportRef.current?.input(selectedId, data);
                }
              }}
              onResize={(cols, rows) => {
                if (connection === "connected" && selectedId !== null) {
                  transportRef.current?.resize(selectedId, cols, rows);
                }
              }}
              preferences={terminalPreferences}
              ref={handleSurfaceRef}
            />
          )}
        </section>
        {selectedSession !== null && (
          <form
            className={`composer ${selectedRole === "meta" ? "is-meta" : ""}`}
            onSubmit={handleComposerSubmit}
          >
            <textarea
              aria-label={composerPlaceholder}
              disabled={!liveSelected || connection !== "connected"}
              onChange={(event) => setComposerText(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                liveSelected
                  ? composerPlaceholder
                  : "This session has ended. Relaunch it from its row menu."
              }
              ref={composerRef}
              rows={composerText.includes("\n") ? 3 : 1}
              value={composerText}
            />
            <button
              className="composer-send"
              disabled={
                !liveSelected ||
                connection !== "connected" ||
                composerText.trim().length === 0
              }
              type="submit"
            >
              Send
            </button>
          </form>
        )}
        <footer className="stage-footer" role="status">
          <span>
            {connection === "connected"
              ? captured
                ? "Terminal captures keys · Ctrl+Shift+. returns to the app"
                : "Click the terminal to type into it directly"
              : connection === "reconnecting"
                ? "Reconnecting to Pacium — terminals keep running"
                : connection === "connecting"
                  ? "Connecting to Pacium…"
                  : "Disconnected — terminals keep running on the host"}
          </span>
          {selectedSession !== null && (
            <span className="stage-footer-path">{selectedSession.cwd}</span>
          )}
        </footer>
      </main>
      {filesOpen && (
        <aside aria-label="Repository files and git" className="files">
          <div className="files-tabs" role="tablist">
            <button
              aria-selected={filesTab === "files"}
              className={filesTab === "files" ? "is-active" : ""}
              onClick={() => setFilesTab("files")}
              role="tab"
              type="button"
            >
              Files
            </button>
            <button
              aria-selected={filesTab === "git"}
              className={filesTab === "git" ? "is-active" : ""}
              onClick={() => setFilesTab("git")}
              role="tab"
              type="button"
            >
              Git
            </button>
          </div>
          <div className="files-body">
            {filesTab === "files" ? (
              selectedRepositoryRoot === null ? (
                <p className="files-hint">
                  {selectedSession === null
                    ? "Select a session to see its repository files."
                    : "This session is not inside a git repository, so there are no agent files to show."}
                </p>
              ) : (
                <RepoDocsPanel
                  accessToken={apiToken}
                  key={selectedRepositoryRoot}
                  repositoryName={selectedRepositoryName ?? ""}
                  root={selectedRepositoryRoot}
                />
              )
            ) : selectedSession === null ? (
              <p className="files-hint">
                Select a session to inspect its repository.
              </p>
            ) : (
              <div className="git-panel">
                <div className="git-subtabs" role="tablist">
                  <button
                    aria-selected={gitTab === "changes"}
                    className={gitTab === "changes" ? "is-active" : ""}
                    onClick={() => setGitTab("changes")}
                    role="tab"
                    type="button"
                  >
                    Changes
                  </button>
                  <button
                    aria-selected={gitTab === "checks"}
                    className={gitTab === "checks" ? "is-active" : ""}
                    onClick={() => setGitTab("checks")}
                    role="tab"
                    type="button"
                  >
                    Checks
                  </button>
                </div>
                {gitTab === "changes" ? (
                  selectedDiffPath !== null ? (
                    <RepositoryDiffPanel
                      onBack={closeSelectedRepositoryDiff}
                      onRefresh={() => {
                        if (selectedId !== null && selectedDiffPath !== null) {
                          requestRepositoryDiff(selectedId, selectedDiffPath);
                        }
                      }}
                      state={selectedRepositoryDiff}
                    />
                  ) : (
                    <RepositoryChangesPanel
                      onOpenDiff={openSelectedRepositoryDiff}
                      onRefresh={() => {
                        if (selectedId !== null) {
                          requestRepositoryChanges(selectedId);
                        }
                      }}
                      repository={selectedSession.repository}
                      state={selectedRepositoryChanges}
                    />
                  )
                ) : (
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
                    repository={selectedSession.repository}
                    state={selectedRepositoryVerification}
                  />
                )}
              </div>
            )}
          </div>
        </aside>
      )}
      {createOpen && (
        <CreateTerminalDialog
          defaultCwd={defaultCwd}
          defaultLaunchPreset={resolveDefaultLaunchPreset(
            preferences.defaultLaunchPreset,
            launchPresets,
          )}
          launchPresets={launchPresets}
          loadDirectories={(path) =>
            transportRef.current === null
              ? Promise.reject(new Error("Pacium is disconnected."))
              : transportRef.current.listDirectories(path)
          }
          onCancel={closeCreateDialog}
          onCreate={handleCreate}
          tmuxCapability={tmuxCapability}
        />
      )}
      {tmuxOpen && (
        <TmuxAttachDialog
          attaching={tmuxAttaching}
          capability={tmuxCapability}
          connected={connection === "connected"}
          error={tmuxError}
          loading={tmuxLoading}
          observation={tmuxObservation}
          onAttach={(target) => {
            const transport = transportRef.current;
            if (connection !== "connected" || transport === null) {
              setTmuxError(
                "Pacium is disconnected. No attachment was requested.",
              );
              return;
            }
            setTmuxAttaching(true);
            tmuxAttachRequestRef.current = transport.attachTmux(
              target.serverId,
              target.sessionId,
              120,
              32,
            );
          }}
          onCancel={() => setTmuxOpen(false)}
          onRefresh={refreshTmuxSessions}
        />
      )}
      {settingsOpen && (
        <PreferencesDialog
          applyHostSetup={(tmuxSessionId) =>
            transportRef.current === null
              ? Promise.reject(new Error("Pacium is disconnected."))
              : transportRef.current.applyHostSetup(tmuxSessionId)
          }
          hostSetupLocal={connectionAccess?.kind === "local"}
          launchPresets={launchPresets}
          loadHostSetup={() =>
            transportRef.current === null
              ? Promise.reject(new Error("Pacium is disconnected."))
              : transportRef.current.getHostSetup()
          }
          notificationPermission={notificationPermission}
          onApply={(next) => {
            setPreferences(next);
            savePreferences(window.localStorage, next);
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
          onRequestNotificationPermission={() => {
            if (typeof Notification !== "undefined") {
              void Notification.requestPermission().then((permission) => {
                setNotificationPermission(permission);
              });
            }
          }}
          preferences={preferences}
        />
      )}
      {diagnosticsOpen && (
        <DiagnosticsDialog
          connection={connection}
          load={() =>
            transportRef.current === null
              ? Promise.reject(new Error("Pacium is disconnected."))
              : transportRef.current.getDiagnostics()
          }
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
      {actionSession !== null && (
        <SessionActionsMenu
          onClose={() => setActionSessionId(null)}
          onCloseView={() => {
            setActionSessionId(null);
            if (selectedId === actionSession.id) {
              setSelectedId(null);
            }
          }}
          onCopyDirectory={() => {
            void navigator.clipboard?.writeText(actionSession.cwd);
            setActionSessionId(null);
          }}
          onDuplicate={() => {
            setActionSessionId(null);
            const transport = transportRef.current;
            if (connection !== "connected" || transport === null) {
              setNotice("Pacium is disconnected, so no terminal was started.");
              return;
            }
            transport.createSession({
              ...duplicateSessionInput(actionSession),
              cols: 120,
              rows: 32,
            });
          }}
          onInterrupt={() => {
            transportRef.current?.interrupt(actionSession.id);
            setActionSessionId(null);
          }}
          onRelaunch={() => {
            setActionSessionId(null);
            const manifest = relaunchManifests.find(
              ({ sessionId }) => sessionId === actionSession.id,
            );
            if (manifest === undefined) {
              setNotice(
                "No relaunch manifest exists for this session yet, so nothing was restarted.",
              );
              return;
            }
            setRelaunchManifestId(manifest.id);
          }}
          onRename={() => {
            setActionSessionId(null);
            setRenameSessionId(actionSession.id);
          }}
          onRevealRepository={() => {
            transportRef.current?.revealRepository(actionSession.id);
            setActionSessionId(null);
          }}
          onTerminate={() => {
            setActionSessionId(null);
            setTerminateSessionId(actionSession.id);
          }}
          session={actionSession}
        />
      )}
      {terminateSession !== null && (
        <TerminateSessionDialog
          onCancel={() => setTerminateSessionId(null)}
          onConfirm={() => {
            transportRef.current?.closeSession(
              terminateSession.id,
              terminateSession.processState === "live" ||
                terminateSession.processState === "closing",
            );
            setTerminateSessionId(null);
          }}
          session={terminateSession}
        />
      )}
      {renameSession !== null && (
        <RenameSessionDialog
          onCancel={() => setRenameSessionId(null)}
          onRename={(displayName) => {
            transportRef.current?.renameSession(renameSession.id, displayName);
            setRenameSessionId(null);
          }}
          session={renameSession}
        />
      )}
      {relaunchManifest !== null && (
        <RelaunchSessionDialog
          connected={connection === "connected"}
          manifest={relaunchManifest}
          onCancel={() => setRelaunchManifestId(null)}
          onConfirm={() => {
            transportRef.current?.relaunch(relaunchManifest.id, 120, 32);
            setRelaunchManifestId(null);
          }}
        />
      )}
    </div>
  );
}

function RepoGroup({
  assignment,
  attentionBySession,
  group,
  onOpenActions,
  onSelect,
  queueAttention,
  selectedId,
}: {
  assignment: RepoRoleAssignment | null;
  attentionBySession: Map<string, AttentionResult>;
  group: SessionGroup;
  onOpenActions: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  queueAttention: boolean;
  selectedId: string | null;
}) {
  const needsInput = group.sessions.some(
    (session) => attentionBySession.get(session.id)?.state === "needs_input",
  );
  return (
    <section className="rail-repo">
      <header className="rail-repo-header">
        <span className="rail-repo-name">{group.label}</span>
        {(needsInput || queueAttention) && (
          <span className="rail-repo-flag" title="Needs your attention">
            needs you
          </span>
        )}
      </header>
      {assignment !== null ? (
        <>
          <RoleRow
            attention={
              assignment.meta === null
                ? null
                : (attentionBySession.get(assignment.meta.id) ?? null)
            }
            label="Meta"
            glyph="◆"
            onOpenActions={onOpenActions}
            onSelect={onSelect}
            selected={
              assignment.meta !== null && assignment.meta.id === selectedId
            }
            session={assignment.meta}
            source={assignment.metaSource}
          />
          <RoleRow
            attention={
              assignment.orchestrator === null
                ? null
                : (attentionBySession.get(assignment.orchestrator.id) ?? null)
            }
            label="Orchestrator"
            glyph="●"
            onOpenActions={onOpenActions}
            onSelect={onSelect}
            selected={
              assignment.orchestrator !== null &&
              assignment.orchestrator.id === selectedId
            }
            session={assignment.orchestrator}
            source={assignment.orchestratorSource}
          />
          {assignment.others.map((session) => (
            <SessionRow
              attention={attentionBySession.get(session.id) ?? null}
              key={session.id}
              onOpenActions={onOpenActions}
              onSelect={onSelect}
              selected={session.id === selectedId}
              session={session}
            />
          ))}
        </>
      ) : (
        group.sessions.map((session) => (
          <SessionRow
            attention={attentionBySession.get(session.id) ?? null}
            key={session.id}
            onOpenActions={onOpenActions}
            onSelect={onSelect}
            selected={session.id === selectedId}
            session={session}
          />
        ))
      )}
    </section>
  );
}

function RoleRow({
  attention,
  glyph,
  label,
  onOpenActions,
  onSelect,
  selected,
  session,
  source,
}: {
  attention: AttentionResult | null;
  glyph: string;
  label: string;
  onOpenActions: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  selected: boolean;
  session: SessionSummary | null;
  source: "config" | "name" | null;
}) {
  if (session === null) {
    return (
      <div className="role-row is-absent">
        <span aria-hidden="true" className="role-glyph">
          {glyph}
        </span>
        <span className="role-label">{label}</span>
        <span className="role-absent">not running</span>
      </div>
    );
  }
  const needsInput = attention?.state === "needs_input";
  return (
    <div
      className={`role-row ${selected ? "is-selected" : ""} ${
        needsInput ? "is-needs-input" : ""
      }`}
    >
      <button
        className="role-select"
        onClick={() => onSelect(session.id)}
        title={
          source === "name"
            ? `${label} (matched by session name)`
            : source === "config"
              ? `${label} (bound in Pacium configuration)`
              : label
        }
        type="button"
      >
        <span aria-hidden="true" className="role-glyph">
          {glyph}
        </span>
        <span className="role-label">{label}</span>
        <span className="role-session-name">{session.displayName}</span>
        <span
          aria-hidden="true"
          className={`status-dot state-${statusDotState(session, attention)}`}
        />
        <span className="visually-hidden">
          {attention === null
            ? session.processState
            : attentionStateLabel(attention.state)}
        </span>
      </button>
      <button
        aria-label={`Actions for ${session.displayName}`}
        className="row-actions"
        onClick={() => onOpenActions(session.id)}
        type="button"
      >
        ⋯
      </button>
    </div>
  );
}

function SessionRow({
  attention,
  onOpenActions,
  onSelect,
  selected,
  session,
}: {
  attention: AttentionResult | null;
  onOpenActions: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  selected: boolean;
  session: SessionSummary;
}) {
  return (
    <div
      className={`session-row ${selected ? "is-selected" : ""} ${
        attention?.state === "needs_input" ? "is-needs-input" : ""
      }`}
    >
      <button
        className="session-select"
        onClick={() => onSelect(session.id)}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`status-dot state-${statusDotState(session, attention)}`}
        />
        <span className="session-name">{session.displayName}</span>
        <span className="session-kind">
          {session.launchPreset === "shell" ? "" : session.commandLabel}
        </span>
      </button>
      <button
        aria-label={`Actions for ${session.displayName}`}
        className="row-actions"
        onClick={() => onOpenActions(session.id)}
        type="button"
      >
        ⋯
      </button>
    </div>
  );
}

function sessionTitle(
  session: SessionSummary,
  role: "meta" | "orchestrator" | null,
): string {
  const repoName =
    session.repository.status === "ready" ? session.repository.name : null;
  const roleLabel =
    role === "meta" ? "Meta" : role === "orchestrator" ? "Orchestrator" : null;
  if (repoName !== null && roleLabel !== null) {
    return `${repoName} · ${roleLabel}`;
  }
  return session.displayName;
}

function statusDotState(
  session: SessionSummary,
  attention: AttentionResult | null,
): string {
  if (session.processState !== "live") {
    return session.processState;
  }
  if (attention === null || attention.source === "none") {
    return "live";
  }
  return attention.state;
}

function statusLine(
  session: SessionSummary,
  attention: AttentionResult,
): string {
  if (session.processState !== "live") {
    return session.processState === "exited"
      ? `Exited${session.exitCode !== null ? ` (${session.exitCode})` : ""}`
      : session.processState;
  }
  if (attention.source === "none") {
    return "Running · no provider signal";
  }
  return `${attentionStateLabel(attention.state)} · ${attentionSourceLabel(
    attention.source,
  )} · ${timeAgo(attention.observedAt)}`;
}

function TerminateSessionDialog({
  onCancel,
  onConfirm,
  session,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  session: SessionSummary;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLive =
    session.processState === "live" || session.processState === "closing";
  return (
    <div
      aria-labelledby="terminate-session-title"
      aria-modal="true"
      className="dialog-backdrop"
      onKeyDown={(event) =>
        handleModalKeyDown(event, dialogRef.current, onCancel)
      }
      ref={dialogRef}
      role="dialog"
    >
      <div className="dialog-card">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">
              {isLive ? "Terminate session" : "Remove session"}
            </span>
            <h2 id="terminate-session-title">{session.displayName}</h2>
          </div>
          <button aria-label="Cancel" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <p className="dialog-note">{terminateConsequence(session)}</p>
        <div className="dialog-actions">
          <button autoFocus onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" onClick={onConfirm} type="button">
            {isLive
              ? session.runtime === "tmux"
                ? "Disconnect and close"
                : "Terminate process"
              : "Remove session"}
          </button>
        </div>
      </div>
    </div>
  );
}

function terminateConsequence(session: SessionSummary): string {
  const isLive =
    session.processState === "live" || session.processState === "closing";
  if (!isLive) {
    return `Remove the ended session “${session.displayName}” from Pacium?`;
  }
  if (session.runtime === "tmux") {
    return session.tmuxMode === "keep_alive"
      ? `Disconnect the keep-alive client for “${session.displayName}”? The managed tmux target will continue and remains eligible for automatic reattachment on the next Pacium server start.`
      : `Disconnect the tmux client for “${session.displayName}”? Pacium will close only its attachment; the tmux server session may continue.`;
  }
  return `Terminate “${session.displayName}”? Pacium will send SIGTERM and force termination if it does not exit.`;
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "unknown time";
  }
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

// Multi-line composer messages are wrapped in bracketed paste so TUIs treat
// them as one message instead of submitting at the first newline. Enter is
// sent separately afterwards (see handleComposerSend).
function composerTextPayload(text: string): string {
  if (text.includes("\n")) {
    return `\u001b[200~${text}\u001b[201~`;
  }
  return text;
}

function applyServerMessage(
  message: ServerMessage,
  selectedIdRef: React.MutableRefObject<string | null>,
  syncRefs: React.MutableRefObject<Map<string, TerminalSync>>,
  terminalRefs: React.MutableRefObject<Map<string, TerminalSurfaceHandle>>,
  setSessions: React.Dispatch<React.SetStateAction<SessionSummary[]>>,
  setSessionListReady: React.Dispatch<React.SetStateAction<boolean>>,
  setRelaunchManifests: React.Dispatch<
    React.SetStateAction<RelaunchManifest[]>
  >,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
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
        return message.sessions[0]?.id ?? null;
      });
      return;
    case "relaunch.manifest.list":
      setRelaunchManifests(message.manifests);
      return;
    case "relaunch.manifest.updated":
      setRelaunchManifests((current) =>
        upsertRelaunchManifest(current, message.manifest),
      );
      return;
    case "session.created":
      setSessions((current) => upsertSession(current, message.session));
      if (message.session.relaunchManifest !== undefined) {
        setRelaunchManifests((current) =>
          upsertRelaunchManifest(current, message.session.relaunchManifest!),
        );
      }
      setSelectedId(message.session.id);
      return;
    case "session.updated":
    case "session.exited":
      setSessions((current) => upsertSession(current, message.session));
      if (message.session.relaunchManifest !== undefined) {
        setRelaunchManifests((current) =>
          upsertRelaunchManifest(current, message.session.relaunchManifest!),
        );
      }
      return;
    case "session.closed":
      syncRefs.current.delete(message.sessionId);
      terminalRefs.current.delete(message.sessionId);
      setSessions((current) => {
        const remaining = current.filter(({ id }) => id !== message.sessionId);
        if (selectedIdRef.current === message.sessionId) {
          setSelectedId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
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
    default:
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

function upsertRelaunchManifest(
  manifests: RelaunchManifest[],
  incoming: RelaunchManifest,
): RelaunchManifest[] {
  return [incoming, ...manifests.filter(({ id }) => id !== incoming.id)].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

export function CreateTerminalDialog({
  defaultCwd,
  defaultLaunchPreset,
  launchPresets,
  loadDirectories,
  onCancel,
  onCreate,
  tmuxCapability,
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
    keepAlive?: boolean;
  }) => void;
  tmuxCapability: TmuxCapability;
}) {
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [cwd, setCwd] = useState(defaultCwd);
  const [displayName, setDisplayName] = useState("");
  const [launchPreset, setLaunchPreset] =
    useState<LaunchPresetId>(defaultLaunchPreset);
  const [keepAlive, setKeepAlive] = useState(false);
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
      ...(keepAlive ? { keepAlive: true } : {}),
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
        {tmuxCapability.state === "ready" && (
          <label className="keep-alive-option">
            <input
              checked={keepAlive}
              onChange={(event) => setKeepAlive(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>Keep alive with tmux</strong>
              <small>
                Survives Pacium server restarts and reconnects automatically.
              </small>
            </span>
          </label>
        )}
        <p className="dialog-note">
          {keepAlive
            ? `${selectedPreset?.label ?? "The command"} runs in one managed tmux session. Closing Pacium disconnects its client but does not kill the tmux target.`
            : `${selectedPreset?.label ?? "The command"} runs as your local user and remains alive while this Pacium server is running.`}
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
