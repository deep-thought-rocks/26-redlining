import { ImagePlus, X } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { describe } from '../export/changes'
import type { Action, Anchor } from '../types'
import { dataUrlBytes, imageFiles, MAX_REF_BYTES, MAX_REFS, shrinkImage } from './image'
import { placeNear } from './placement'
import type { Draft, Position } from './session'

const HINTS = ['Table', 'Form', 'Button', 'Card', 'Modal', 'Nav', 'List', 'Chart']
const POSITIONS: Position[] = ['before', 'after', 'inside']
const WIDTH = 340

export interface NotePopoverProps {
  draft: Draft
  onSave(action: Action, note: string, position?: Position, refs?: string[]): void
  onCancel(): void
  /** Bytes of reference images the session already holds, for the per-session cap. */
  refBytes?: number
}

export function NotePopover({ draft, onSave, onCancel, refBytes = 0 }: NotePopoverProps) {
  const [action, setAction] = useState<Action>(
    draft.kind === 'draw' ? 'add' : draft.kind === 'move' ? 'move' : 'change',
  )
  const [position, setPosition] = useState<Position>('before')
  const [note, setNote] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [refs, setRefs] = useState<string[]>([])
  const [refHint, setRefHint] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  // Images pasted or dropped become reference images; capped per note and per session.
  const addImages = async (files: File[]) => {
    if (files.length === 0) return
    const next = [...refs]
    for (const file of files) {
      if (next.length >= MAX_REFS) {
        setRefHint(`At most ${MAX_REFS} images per note`)
        break
      }
      let url: string
      try {
        url = await shrinkImage(file)
      } catch (err) {
        setRefHint(`Could not read the image: ${String(err)}`)
        continue
      }
      if (refBytes + dataUrlBytes([...next, url]) > MAX_REF_BYTES) {
        setRefHint('Reference images would exceed what the browser session can hold')
        break
      }
      next.push(url)
    }
    setRefs(next)
    ref.current?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imageFiles(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    void addImages(files)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const files = imageFiles(e.dataTransfer)
    if (files.length === 0) return
    e.preventDefault()
    void addImages(files)
  }
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
    onSave(
      action,
      hint ? `${hint}: ${text}` : text,
      draft.kind === 'move' ? position : undefined,
      refs.length ? refs : undefined,
    )
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
  // Placed after measuring: the height depends on chips, the changes list and the thumbnails.
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(320)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // The observer reports the initial size too, and every change (chips, thumbnails, text).
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const placed = placeNear(
    r,
    { w: WIDTH, h: height },
    { w: window.innerWidth, h: window.innerHeight },
  )
  const left = placed.left + window.scrollX
  const top = placed.top + window.scrollY

  return (
    <div
      ref={box}
      className="rl-popover"
      data-testid="rl-popover"
      role="dialog"
      aria-label="Annotation"
      style={{ left, top }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
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
      <div className="rl-note-label" data-testid="rl-note-label">
        Note <span>{noteRequired ? 'required' : 'optional'}</span>
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
        onPaste={onPaste}
      />
      <div className="rl-refs" data-testid="rl-refs">
        {refs.map((url, i) => (
          <span key={i} className="rl-ref">
            <img src={url} alt={`Reference ${i + 1}`} />
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label={`Remove reference ${i + 1}`}
              onClick={() => setRefs(refs.filter((_, k) => k !== i))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <span className="rl-ref-hint">
          <ImagePlus size={12} /> {refHint ?? 'Paste or drop a mockup to attach it'}
        </span>
      </div>
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
