import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Action } from '../types'
import type { Draft } from './session'

const HINTS = ['Table', 'Form', 'Button', 'Card', 'Modal', 'Nav', 'List', 'Chart']
const WIDTH = 340

export function NotePopover({
  draft,
  onSave,
  onCancel,
}: {
  draft: Draft
  onSave(action: Action, note: string): void
  onCancel(): void
}) {
  const [action, setAction] = useState<Action>(draft.kind === 'draw' ? 'add' : 'change')
  const [note, setNote] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const save = () => {
    const text = note.trim()
    if (!text) return
    onSave(action, hint ? `${hint}: ${text}` : text)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop here: the overlay's window handler would otherwise see the same
    // keypress after React has already cleared the draft, and close the overlay.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      save()
    }
  }

  const r = draft.box ?? draft.anchor.rect
  const left = Math.max(
    8,
    Math.min(r.x + window.scrollX, window.innerWidth - WIDTH - 8 + window.scrollX),
  )
  const top = r.y + r.h + 8 + window.scrollY
  const owner = draft.anchor.owners[draft.anchor.owners.length - 1]

  return (
    <div
      className="rl-popover"
      data-testid="rl-popover"
      role="dialog"
      aria-label="Annotation"
      style={{ left, top }}
    >
      <header>
        <b>
          {draft.kind === 'draw' ? 'Add inside' : ''} {owner ?? `<${draft.anchor.tag}>`}
        </b>
        {draft.anchor.file ? `${draft.anchor.file}:${draft.anchor.line}` : 'unresolved'}
      </header>
      <div className="rl-chips">
        {draft.kind === 'select'
          ? (['change', 'remove'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className="rl-chip"
                aria-pressed={action === a}
                onClick={() => setAction(a)}
              >
                {a === 'change' ? 'Change' : 'Remove'}
              </button>
            ))
          : HINTS.map((h) => (
              <button
                key={h}
                type="button"
                className="rl-chip"
                aria-pressed={hint === h}
                onClick={() => setHint(hint === h ? null : h)}
              >
                {h}
              </button>
            ))}
      </div>
      <textarea
        ref={ref}
        className="rl-textarea"
        data-testid="rl-note"
        placeholder={draft.kind === 'draw' ? 'What goes here?' : 'What should change?'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="rl-actions">
        <span className="rl-kbd">⏎ save · ⇧⏎ newline · esc cancel</span>
        <button type="button" className="rl-action" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rl-action rl-action--primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}
