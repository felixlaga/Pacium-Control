import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  MAX_PALETTE_QUERY_CHARS,
  movePaletteSelection,
  searchPaletteCommands,
  searchShortcutReference,
  type PaletteCommand,
} from "./command-palette-model.js";

export type CommandPaletteView = "commands" | "shortcuts";

interface CommandPaletteProps {
  commands: PaletteCommand[];
  initialQuery?: string;
  onClose: () => void;
  onExecute: (command: PaletteCommand) => void;
  onViewChange: (view: CommandPaletteView) => void;
  view: CommandPaletteView;
}

export function CommandPalette({
  commands,
  initialQuery = "",
  onClose,
  onExecute,
  onViewChange,
  view,
}: CommandPaletteProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(
    () => searchPaletteCommands(commands, query),
    [commands, query],
  );
  const references = useMemo(() => searchShortcutReference(query), [query]);
  const [activeId, setActiveId] = useState<string | null>(
    () => results.find(({ enabled }) => enabled)?.id ?? null,
  );

  useEffect(() => {
    if (
      activeId === null ||
      !results.some(({ id, enabled }) => id === activeId && enabled)
    ) {
      setActiveId(results.find(({ enabled }) => enabled)?.id ?? null);
    }
  }, [activeId, results]);

  useEffect(() => {
    if (view === "commands" && activeId !== null) {
      document
        .getElementById(commandElementId(activeId))
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId, view]);

  const changeView = (next: CommandPaletteView) => {
    setQuery("");
    onViewChange(next);
  };

  const executeActive = () => {
    const active = results.find(
      ({ id, enabled }) => id === activeId && enabled,
    );
    if (active !== undefined) {
      onExecute(active);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (view === "commands" && event.key === "ArrowDown") {
      event.preventDefault();
      setActiveId((current) => movePaletteSelection(results, current, 1));
      return;
    }
    if (view === "commands" && event.key === "ArrowUp") {
      event.preventDefault();
      setActiveId((current) => movePaletteSelection(results, current, -1));
      return;
    }
    if (view === "commands" && event.key === "Enter") {
      event.preventDefault();
      executeActive();
      return;
    }
    if (event.key === "Tab") {
      keepModalFocus(event, panelRef.current);
    }
  };

  return (
    <div
      className="command-palette-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="command-palette-title"
        aria-modal="true"
        className="command-palette"
        onKeyDown={onKeyDown}
        ref={panelRef}
        role="dialog"
      >
        <header className="command-palette-header">
          <div>
            <span className="eyebrow">Quick command</span>
            <h2 id="command-palette-title">
              {view === "commands" ? "Command palette" : "Keyboard shortcuts"}
            </h2>
          </div>
          <kbd>Esc</kbd>
        </header>

        <div className="command-palette-tabs" role="tablist">
          <button
            aria-selected={view === "commands"}
            onClick={() => changeView("commands")}
            role="tab"
            type="button"
          >
            Commands
          </button>
          <button
            aria-selected={view === "shortcuts"}
            onClick={() => changeView("shortcuts")}
            role="tab"
            type="button"
          >
            Shortcuts
          </button>
        </div>

        <label className="command-search">
          <span aria-hidden="true">⌕</span>
          <span className="visually-hidden">
            {view === "commands" ? "Search commands" : "Search shortcuts"}
          </span>
          <input
            aria-activedescendant={
              view === "commands" && activeId !== null
                ? commandElementId(activeId)
                : undefined
            }
            aria-controls="command-palette-results"
            aria-expanded="true"
            autoFocus
            maxLength={MAX_PALETTE_QUERY_CHARS}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              view === "commands"
                ? "Search sessions and actions…"
                : "Search keyboard shortcuts…"
            }
            role="combobox"
            value={query}
          />
          {query.length > 0 && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery("")}
              type="button"
            >
              ×
            </button>
          )}
        </label>

        <div
          aria-label={
            view === "commands"
              ? "Available commands"
              : "Keyboard shortcut reference"
          }
          className="command-results"
          id="command-palette-results"
          role={view === "commands" ? "listbox" : "list"}
        >
          {view === "commands" ? (
            results.length === 0 ? (
              <PaletteEmpty
                detail="Try a session name, repository, action, or workspace command."
                title="No commands match"
              />
            ) : (
              results.map((command, index) => {
                const showGroup =
                  index === 0 || results[index - 1]?.group !== command.group;
                const selected = command.id === activeId;
                return (
                  <div className="command-result-block" key={command.id}>
                    {showGroup && (
                      <div className="command-result-group">
                        {command.group}
                      </div>
                    )}
                    <button
                      aria-disabled={!command.enabled}
                      aria-selected={selected}
                      className={`command-result ${
                        selected ? "is-active" : ""
                      }`}
                      disabled={!command.enabled}
                      id={commandElementId(command.id)}
                      onClick={() => onExecute(command)}
                      onMouseEnter={() => {
                        if (command.enabled) {
                          setActiveId(command.id);
                        }
                      }}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <span aria-hidden="true" className="command-result-icon">
                        {commandIcon(command)}
                      </span>
                      <span className="command-result-copy">
                        <strong>{command.label}</strong>
                        <small>
                          {command.disabledReason ?? command.detail}
                        </small>
                      </span>
                      {command.shortcut !== undefined && (
                        <kbd>{command.shortcut}</kbd>
                      )}
                    </button>
                  </div>
                );
              })
            )
          ) : references.length === 0 ? (
            <PaletteEmpty
              detail="Try an action such as split, focus, terminal, or palette."
              title="No shortcuts match"
            />
          ) : (
            references.map((reference) => (
              <div className="shortcut-reference-row" key={reference.id}>
                <span>
                  <strong>{reference.label}</strong>
                  <small>{reference.detail}</small>
                </span>
                <kbd>{reference.shortcut}</kbd>
              </div>
            ))
          )}
        </div>

        <footer className="command-palette-footer">
          {view === "commands" ? (
            <>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> Navigate
              </span>
              <span>
                <kbd>↵</kbd> Run
              </span>
            </>
          ) : (
            <span>
              Shortcuts pause while terminal capture owns the keyboard.
            </span>
          )}
          <span>
            {view === "commands" ? results.length : references.length}
          </span>
        </footer>
      </section>
    </div>
  );
}

function PaletteEmpty({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="command-palette-empty" role="status">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function commandElementId(id: string): string {
  return `palette-command-${id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function commandIcon(command: PaletteCommand): string {
  switch (command.action.type) {
    case "new-terminal":
      return "+";
    case "split-pane":
      return command.action.direction === "horizontal" ? "▥" : "▤";
    case "focus-pane":
      return command.action.direction === -1 ? "←" : "→";
    case "toggle-maximize":
      return "⌗";
    case "show-shortcuts":
      return "?";
    case "open-settings":
      return "⚙";
    case "toggle-sidebar":
      return "▌";
    case "toggle-inspector":
      return "▐";
    case "select-session":
      return "›";
    case "rename-session":
      return "Aa";
    case "duplicate-session":
      return "⧉";
    case "relaunch-session":
      return "↻";
    case "copy-session-directory":
      return "⌘";
    case "reveal-session-repository":
      return "↗";
    case "close-session-view":
      return "—";
    case "interrupt-session":
      return "^C";
    case "review-session-termination":
      return "!";
  }
}

function keepModalFocus(
  event: KeyboardEvent<HTMLElement>,
  panel: HTMLElement | null,
): void {
  if (panel === null) {
    return;
  }
  const focusable = [
    ...panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
