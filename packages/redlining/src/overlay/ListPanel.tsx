import { X } from 'lucide-react'
import { useState } from 'react'
import type { Entry } from './session'

export function ListPanel({
  entries,
  onNote,
  onRemove,
  onClose,
}: {
  entries: Entry[]
  onNote(id: string, note: string): void
  onRemove(id: string): void
  onClose(): void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <aside className="rl-fixed rl-panel" data-testid="rl-panel" aria-label="Annotations">
      <header>
        <span>Annotations ({entries.length})</span>
        <button type="button" className="rl-btn rl-icon" aria-label="Close panel" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="rl-empty">Click an element or draw a box to add one.</p>
      ) : null}
      <ol>
        {entries.map((e) => (
          <li key={e.id} className="rl-row" data-testid="rl-row">
            <span className="rl-pin">{e.index}</span>
            <div style={{ minWidth: 0 }}>
              <div className="rl-row-meta">
                <b>{e.action}</b> ·{' '}
                {e.anchor.owners.length ? e.anchor.owners.join(' › ') : `<${e.anchor.tag}>`}
                {e.anchor.file ? ` · ${e.anchor.file}:${e.anchor.line}` : ' · unresolved'}
              </div>
              {editing === e.id ? (
                <textarea
                  className="rl-textarea"
                  autoFocus
                  defaultValue={e.note}
                  onBlur={(ev) => {
                    onNote(e.id, ev.target.value.trim() || e.note)
                    setEditing(null)
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' && !ev.shiftKey) {
                      ev.preventDefault()
                      ;(ev.target as HTMLTextAreaElement).blur()
                    }
                    if (ev.key === 'Escape') {
                      ev.stopPropagation()
                      setEditing(null)
                    }
                  }}
                />
              ) : (
                <div className="rl-row-note" onClick={() => setEditing(e.id)}>
                  {e.note}
                </div>
              )}
            </div>
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label={`Delete annotation ${e.index}`}
              onClick={() => onRemove(e.id)}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
