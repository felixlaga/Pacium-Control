export const MAX_SPLIT_PANES = 4;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

export type SplitDirection = "horizontal" | "vertical";

export interface TerminalPaneNode {
  kind: "pane";
  id: string;
  sessionId: string | null;
}

export interface TerminalSplitNode {
  kind: "split";
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: SplitLayoutNode;
  second: SplitLayoutNode;
}

export type SplitLayoutNode = TerminalPaneNode | TerminalSplitNode;

export interface SplitLayoutState {
  root: SplitLayoutNode;
  focusedPaneId: string;
  maximizedPaneId: string | null;
}

interface StoredSplitLayout {
  version: 1;
  root: SplitLayoutNode;
  focusedPaneId: string;
  maximizedPaneId: string | null;
}

export function createSplitLayout(paneId: string): SplitLayoutState {
  return {
    root: { kind: "pane", id: paneId, sessionId: null },
    focusedPaneId: paneId,
    maximizedPaneId: null,
  };
}

export function splitFocusedPane(
  state: SplitLayoutState,
  direction: SplitDirection,
  splitId: string,
  paneId: string,
): SplitLayoutState {
  if (
    listPanes(state.root).length >= MAX_SPLIT_PANES ||
    containsNodeId(state.root, splitId) ||
    containsNodeId(state.root, paneId) ||
    splitId === paneId
  ) {
    return state;
  }

  const replaced = replacePane(state.root, state.focusedPaneId, (pane) => ({
    kind: "split",
    id: splitId,
    direction,
    ratio: 0.5,
    first: pane,
    second: { kind: "pane", id: paneId, sessionId: null },
  }));
  if (replaced === state.root) {
    return state;
  }
  return {
    root: replaced,
    focusedPaneId: paneId,
    maximizedPaneId: null,
  };
}

export function showSessionInFocusedPane(
  state: SplitLayoutState,
  sessionId: string,
): SplitLayoutState {
  const existing = listPanes(state.root).find(
    (pane) => pane.sessionId === sessionId,
  );
  if (existing !== undefined) {
    return focusPane(state, existing.id);
  }
  return assignSessionToPane(state, state.focusedPaneId, sessionId);
}

export function assignSessionToPane(
  state: SplitLayoutState,
  paneId: string,
  sessionId: string,
): SplitLayoutState {
  const target = findPane(state.root, paneId);
  if (target === null) {
    return state;
  }
  if (target.sessionId === sessionId) {
    return focusPane(state, paneId);
  }

  const existing = listPanes(state.root).find(
    (pane) => pane.sessionId === sessionId,
  );
  let root = state.root;
  if (existing !== undefined) {
    root = updatePaneSession(root, existing.id, target.sessionId);
  }
  root = updatePaneSession(root, paneId, sessionId);
  return {
    root,
    focusedPaneId: paneId,
    maximizedPaneId: state.maximizedPaneId,
  };
}

export function focusPane(
  state: SplitLayoutState,
  paneId: string,
): SplitLayoutState {
  if (findPane(state.root, paneId) === null) {
    return state;
  }
  return { ...state, focusedPaneId: paneId };
}

export function focusPaneByOffset(
  state: SplitLayoutState,
  direction: -1 | 1,
): SplitLayoutState {
  const panes = listPanes(state.root);
  if (panes.length === 0) {
    return state;
  }
  const currentIndex = panes.findIndex(
    (pane) => pane.id === state.focusedPaneId,
  );
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + panes.length) % panes.length;
  return focusPane(state, panes[nextIndex]?.id ?? state.focusedPaneId);
}

export function closePane(
  state: SplitLayoutState,
  paneId: string,
): SplitLayoutState {
  if (state.root.kind === "pane") {
    if (state.root.id !== paneId) {
      return state;
    }
    return {
      root: { ...state.root, sessionId: null },
      focusedPaneId: state.root.id,
      maximizedPaneId: null,
    };
  }

  const removed = removePane(state.root, paneId);
  if (removed === null || removed === state.root) {
    return state;
  }
  const remainingPanes = listPanes(removed);
  const focusedStillExists = remainingPanes.some(
    (pane) => pane.id === state.focusedPaneId,
  );
  return {
    root: removed,
    focusedPaneId: focusedStillExists
      ? state.focusedPaneId
      : (remainingPanes[0]?.id ?? state.focusedPaneId),
    maximizedPaneId:
      state.maximizedPaneId === paneId ? null : state.maximizedPaneId,
  };
}

