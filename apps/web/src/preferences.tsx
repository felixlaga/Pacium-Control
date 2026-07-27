import type { LaunchPresetCapability } from "@pacium/contracts";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  DEFAULT_WORKSPACE_PREFERENCES,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_LINE_HEIGHT_MAX,
  TERMINAL_LINE_HEIGHT_MIN,
  TERMINAL_SCROLLBACK_MAX,
  TERMINAL_SCROLLBACK_MIN,
  type DensityPreference,
  type NotificationPreference,
  type TerminalFontPreference,
  type ThemePreference,
  type WorkspacePreferences,
} from "./preferences-model.js";

interface PreferencesDialogProps {
  launchPresets: LaunchPresetCapability[];
  onApply: (preferences: WorkspacePreferences) => void;
  onCancel: () => void;
  preferences: WorkspacePreferences;
}

export function PreferencesDialog({
  launchPresets,
  onApply,
  onCancel,
  preferences,
}: PreferencesDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState(preferences);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [onCancel]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft);
  };

  const update = <Key extends keyof WorkspacePreferences>(
    key: Key,
    value: WorkspacePreferences[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDefaultsLoaded(false);
  };

  return (
    <div className="preferences-backdrop">
      <section
        aria-labelledby="preferences-title"
        aria-modal="true"
        className="preferences-dialog"
        onKeyDown={(event) => keepDialogFocus(event, dialogRef.current)}
        ref={dialogRef}
        role="dialog"
      >
        <header className="preferences-header">
          <div>
            <span className="eyebrow">Local view</span>
            <h2 id="preferences-title">Workspace settings</h2>
            <p>Stored in this browser. PTYs and repositories are unchanged.</p>
          </div>
          <button aria-label="Cancel settings" onClick={onCancel} type="button">
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="preferences-sections">
            <PreferenceSection
              description="Choose calm application colors and spacing."
              title="Appearance"
            >
              <PreferenceField
                detail="System follows the browser’s operating-system preference."
                label="Theme"
              >
                <select
                  autoFocus
                  onChange={(event) =>
                    update("theme", event.target.value as ThemePreference)
                  }
                  value={draft.theme}
                >
                  <option value="system">System</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </PreferenceField>
              <PreferenceField
                detail="Comfortable adds breathing room without hiding controls."
                label="Density"
              >
                <select
                  onChange={(event) =>
                    update("density", event.target.value as DensityPreference)
                  }
                  value={draft.density}
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </select>
              </PreferenceField>
            </PreferenceSection>

            <PreferenceSection
              description="Updates every mounted terminal without restarting its PTY."
              title="Terminal"
            >
              <PreferenceField
                detail="Only fixed local font stacks are allowed."
                label="Font"
              >
                <select
                  onChange={(event) =>
                    update(
                      "terminalFont",
                      event.target.value as TerminalFontPreference,
                    )
                  }
                  value={draft.terminalFont}
                >
                  <option value="system-mono">System monospace</option>
                  <option value="cascadia">Cascadia Code first</option>
                  <option value="jetbrains">JetBrains Mono first</option>
                </select>
              </PreferenceField>
              <PreferenceField
                detail={`${TERMINAL_FONT_SIZE_MIN}–${TERMINAL_FONT_SIZE_MAX} px`}
                label="Font size"
              >
                <NumberControl
                  maximum={TERMINAL_FONT_SIZE_MAX}
                  minimum={TERMINAL_FONT_SIZE_MIN}
                  onChange={(value) => update("terminalFontSize", value)}
                  step={1}
                  suffix="px"
                  value={draft.terminalFontSize}
                />
              </PreferenceField>
              <PreferenceField
                detail={`${TERMINAL_LINE_HEIGHT_MIN.toFixed(1)}–${TERMINAL_LINE_HEIGHT_MAX.toFixed(1)}`}
                label="Line height"
              >
                <NumberControl
                  maximum={TERMINAL_LINE_HEIGHT_MAX}
                  minimum={TERMINAL_LINE_HEIGHT_MIN}
                  onChange={(value) => update("terminalLineHeight", value)}
                  step={0.05}
                  value={draft.terminalLineHeight}
                />
              </PreferenceField>
              <PreferenceField
                detail="Ephemeral lines retained by each browser terminal."
                label="Scrollback"
              >
                <NumberControl
                  maximum={TERMINAL_SCROLLBACK_MAX}
                  minimum={TERMINAL_SCROLLBACK_MIN}
                  onChange={(value) => update("terminalScrollback", value)}
                  step={500}
                  suffix="lines"
                  value={draft.terminalScrollback}
                />
              </PreferenceField>
            </PreferenceSection>

            <PreferenceSection
              description="Defaults affect new flows only."
              title="Launch and attention"
            >
              <PreferenceField
                detail="Unavailable CLIs remain visible but cannot be selected."
                label="Default launch preset"
              >
                <select
                  onChange={(event) =>
                    update(
                      "defaultLaunchPreset",
                      event.target
                        .value as WorkspacePreferences["defaultLaunchPreset"],
                    )
                  }
                  value={draft.defaultLaunchPreset}
                >
                  {launchPresets.map((preset) => (
                    <option
                      disabled={!preset.available}
                      key={preset.id}
                      value={preset.id}
                    >
                      {preset.label}
                      {preset.available ? "" : " — unavailable"}
                    </option>
                  ))}
                </select>
              </PreferenceField>
              <PreferenceField
                detail="Delivery begins when PC-032 agent-attention signals are implemented."
                label="Notifications"
              >
                <select
                  onChange={(event) =>
                    update(
                      "notifications",
                      event.target.value as NotificationPreference,
                    )
                  }
                  value={draft.notifications}
                >
                  <option value="off">Off</option>
                  <option value="attention">Important attention only</option>
                </select>
              </PreferenceField>
            </PreferenceSection>
          </div>

          <footer className="preferences-footer">
            <div>
              <button
                onClick={() => {
                  setDraft(DEFAULT_WORKSPACE_PREFERENCES);
                  setDefaultsLoaded(true);
                }}
                type="button"
              >
                Restore defaults
              </button>
              {defaultsLoaded && (
                <span role="status">Defaults loaded. Apply to save them.</span>
              )}
            </div>
            <div>
              <button onClick={onCancel} type="button">
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Apply settings
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function PreferenceSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="preference-section">
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div>{children}</div>
    </section>
  );
}

function PreferenceField({
  children,
  detail,
  label,
}: {
  children: React.ReactNode;
  detail: string;
  label: string;
}) {
  return (
    <label className="preference-field">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {children}
    </label>
  );
}

function NumberControl({
  maximum,
  minimum,
  onChange,
  step,
  suffix,
  value,
}: {
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  step: number;
  suffix?: string;
  value: number;
}) {
  return (
    <span className="preference-number">
      <input
        max={maximum}
        min={minimum}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= minimum && next <= maximum) {
            onChange(next);
          }
        }}
        step={step}
        type="number"
        value={value}
      />
      {suffix !== undefined && <small>{suffix}</small>}
    </span>
  );
}

function keepDialogFocus(
  event: KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
): void {
  if (event.key !== "Tab" || dialog === null) {
    return;
  }
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
