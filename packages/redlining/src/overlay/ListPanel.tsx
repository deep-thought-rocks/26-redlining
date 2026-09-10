import {
  Archive,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  ScanSearch,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { describe } from '../export/changes'
import type { ReplyLine } from '../export/reply'
import type { ArchivedAnnotation } from '../types'
import { Detail, short } from './anchorText'
import { ArchivePanel } from './ArchivePanel'
import type { Verdict } from './verify'
import type { Entry } from './session'

export interface ListPanelProps {
  entries: Entry[]
  /** Other routes with saved sessions in this browser; exported together when enabled. */
  others: { route: string; count: number }[]
  /** Verify results by entry id, once a check ran. */
  verdicts: Map<string, Verdict>
  /** The agent's reply lines by annotation index, when `reply.md` exists. */
  reply: Map<number, ReplyLine>
  onVerify(): void
  onRemoveApplied(): void
  /** Copy the whole prompt (same as the toolbar button). */
  onCopy(): void
  /** Copy one annotation as a self-contained prompt. */
  onCopyOne(id: string): void
  onNote(id: string, note: string): void
  /** Move one annotation to the archive. */
  onRemove(id: string): void
  onClearRoute(route: string): void
  /** Move this route's whole session to the archive (asks first). */
  onClear(): void
  onClose(): void
  /** The archive (history) and its actions. */
  archive: ArchivedAnnotation[]
  route: string
  onRestore(id: string): void
  onCopyArchived(id: string): void
  onDeleteArchived(id: string): void
  onDeleteArchive(): void
}

const VERDICT_LABEL: Record<Verdict['state'], string> = {
  applied: 'applied',
  differs: 'differs',
  missing: 'missing',
  manual: 'check by eye',
}

export function ListPanel({
  entries,
  others,
  verdicts,
  reply,
  onVerify,
  onRemoveApplied,
  onCopy,
  onCopyOne,
  onNote,
  onRemove,
  onClearRoute,
  onClear,
  onClose,
  archive,
  route,
  onRestore,
  onCopyArchived,
  onDeleteArchived,
  onDeleteArchive,
}: ListPanelProps) {
  const [archiveOpen, setArchiveOpen] = useState(false)
  const applied = entries.filter((e) => verdicts.get(e.id)?.state === 'applied').length
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
        <span>
          {archiveOpen ? `Archive (${archive.length})` : `Annotations (${entries.length})`}
        </span>
        <span className="rl-panel-actions">
          <button
            type="button"
            className="rl-btn rl-icon"
            aria-label={archiveOpen ? 'Back to the annotations' : `Archive (${archive.length})`}
            aria-pressed={archiveOpen}
            title={
              archiveOpen
                ? 'Back to the annotations'
                : 'The archive: everything that left a session'
            }
            data-testid="rl-archive-toggle"
            onClick={() => setArchiveOpen((o) => !o)}
          >
            <Archive size={16} />
            {archive.length ? <span className="rl-count">{archive.length}</span> : null}
          </button>
          {!archiveOpen && entries.length ? (
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label="Copy all annotations"
              title="Copy the whole prompt (⌘⇧C)"
              onClick={onCopy}
            >
              <Copy size={16} />
            </button>
          ) : null}
          {!archiveOpen && entries.length ? (
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label="Archive session"
              title="Move every annotation on this route to the archive"
              onClick={onClear}
            >
              <Archive size={16} />
            </button>
          ) : null}
          {!archiveOpen && entries.length ? (
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label="Verify against the page"
              title="Check each annotation against the page as it is now (after the agent's edit)"
              onClick={onVerify}
            >
              <ScanSearch size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="rl-btn rl-icon"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </span>
      </header>
      {!archiveOpen && verdicts.size ? (
        <div className="rl-panel-verify" data-testid="rl-verify-summary">
          <span>
            {applied} of {entries.length} applied
          </span>
          {applied ? (
            <button type="button" className="rl-chip" onClick={onRemoveApplied}>
              <CheckCheck size={12} /> Remove applied
            </button>
          ) : null}
        </div>
      ) : null}
      {archiveOpen ? (
        <ArchivePanel
          items={archive}
          route={route}
          onRestore={onRestore}
          onCopy={onCopyArchived}
          onDelete={onDeleteArchived}
          onDeleteAll={onDeleteArchive}
        />
      ) : null}
      {!archiveOpen && entries.length === 0 ? (
        <p className="rl-empty">Click an element or draw a box to add one.</p>
      ) : null}
      <ol hidden={archiveOpen}>
        {entries.map((e) => {
          const open = expanded.has(e.id)
          const verdict = verdicts.get(e.id)
          const said = reply.get(e.index)
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
                    <b>{e.action}</b>
                    {e.changes?.length ? ` · ≈ ${e.changes.length}` : ''} · {short(e.anchor)}
                  </span>
                </button>
                {verdict || said ? (
                  <div className="rl-verdicts">
                    {verdict ? (
                      <span
                        className="rl-verdict"
                        data-state={verdict.state}
                        data-testid="rl-verdict"
                      >
                        {verdict.state === 'manual' ? <Eye size={11} /> : null}
                        {VERDICT_LABEL[verdict.state]}
                        {verdict.details[0] && verdict.state !== 'applied'
                          ? ` · ${verdict.details[0]}`
                          : ''}
                      </span>
                    ) : null}
                    {said ? (
                      <span
                        className="rl-verdict rl-verdict--agent"
                        data-state={said.state}
                        data-testid="rl-agent"
                      >
                        agent: {said.state}
                        {said.text ? ` · ${said.text}` : ''}
                      </span>
                    ) : null}
                  </div>
                ) : null}
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
                    {e.changes?.length ? (
                      <>
                        <dt>Changes</dt>
                        <dd>
                          <ul className="rl-changes">
                            {e.changes.map((c, i) => (
                              <li key={i}>{describe(c)}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : null}
                    {verdict && verdict.details.length > 1 ? (
                      <>
                        <dt>Check</dt>
                        <dd>
                          <ul className="rl-changes">
                            {verdict.details.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : null}
                    {e.refs?.length ? (
                      <>
                        <dt>Reference</dt>
                        <dd className="rl-refs">
                          {e.refs.map((url, i) => (
                            <span key={i} className="rl-ref">
                              <img src={url} alt={`Reference ${i + 1}`} />
                            </span>
                          ))}
                        </dd>
                      </>
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
              <span className="rl-row-actions">
                <button
                  type="button"
                  className="rl-btn rl-icon"
                  aria-label={`Copy annotation ${e.index}`}
                  title="Copy this annotation as its own prompt"
                  onClick={() => onCopyOne(e.id)}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className="rl-btn rl-icon"
                  aria-label={`Archive annotation ${e.index}`}
                  title="Move to the archive"
                  onClick={() => onRemove(e.id)}
                >
                  <X size={14} />
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {!archiveOpen && others.length ? (
        <footer className="rl-panel-routes" data-testid="rl-panel-routes">
          <span>Also saved with this session</span>
          <ul>
            {others.map((o) => (
              <li key={o.route}>
                <code>{o.route}</code> ({o.count})
                <button
                  type="button"
                  className="rl-btn rl-icon"
                  aria-label={`Clear ${o.route}`}
                  onClick={() => onClearRoute(o.route)}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </aside>
  )
}