export function clearSessionFromLayout(
  state: SplitLayoutState,
  sessionId: string,
): SplitLayoutState {
  const pane = listPanes(state.root).find(
    (candidate) => candidate.sessionId === sessionId,
  );
  if (pane === undefined) {
    return state;
  }
  return {
    ...state,
    root: updatePaneSession(state.root, pane.id, null),
  };
}

export function setSplitRatio(
  state: SplitLayoutState,
  splitId: string,
  ratio: number,
): SplitLayoutState {
  const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
  const root = updateSplit(state.root, splitId, (split) => ({
    ...split,
    ratio: clamped,
  }));
  return root === state.root ? state : { ...state, root };
}

export function toggleMaximizedPane(
  state: SplitLayoutState,
  paneId: string,
): SplitLayoutState {
  if (findPane(state.root, paneId) === null) {
    return state;
  }
  return {
    ...state,
    focusedPaneId: paneId,
    maximizedPaneId: state.maximizedPaneId === paneId ? null : paneId,
  };
}

export function reconcileSplitLayout(
  state: SplitLayoutState,
  validSessionIds: ReadonlySet<string>,
): SplitLayoutState {
  const seenSessions = new Set<string>();
  const root = mapPanes(state.root, (pane) => {
    const sessionId = pane.sessionId;
    if (
      sessionId === null ||
      !validSessionIds.has(sessionId) ||
      seenSessions.has(sessionId)
    ) {
      return sessionId === null ? pane : { ...pane, sessionId: null };
    }
    seenSessions.add(sessionId);
    return pane;
  });
  const panes = listPanes(root);
  const focusedPaneId = panes.some((pane) => pane.id === state.focusedPaneId)
    ? state.focusedPaneId
    : (panes[0]?.id ?? state.focusedPaneId);
  const maximizedPaneId =
    state.maximizedPaneId !== null &&
    panes.some((pane) => pane.id === state.maximizedPaneId)
      ? state.maximizedPaneId
      : null;
  return { root, focusedPaneId, maximizedPaneId };
}

export function getFocusedPane(
  state: SplitLayoutState,
): TerminalPaneNode | null {
  return findPane(state.root, state.focusedPaneId);
}

export function listPanes(root: SplitLayoutNode): TerminalPaneNode[] {
  return root.kind === "pane"
    ? [root]
    : [...listPanes(root.first), ...listPanes(root.second)];
}

export function parseStoredSplitLayout(
  value: string | null,
): SplitLayoutState | null {
  if (value === null) {
    return null;
  }
  try {
    const candidate = JSON.parse(value) as unknown;
    if (typeof candidate !== "object" || candidate === null) {
      return null;
    }
    const stored = candidate as Record<string, unknown>;
    if (
      stored.version !== 1 ||
      typeof stored.focusedPaneId !== "string" ||
      (stored.maximizedPaneId !== null &&
        typeof stored.maximizedPaneId !== "string")
    ) {
      return null;
    }
    const context: ParseContext = {
      nodeIds: new Set<string>(),
      sessionIds: new Set<string>(),
      panes: 0,
    };
    const root = parseNode(stored.root, 0, context);
    if (root === null || context.panes > MAX_SPLIT_PANES) {
      return null;
    }
    const panes = listPanes(root);
    const focusedPaneId = panes.some((pane) => pane.id === stored.focusedPaneId)
      ? stored.focusedPaneId
      : (panes[0]?.id ?? "");
    const maximizedPaneId =
      typeof stored.maximizedPaneId === "string" &&
      panes.some((pane) => pane.id === stored.maximizedPaneId)
        ? stored.maximizedPaneId
        : null;
    return { root, focusedPaneId, maximizedPaneId };
  } catch {
    return null;
  }
}

export function serializeSplitLayout(state: SplitLayoutState): string {
  const stored: StoredSplitLayout = {
    version: 1,
    root: state.root,
    focusedPaneId: state.focusedPaneId,
    maximizedPaneId: state.maximizedPaneId,
  };
  return JSON.stringify(stored);
}

