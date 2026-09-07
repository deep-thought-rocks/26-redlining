import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { describe } from '../export/changes'
import type { Action, Anchor } from '../types'
import type { Draft, Position } from './session'

const HINTS = ['Table', 'Form', 'Button', 'Card', 'Modal', 'Nav', 'List', 'Chart']
const POSITIONS: Position[] = ['before', 'after', 'inside']
const WIDTH = 340

export interface NotePopoverProps {
  draft: Draft
  onSave(action: Action, note: string, position?: Position): void
  onCancel(): void
}

export function NotePopover({ draft, onSave, onCancel }: NotePopoverProps) {
  const [action, setAction] = useState<Action>(
    draft.kind === 'draw' ? 'add' : draft.kind === 'move' ? 'move' : 'change',
  )
  const [position, setPosition] = useState<Position>('before')
  const [note, setNote] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])

  // A move's From/To and a tweak's changes already carry the intent; everything else needs a note.
  const noteRequired = draft.kind !== 'move' && !draft.changes?.length
  const [nudged, setNudged] = useState(false)
  const save = () => {
    const text = note.trim()
    if (!text && noteRequired) {
      setNudged(true)
      ref.current?.focus()
      return
    }
    onSave(action, hint ? `${hint}: ${text}` : text, draft.kind === 'move' ? position : undefined)
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

  const r = draft.box ?? draft.target?.anchor.rect ?? draft.anchor.rect
  const left = Math.max(
    8,
    Math.min(r.x + window.scrollX, window.innerWidth - WIDTH - 8 + window.scrollX),
  )
  const top = r.y + r.h + 8 + window.scrollY

  return (
    <div
      className="rl-popover"
      data-testid="rl-popover"
      role="dialog"
      aria-label="Annotation"
      style={{ left, top }}
    >
      <header>
        {draft.kind === 'move' && draft.target ? (
          <>
            <b>Move {label(draft.anchor)}</b> → {label(draft.target.anchor)} ·{' '}
            {where(draft.target.anchor)}
          </>
        ) : (
          <>
            <b>
              {draft.kind === 'draw' ? 'Add inside ' : ''}
              {label(draft.anchor)}
              {draft.extra?.length ? ` +${draft.extra.length}` : ''}
            </b>
            {where(draft.anchor)}
            {draft.kind === 'tweak' ? (
              <ul className="rl-changes" data-testid="rl-note-changes">
                {(draft.changes ?? []).map((c, i) => (
                  <li key={i}>{describe(c)}</li>
                ))}
              </ul>
            ) : draft.kind === 'select' && !draft.extra?.length ? (
              <span> · ⇧click adds more</span>
            ) : null}
          </>
        )}
      </header>
      <div className="rl-chips">
        {draft.kind === 'select'
          ? (['change', 'remove'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className="rl-chip"
                aria-pressed={action === a}
                onClick={() => {
                  setAction(a)
                  ref.current?.focus()
                }}
              >
                {a === 'change' ? 'Change' : 'Remove'}
              </button>
            ))
          : draft.kind === 'move'
            ? POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rl-chip"
                  aria-pressed={position === p}
                  onClick={() => {
                    setPosition(p)
                    ref.current?.focus()
                  }}
                >
                  {p}
                </button>
              ))
            : HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="rl-chip"
                  aria-pressed={hint === h}
                  onClick={() => {
                    setHint(hint === h ? null : h)
                    ref.current?.focus()
                  }}
                >
                  {h}
                </button>
              ))}
      </div>
      <textarea
        ref={ref}
        className="rl-textarea"
        data-testid="rl-note"
        placeholder={
          draft.kind === 'move'
            ? 'Optional: why move it?'
            : draft.kind === 'tweak'
              ? 'Optional: why, or anything the numbers do not say'
              : draft.kind === 'draw'
                ? 'What goes here?'
                : 'What should change?'
        }
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKey}
      />
      <div className="rl-actions">
        <span className={`rl-kbd${nudged && noteRequired && !note.trim() ? ' rl-kbd--warn' : ''}`}>
          {nudged && noteRequired && !note.trim()
            ? 'Write what should change first'
            : '⏎ save · ⇧⏎ newline · esc cancel'}
        </span>
        <button type="button" className="rl-action" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="rl-action rl-action--primary"
          data-testid="rl-note-save"
          disabled={noteRequired && !note.trim()}
          onClick={save}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function label(a: Anchor): string {
  return a.owners[a.owners.length - 1] ?? `<${a.tag}>`
}

function where(a: Anchor): string {
  return a.file ? `${a.file}:${a.line}` : 'unresolved'
}
