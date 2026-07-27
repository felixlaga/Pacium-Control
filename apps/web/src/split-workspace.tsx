import {
  TerminalSurface,
  type TerminalSurfaceHandle,
} from "@pacium/terminal-ui";
import type { SessionSummary } from "@pacium/contracts";
import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  MAX_SPLIT_PANES,
  listPanes,
  type SplitDirection,
  type SplitLayoutNode,
  type SplitLayoutState,
  type TerminalPaneNode,
  type TerminalSplitNode,
} from "./split-layout-model.js";

interface SplitWorkspaceProps {
  capturedPaneId: string | null;
  layout: SplitLayoutState;
  onAssignSession: (paneId: string, sessionId: string) => void;
  onCaptureChange: (paneId: string, captured: boolean) => void;
  onClosePane: (paneId: string) => void;
  onFocusPane: (paneId: string) => void;
  onInput: (sessionId: string, data: string) => void;
  onOpenActions: (sessionId: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onSetRatio: (splitId: string, ratio: number) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onToggleMaximize: (paneId: string) => void;
  sessions: SessionSummary[];
  terminalRefs: MutableRefObject<Map<string, TerminalSurfaceHandle>>;
}

export function SplitWorkspace(props: SplitWorkspaceProps) {
  const panes = listPanes(props.layout.root);
  const maximizedPane =
    props.layout.maximizedPaneId === null
      ? undefined
      : panes.find(({ id }) => id === props.layout.maximizedPaneId);
  const renderedRoot: SplitLayoutNode = maximizedPane ?? props.layout.root;

  return (
    <div
      className={`split-layout ${
        maximizedPane === undefined ? "" : "is-maximized"
      }`}
    >
      <SplitNode {...props} node={renderedRoot} paneCount={panes.length} />
    </div>
  );
}

function SplitNode(
  props: SplitWorkspaceProps & {
    node: SplitLayoutNode;
    paneCount: number;
  },
) {
  if (props.node.kind === "pane") {
    return <TerminalPane {...props} pane={props.node} />;
  }
  return <TerminalSplit {...props} split={props.node} />;
}

function TerminalSplit(
  props: SplitWorkspaceProps & {
    split: TerminalSplitNode;
    paneCount: number;
  },
) {
  const firstStyle = {
    flexBasis: `${Math.round(props.split.ratio * 10_000) / 100}%`,
  } satisfies CSSProperties;
  const secondStyle = {
    flexBasis: `${Math.round((1 - props.split.ratio) * 10_000) / 100}%`,
  } satisfies CSSProperties;

  return (
    <div
      className={`split-node split-direction-${props.split.direction}`}
      data-split-id={props.split.id}
    >
      <div className="split-child" style={firstStyle}>
        <SplitNode {...props} node={props.split.first} />
      </div>
      <SplitDivider
        direction={props.split.direction}
        onRatio={(ratio) => props.onSetRatio(props.split.id, ratio)}
        ratio={props.split.ratio}
      />
      <div className="split-child" style={secondStyle}>
        <SplitNode {...props} node={props.split.second} />
      </div>
    </div>
  );
}

function SplitDivider({
  direction,
  onRatio,
  ratio,
}: {
  direction: SplitDirection;
  onRatio: (ratio: number) => void;
  ratio: number;
}) {
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const splitElement = event.currentTarget.parentElement;
    if (splitElement === null) {
      return;
    }
    const bounds = splitElement.getBoundingClientRect();
    const update = (pointerEvent: PointerEvent) => {
      const nextRatio =
        direction === "horizontal"
          ? (pointerEvent.clientX - bounds.left) / bounds.width
          : (pointerEvent.clientY - bounds.top) / bounds.height;
      onRatio(nextRatio);
    };
    const finish = () => {
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerup", finish);
      document.body.classList.remove("is-resizing-split");
    };
    document.body.classList.add("is-resizing-split");
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", finish, { once: true });
  };

  return (
    <div
      aria-label={`Resize ${
        direction === "horizontal" ? "left and right" : "upper and lower"
      } terminal panes`}
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-valuemax={80}
      aria-valuemin={20}
      aria-valuenow={Math.round(ratio * 100)}
      className="split-divider"
      onKeyDown={(event) => {
        const decreasingKey =
          direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const increasingKey =
          direction === "horizontal" ? "ArrowRight" : "ArrowDown";
        if (event.key === decreasingKey || event.key === increasingKey) {
          event.preventDefault();
          onRatio(ratio + (event.key === decreasingKey ? -0.05 : 0.05));
          return;
        }
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          onRatio(event.key === "Home" ? 0.2 : 0.8);
        }
      }}
      onPointerDown={startResize}
      role="separator"
      tabIndex={0}
    >
      <span aria-hidden="true" />
    </div>
  );
}

