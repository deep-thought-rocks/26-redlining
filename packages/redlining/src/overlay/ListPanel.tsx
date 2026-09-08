import { CheckCheck, ChevronDown, ChevronRight, Eye, ScanSearch, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { describe } from '../export/changes'
import type { ReplyLine } from '../export/reply'
import type { Anchor } from '../types'
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
  onNote(id: string, note: string): void
  onRemove(id: string): void
  onClearRoute(route: string): void
  /** Discard this route's session (asks first). */
  onClear(): void
  onClose(): void
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
  onNote,
  onRemove,
  onClearRoute,
  onClear,
  onClose,
}: ListPanelProps) {
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
        <span>Annotations ({entries.length})</span>
        <span className="rl-panel-actions">
          {entries.length ? (
            <button
              type="button"
              className="rl-btn rl-icon"
              aria-label="Clear session"
              title="Discard every annotation on this route"
              onClick={onClear}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
          {entries.length ? (
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
      {verdicts.size ? (
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
      {entries.length === 0 ? (
        <p className="rl-empty">Click an element or draw a box to add one.</p>
      ) : null}
      <ol>
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
      {others.length ? (
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
