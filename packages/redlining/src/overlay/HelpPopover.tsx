import { X } from 'lucide-react'
import { VERSION } from '../version'
import type { Position } from './Toolbar'

export interface HelpPopoverProps {
  position: Position
  panelOpen: boolean
  hotkey: string
  onClose(): void
}

const DOCS = 'https://redlining.deep-thought.rocks/'

const KEYS: [string, string][] = [
  ['S · D · M · T', 'Select · Draw · Move · Tweak'],
  ['[ · ] · ⌥ scroll', 'Walk up / down the ancestors'],
  ['⇧ click', 'Add an element to the open note'],
  ['L', 'Annotation list, verdicts, other routes'],
  ['Handles · ⌥ drag · ⌥⇧ drag', 'Tweak: resize · padding · margin'],
  ['Arrows · ⇧ arrows · drag', 'Tweak: nudge (exported as visual)'],
  ['⌘Z · ⌥ hover', 'Tweak: undo · measure'],
  ['Width select', 'Real device frame (375 / 768 / 1280)'],
  ['⌘⇧C · ⌘⏎', 'Copy the prompt · Save to the project'],
  ['?', 'This help'],
  ['Esc', 'Close popover → panel → overlay'],
]

/** In-package help: the keys, the loop, and where the long form lives. */
export function HelpPopover(p: HelpPopoverProps) {
  return (
    <div
      className="rl-fixed rl-settings rl-help"
      data-pos={p.position}
      data-panel={p.panelOpen || undefined}
      data-testid="rl-help"
      role="dialog"
      aria-label="Help"
    >
      <header>
        Redlining {VERSION}
        <button
          type="button"
          className="rl-btn rl-icon"
          aria-label="Close help"
          onClick={p.onClose}
        >
          <X size={16} />
        </button>
      </header>
      <p className="rl-help-lead">
        Mark up the running app; the export names file, line, element and owner for every note.
        Save, run <code>/redline</code> in Claude Code (or hand <code>.redlining/</code> to any
        agent), reopen the overlay to verify. Nothing here edits code.
      </p>
      <table className="rl-help-keys">
        <tbody>
          <tr>
            <td>
              <kbd>{p.hotkey}</kbd>
            </td>
            <td>Toggle the overlay</td>
          </tr>
          {KEYS.map(([key, what]) => (
            <tr key={key}>
              <td>
                <kbd>{key}</kbd>
              </td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rl-help-links">
        <a href={`${DOCS}guide`} target="_blank" rel="noreferrer">
          Guide
        </a>
        <a href={`${DOCS}format`} target="_blank" rel="noreferrer">
          Export format
        </a>
        <a href={`${DOCS}help`} target="_blank" rel="noreferrer">
          Troubleshooting
        </a>
      </p>
    </div>
  )
}
