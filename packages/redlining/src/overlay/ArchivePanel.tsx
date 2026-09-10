import { ArchiveRestore, ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { describe } from '../export/changes'
import type { ArchivedAnnotation } from '../types'
import { Detail, short } from './anchorText'
import { restorable } from './archive'

export interface ArchivePanelProps {
  items: ArchivedAnnotation[]
  /** The current route: only its own items can be restored here. */
  route: string
  onRestore(id: string): void
  onCopy(id: string): void
  onDelete(id: string): void
  onDeleteAll(): void
}

/** The history: everything that left a session, newest first, grouped by day. */
export function ArchivePanel({
  items,
  route,
  onRestore,
  onCopy,
  onDelete,
  onDeleteAll,
}: ArchivePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const days = new Map<string, ArchivedAnnotation[]>()
  for (const item of items) {
    const day = item.archivedAt.slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), item])
  }
  return (
    <div className="rl-archive" data-testid="rl-archive">
      {items.length === 0 ? (
        <p className="rl-empty">Nothing archived yet. The × on an annotation moves it here.</p>
      ) : null}
      <ol>
        {Array.from(days, ([day, list]) => (
          <li key={day} className="rl-archive-day">
            <h4>{day}</h4>
            <ol>
              {list.map((item) => {
                const open = expanded.has(item.id)
                const canRestore = restorable(item, route)
                return (
                  <li
                    key={item.id}
                    className="rl-row"
                    data-testid="rl-archive-row"
                    data-expanded={open || undefined}
                  >
                    <span
                      className={`rl-verdict rl-verdict--reason`}
                      data-state={item.verdict ?? item.reason}
                    >
                      {item.verdict ?? item.reason}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        className="rl-row-head"
                        aria-expanded={open}
                        aria-label={`${open ? 'Collapse' : 'Expand'} archived ${item.note.slice(0, 30)}`}
                        onClick={() => toggle(item.id)}
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="rl-row-meta">
                          <code>{item.route}</code> · <b>{item.action}</b> · {short(item.anchor)}
                        </span>
                      </button>
                      <div className={`rl-row-note${open ? '' : ' rl-row-note--clamp'}`}>
                        {item.note}
                      </div>
                      {item.reply ? (
                        <span className="rl-verdict rl-verdict--agent" data-state="done">
                          agent: {item.reply}
                        </span>
                      ) : null}
                      {open ? (
                        <dl className="rl-row-details">
                          <Detail
                            label={item.action === 'add' ? 'Container' : 'Anchor'}
                            anchor={item.anchor}
                          />
                          {item.changes?.length ? (
                            <>
                              <dt>Changes</dt>
                              <dd>
                                <ul className="rl-changes">
                                  {item.changes.map((c, i) => (
                                    <li key={i}>{describe(c)}</li>
                                  ))}
                                </ul>
                              </dd>
                            </>
                          ) : null}
                          <dt>Archived</dt>
                          <dd>{item.archivedAt.replace('T', ' ').slice(0, 16)}</dd>
                        </dl>
                      ) : null}
                    </div>
                    <span className="rl-row-actions">
                      <button
                        type="button"
                        className="rl-btn rl-icon"
                        aria-label={`Restore ${item.note.slice(0, 30)}`}
                        title={
                          canRestore
                            ? 'Put it back into this session'
                            : `Open ${item.route} to restore it`
                        }
                        disabled={!canRestore}
                        onClick={() => onRestore(item.id)}
                      >
                        <ArchiveRestore size={14} />
                      </button>
                      <button
                        type="button"
                        className="rl-btn rl-icon"
                        aria-label={`Copy archived ${item.note.slice(0, 30)}`}
                        title="Copy as its own prompt"
                        onClick={() => onCopy(item.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="rl-btn rl-icon"
                        aria-label={`Delete archived ${item.note.slice(0, 30)}`}
                        title="Delete for good"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>
      {items.length ? (
        <footer className="rl-panel-routes">
          <button type="button" className="rl-chip" onClick={onDeleteAll}>
            <Trash2 size={12} /> Delete all archived
          </button>
        </footer>
      ) : null}
    </div>
  )
}
