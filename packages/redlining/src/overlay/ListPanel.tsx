import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import type { Anchor } from '../types'
import type { Entry } from './session'

export interface ListPanelProps {
  entries: Entry[]
  onNote(id: string, note: string): void
  onRemove(id: string): void
  onClose(): void
}

export function ListPanel({ entries, onNote, onRemove, onClose }: ListPanelProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
        {entries.map((e) => {
          const open = expanded.has(e.id)
          return (
            <li
              key={e.id}
              className="rl-row"
              data-testid="rl-row"
              data-expanded={open || undefined}
            >
              <span className="rl-pin">{e.index}</span>
              <div style={{ minWidth: 0 }}>
                <button
                  type="button"
                  className="rl-row-head"
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} annotation ${e.index}`}
                  onClick={() => toggle(e.id)}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="rl-row-meta">
                    <b>{e.action}</b> · {short(e.anchor)}
                  </span>
                </button>
                {open ? (
                  <dl className="rl-row-details" data-testid="rl-row-details">
                    <Detail
                      label={
                        e.action === 'add' ? 'Container' : e.action === 'move' ? 'From' : 'Anchor'
                      }
                      anchor={e.anchor}
                    />
                    {(e.anchors ?? []).slice(1).map((a, i) => (
                      <Detail key={i} label={`Anchor ${i + 2}`} anchor={a} />
                    ))}
                    {e.target ? (
                      <Detail label={`To (${e.target.position})`} anchor={e.target} />
                    ) : null}
                    {e.box ? (
                      <>
                        <dt>Box</dt>
                        <dd>
                          {Math.round(e.box.w)} × {Math.round(e.box.h)} px
                          {e.box.childIndex !== undefined
                            ? ` · before child ${e.box.childIndex + 1}`
                            : ''}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
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
                  <div
                    className={`rl-row-note${open ? '' : ' rl-row-note--clamp'}`}
                    title="Click to edit"
                    onClick={() => setEditing(e.id)}
                  >
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
          )
        })}
      </ol>
    </aside>
  )
}

function short(a: Anchor): string {
  const owner = a.owners[a.owners.length - 1]
  const where = a.file ? `${a.file}:${a.line}` : 'unresolved'
  return `${owner ?? `<${a.tag}>`} · ${where}`
}

function Detail({ label, anchor: a }: { label: string; anchor: Anchor }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <code>&lt;{a.tag}&gt;</code> {a.file ? `${a.file}:${a.line}` : 'unresolved'}
        {a.owners.length ? <div>owners: {a.owners.join(' › ')}</div> : null}
        {a.context ? (
          <div>
            instance {a.context.index} of {a.context.count} in <code>&lt;{a.context.tag}&gt;</code>{' '}
            {a.context.file}:{a.context.line}
          </div>
        ) : null}
        {a.text ? <div className="rl-row-text">“{a.text}”</div> : null}
      </dd>
    </>
  )
}