function findPane(
  node: SplitLayoutNode,
  paneId: string,
): TerminalPaneNode | null {
  if (node.kind === "pane") {
    return node.id === paneId ? node : null;
  }
  return findPane(node.first, paneId) ?? findPane(node.second, paneId);
}

function replacePane(
  node: SplitLayoutNode,
  paneId: string,
  replacement: (pane: TerminalPaneNode) => SplitLayoutNode,
): SplitLayoutNode {
  if (node.kind === "pane") {
    return node.id === paneId ? replacement(node) : node;
  }
  const first = replacePane(node.first, paneId, replacement);
  const second = replacePane(node.second, paneId, replacement);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

function updatePaneSession(
  node: SplitLayoutNode,
  paneId: string,
  sessionId: string | null,
): SplitLayoutNode {
  return replacePane(node, paneId, (pane) => ({ ...pane, sessionId }));
}

function mapPanes(
  node: SplitLayoutNode,
  mapper: (pane: TerminalPaneNode) => TerminalPaneNode,
): SplitLayoutNode {
  if (node.kind === "pane") {
    return mapper(node);
  }
  const first = mapPanes(node.first, mapper);
  const second = mapPanes(node.second, mapper);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

function removePane(
  node: SplitLayoutNode,
  paneId: string,
): SplitLayoutNode | null {
  if (node.kind === "pane") {
    return node.id === paneId ? null : node;
  }
  const first = removePane(node.first, paneId);
  if (first === null) {
    return node.second;
  }
  const second = removePane(node.second, paneId);
  if (second === null) {
    return node.first;
  }
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

function updateSplit(
  node: SplitLayoutNode,
  splitId: string,
  updater: (split: TerminalSplitNode) => TerminalSplitNode,
): SplitLayoutNode {
  if (node.kind === "pane") {
    return node;
  }
  if (node.id === splitId) {
    return updater(node);
  }
  const first = updateSplit(node.first, splitId, updater);
  const second = updateSplit(node.second, splitId, updater);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

function containsNodeId(node: SplitLayoutNode, nodeId: string): boolean {
  if (node.id === nodeId) {
    return true;
  }
  return node.kind === "split"
    ? containsNodeId(node.first, nodeId) || containsNodeId(node.second, nodeId)
    : false;
}

interface ParseContext {
  nodeIds: Set<string>;
  sessionIds: Set<string>;
  panes: number;
}

function parseNode(
  value: unknown,
  depth: number,
  context: ParseContext,
): SplitLayoutNode | null {
  if (
    depth > 3 ||
    typeof value !== "object" ||
    value === null ||
    !("kind" in value) ||
    !("id" in value)
  ) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    candidate.id.length > 100 ||
    context.nodeIds.has(candidate.id)
  ) {
    return null;
  }
  context.nodeIds.add(candidate.id);

  if (candidate.kind === "pane") {
    context.panes += 1;
    if (
      candidate.sessionId !== null &&
      typeof candidate.sessionId !== "string"
    ) {
      return null;
    }
    const sessionId =
      typeof candidate.sessionId === "string" &&
      candidate.sessionId.length > 0 &&
      candidate.sessionId.length <= 100 &&
      !context.sessionIds.has(candidate.sessionId)
        ? candidate.sessionId
        : null;
    if (sessionId !== null) {
      context.sessionIds.add(sessionId);
    }
    return { kind: "pane", id: candidate.id, sessionId };
  }

  if (
    candidate.kind !== "split" ||
    (candidate.direction !== "horizontal" &&
      candidate.direction !== "vertical") ||
    typeof candidate.ratio !== "number" ||
    !Number.isFinite(candidate.ratio)
  ) {
    return null;
  }
  const first = parseNode(candidate.first, depth + 1, context);
  const second = parseNode(candidate.second, depth + 1, context);
  if (first === null || second === null) {
    return null;
  }
  return {
    kind: "split",
    id: candidate.id,
    direction: candidate.direction,
    ratio: Math.min(
      MAX_SPLIT_RATIO,
      Math.max(MIN_SPLIT_RATIO, candidate.ratio),
    ),
    first,
    second,
  };
}
