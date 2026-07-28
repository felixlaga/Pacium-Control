import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import {
  DEFAULT_TERMINAL_DISPLAY_PREFERENCES,
  terminalOptionsForPreferences,
  type TerminalDisplayPreferences,
} from "./terminal-preferences.js";
import {
  buildTerminalTextExcerpt,
  MAX_TERMINAL_EXCERPT_SCAN_LINES,
  type TerminalTextExcerpt,
} from "./terminal-excerpt.js";

export interface TerminalSnapshot {
  data: string;
  cols: number;
  rows: number;
}

export interface TerminalSurfaceHandle {
  applySnapshot(snapshot: TerminalSnapshot): void;
  blur(): void;
  clear(): void;
  focus(): void;
  readRecentText(): TerminalTextExcerpt | null;
  write(data: string): void;
}

export interface TerminalSurfaceProps {
  ariaLabel: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onCaptureChange?: (captured: boolean) => void;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  preferences?: TerminalDisplayPreferences;
}

export const TerminalSurface = forwardRef<
  TerminalSurfaceHandle,
  TerminalSurfaceProps
>(function TerminalSurface(
  {
    ariaLabel,
    autoFocus = true,
    disabled = false,
    onCaptureChange,
    onInput,
    onResize,
    preferences = DEFAULT_TERMINAL_DISPLAY_PREFERENCES,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const autoFocusOnMountRef = useRef(autoFocus);
  const inputHandlerRef = useRef(onInput);
  const resizeHandlerRef = useRef(onResize);

  inputHandlerRef.current = onInput;
  resizeHandlerRef.current = onResize;

  useImperativeHandle(
    forwardedRef,
    () => ({
      applySnapshot(snapshot) {
        const terminal = terminalRef.current;
        if (terminal === null) {
          return;
        }
        terminal.reset();
        terminal.resize(snapshot.cols, snapshot.rows);
        terminal.write(snapshot.data);
      },
      blur() {
        terminalRef.current?.blur();
      },
      clear() {
        terminalRef.current?.reset();
      },
      focus() {
        terminalRef.current?.focus();
      },
      readRecentText() {
        const terminal = terminalRef.current;
        if (terminal === null) {
          return null;
        }
        const buffer = terminal.buffer.active;
        const start = Math.max(
          0,
          buffer.length - MAX_TERMINAL_EXCERPT_SCAN_LINES,
        );
        const lines: string[] = [];
        for (let index = start; index < buffer.length; index += 1) {
          lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
        }
        return buildTerminalTextExcerpt(lines);
      },
      write(data) {
        terminalRef.current?.write(data);
      },
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "bar",
      disableStdin: disabled,
      ...terminalOptionsForPreferences(preferences),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const inputDisposable = terminal.onData((data) => {
      inputHandlerRef.current(data);
    });
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      resizeHandlerRef.current(cols, rows);
    });

    let animationFrame = 0;
    const fit = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          fitAddon.fit();
        }
      });
    };
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);
    fit();
    if (autoFocusOnMountRef.current) {
      terminal.focus();
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current !== null) {
      terminalRef.current.options.disableStdin = disabled;
    }
  }, [disabled]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (terminal === null || fitAddon === null) {
      return;
    }
    const options = terminalOptionsForPreferences(preferences);
    terminal.options.fontFamily = options.fontFamily;
    terminal.options.fontSize = options.fontSize;
    terminal.options.lineHeight = options.lineHeight;
    terminal.options.scrollback = options.scrollback;
    terminal.options.theme = options.theme;

    const animationFrame = requestAnimationFrame(() => fitAddon.fit());
    return () => cancelAnimationFrame(animationFrame);
  }, [
    preferences.fontFamily,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.scrollback,
    preferences.theme,
  ]);

  const style = {
    "--terminal-opacity": disabled ? 0.58 : 1,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className="pacium-terminal-surface"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onCaptureChange?.(false);
        }
      }}
      onFocus={() => onCaptureChange?.(true)}
      style={style}
    />
  );
});