function TerminalPane(
  props: SplitWorkspaceProps & {
    pane: TerminalPaneNode;
    paneCount: number;
  },
) {
  const session =
    props.sessions.find(({ id }) => id === props.pane.sessionId) ?? null;
  const focused = props.layout.focusedPaneId === props.pane.id;
  const captured = props.capturedPaneId === props.pane.id;
  const maximized = props.layout.maximizedPaneId === props.pane.id;

  return (
    <section
      aria-label={
        session === null
          ? `Empty terminal pane${focused ? ", focused" : ""}`
          : `${session.displayName} terminal pane${focused ? ", focused" : ""}`
      }
      className={`terminal-pane ${focused ? "is-focused" : ""}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/x-pacium-session")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const sessionId = event.dataTransfer.getData(
          "application/x-pacium-session",
        );
        if (sessionId.length > 0) {
          event.preventDefault();
          props.onAssignSession(props.pane.id, sessionId);
        }
      }}
      onPointerDown={() => {
        if (!focused) {
          props.onFocusPane(props.pane.id);
        }
      }}
    >
      {session === null ? (
        <EmptyPane
          canClose={props.paneCount > 1}
          focused={focused}
          onAssign={(sessionId) =>
            props.onAssignSession(props.pane.id, sessionId)
          }
          onClose={() => props.onClosePane(props.pane.id)}
          sessions={props.sessions}
        />
      ) : (
        <>
          <header
            className="terminal-pane-header"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "application/x-pacium-session",
                session.id,
              );
            }}
          >
            <div className="terminal-pane-identity">
              <span
                aria-hidden="true"
                className={`status-dot state-${session.processState}`}
              />
              <div>
                <strong>{session.displayName}</strong>
                <span>
                  {session.commandLabel} · {compactPath(session.cwd)}
                </span>
              </div>
            </div>
            <div className="terminal-pane-state">
              {focused && <span className="focused-label">Focused</span>}
              <span>
                {captured ? "Capture · Ctrl Shift ." : session.processState}
              </span>
            </div>
            <div className="terminal-pane-actions">
              <button
                aria-label={`Split ${session.displayName} right`}
                disabled={props.paneCount >= MAX_SPLIT_PANES}
                onClick={() => props.onSplit(props.pane.id, "horizontal")}
                title="Split right"
                type="button"
              >
                ▥
              </button>
              <button
                aria-label={`Split ${session.displayName} down`}
                disabled={props.paneCount >= MAX_SPLIT_PANES}
                onClick={() => props.onSplit(props.pane.id, "vertical")}
                title="Split down"
                type="button"
              >
                ▤
              </button>
              <button
                aria-label={`${maximized ? "Restore" : "Maximize"} ${
                  session.displayName
                } pane`}
                onClick={() => props.onToggleMaximize(props.pane.id)}
                title={maximized ? "Restore split layout" : "Maximize pane"}
                type="button"
              >
                {maximized ? "↙" : "↗"}
              </button>
              <button
                aria-label={`Open ${session.displayName} session actions`}
                onClick={() => props.onOpenActions(session.id)}
                title="Session actions"
                type="button"
              >
                •••
              </button>
              <button
                aria-label={`Close ${session.displayName} pane; terminal keeps running`}
                onClick={() => props.onClosePane(props.pane.id)}
                title="Close pane · terminal keeps running"
                type="button"
              >
                ×
              </button>
            </div>
          </header>
          <TerminalSurface
            ref={(handle) => {
              if (handle === null) {
                props.terminalRefs.current.delete(session.id);
              } else {
                props.terminalRefs.current.set(session.id, handle);
              }
            }}
            ariaLabel={`${session.displayName} terminal`}
            autoFocus={focused}
            disabled={session.processState !== "live"}
            onCaptureChange={(nextCaptured) =>
              props.onCaptureChange(props.pane.id, nextCaptured)
            }
            onInput={(data) => {
              if (session.processState === "live") {
                props.onInput(session.id, data);
              }
            }}
            onResize={(cols, rows) => {
              if (
                session.processState === "live" &&
                (cols !== session.cols || rows !== session.rows)
              ) {
                props.onResize(session.id, cols, rows);
              }
            }}
          />
        </>
      )}
    </section>
  );
}

function EmptyPane({
  canClose,
  focused,
  onAssign,
  onClose,
  sessions,
}: {
  canClose: boolean;
  focused: boolean;
  onAssign: (sessionId: string) => void;
  onClose: () => void;
  sessions: SessionSummary[];
}) {
  return (
    <div className="empty-pane">
      <div className="empty-pane-heading">
        <div>
          <span className="eyebrow">
            {focused ? "Focused pane" : "Empty split"}
          </span>
          <h2>Choose a running terminal</h2>
          <p>Move a session here without stopping or duplicating its PTY.</p>
        </div>
        {canClose && (
          <button
            aria-label="Close empty pane"
            onClick={onClose}
            title="Close pane"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      <div className="empty-pane-sessions">
        {sessions.slice(0, 8).map((session) => (
          <button
            key={session.id}
            onClick={() => onAssign(session.id)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`status-dot state-${session.processState}`}
            />
            <span>
              <strong>{session.displayName}</strong>
              <small>
                {session.commandLabel} · {compactPath(session.cwd)}
              </small>
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      {sessions.length > 8 && (
        <p className="empty-pane-more">
          Choose another session from the sidebar or tab strip.
        </p>
      )}
    </div>
  );
}

function compactPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}
