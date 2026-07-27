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
  write(data: string): void;
}

export interface TerminalSurfaceProps {
  ariaLabel: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onCaptureChange?: (captured: boolean) => void;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

const TERMINAL_THEME = {
  background: "#101113",
  foreground: "#e7e7e9",
  cursor: "#8b7cf6",
  cursorAccent: "#101113",
  selectionBackground: "#6658cc66",
  black: "#202126",
  brightBlack: "#6d7078",
  red: "#ec6a75",
  brightRed: "#f07b85",
  green: "#92c353",
  brightGreen: "#a4d467",
  yellow: "#e6b450",
  brightYellow: "#f2c866",
  blue: "#6aa6f8",
  brightBlue: "#86b7fa",
  magenta: "#b79bf8",
  brightMagenta: "#c8b2fa",
  cyan: "#64c5da",
  brightCyan: "#7bd5e5",
  white: "#d9d9dc",
  brightWhite: "#ffffff",
} as const;

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
      fontFamily:
        '"SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      scrollback: 2_000,
      theme: TERMINAL_THEME,
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
