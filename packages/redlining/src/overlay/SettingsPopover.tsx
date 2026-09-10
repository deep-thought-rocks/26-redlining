import { X } from 'lucide-react'
import type { Framework, FrameworkKind } from './framework'
import { FRAMEWORK_LABEL } from './framework'
import { VERSION } from '../version'
import { isNewer } from './update'
import type { Settings } from './storage'
import type { Position } from './Toolbar'

export interface SettingsPopoverProps {
  settings: Settings
  detected: Framework
  /** The `framework` prop, when the host app set one. */
  fromProp?: FrameworkKind
  position: Position
  panelOpen: boolean
  /** The newest version on npm when known; null before the check or when it is off. */
  latest: string | null
  onChange(settings: Settings): void
  onClose(): void
}

const KINDS: FrameworkKind[] = ['tailwind4', 'tailwind3', 'css-modules', 'css']

export function SettingsPopover(p: SettingsPopoverProps) {
  const { settings, detected, fromProp } = p
  const set = (patch: Partial<Settings>) => p.onChange({ ...settings, ...patch })
  const autoLabel = fromProp
    ? `${FRAMEWORK_LABEL[fromProp]} (set in code)`
    : `${FRAMEWORK_LABEL[detected.kind]} (detected)`
  return (
    <div
      className="rl-fixed rl-settings"
      data-pos={p.position}
      data-panel={p.panelOpen || undefined}
      data-testid="rl-settings"
      role="dialog"
      aria-label="Settings"
    >
      <header>
        Settings
        <button
          type="button"
          className="rl-btn rl-icon"
          aria-label="Close settings"
          onClick={p.onClose}
        >
          <X size={16} />
        </button>
      </header>
      <label className="rl-setting">
        <span>
          Styling
          <small>{fromProp ? 'From the framework prop' : detected.evidence}</small>
        </span>
        <select
          className="rl-select"
          data-testid="rl-setting-framework"
          value={settings.framework}
          onChange={(e) => set({ framework: e.target.value as Settings['framework'] })}
        >
          <option value="auto">Auto — {autoLabel}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {FRAMEWORK_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="rl-setting">
        <span>
          Snap to scale
          <small>Steppers move through the stylesheet's own classes</small>
        </span>
        <input
          type="checkbox"
          data-testid="rl-setting-snap"
          checked={settings.snap}
          onChange={(e) => set({ snap: e.target.checked })}
        />
      </label>
      <label className="rl-setting">
        <span>
          Check npm for updates
          <small>Once a day, version number only; nothing about you is sent</small>
        </span>
        <input
          type="checkbox"
          data-testid="rl-setting-updates"
          checked={settings.updates}
          onChange={(e) => set({ updates: e.target.checked })}
        />
      </label>
      <label className="rl-setting">
        <span>
          Include other routes
          <small>
            Copy and Save also carry the other routes' sessions (off: exactly what the panel shows)
          </small>
        </span>
        <input
          type="checkbox"
          data-testid="rl-setting-routes"
          checked={settings.routes}
          onChange={(e) => set({ routes: e.target.checked })}
        />
      </label>
      <p className="rl-setting rl-setting--version" data-testid="rl-version">
        <span>
          Version {VERSION}
          <small>
            {!settings.updates
              ? 'update check off'
              : p.latest === null
                ? 'latest not checked yet'
                : p.latest === VERSION || !isNewer(p.latest, VERSION)
                  ? 'up to date'
                  : `${p.latest} available — npm i -D redlining@latest (or your package manager's equivalent)`}
          </small>
        </span>
      </p>
    </div>
  )
}
