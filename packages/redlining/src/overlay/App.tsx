import { useCallback, useEffect, useReducer, useState } from 'react'
import { toMarkdown } from '../export'
import type { Action } from '../types'
import { DrawLayer } from './DrawLayer'
import { ListPanel } from './ListPanel'
import { NotePopover } from './NotePopover'
import { Pins } from './Pins'
import { SelectLayer } from './SelectLayer'
import { Toolbar, type Position, type Tool } from './Toolbar'
import { isEditable, matchesHotkey } from './hotkey'
import { reduce, toSession, type Draft } from './session'

export interface AppProps {
  host: HTMLElement
  endpoint: string
  hotkey: string
  position: Position
}

export function App({ host, endpoint, hotkey, position }: AppProps) {
  const [active, setActive] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [entries, dispatch] = useReducer(reduce, [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [panel, setPanel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const session = useCallback(
    () => toSession(entries, window.location, { w: window.innerWidth, h: window.innerHeight }),
    [entries],
  )

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(toMarkdown(session()))
    notify('Copied prompt')
  }, [session, notify])

  const send = useCallback(async () => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session: session() }),
      })
      notify(
        res.ok
          ? 'Saved — run /redline in Claude Code.'
          : `Save failed: ${res.status} ${await res.text()}`,
      )
    } catch (err) {
      notify(`Save failed: ${String(err)}`)
    }
  }, [endpoint, session, notify])

  const clear = useCallback(() => {
    if (entries.length === 0 || window.confirm(`Discard ${entries.length} annotation(s)?`))
      dispatch({ type: 'clear' })
  }, [entries.length])

  const toggle = useCallback(() => {
    setActive((a) => !a)
    setDraft(null)
    setPanel(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesHotkey(e, hotkey)) {
        e.preventDefault()
        toggle()
        return
      }
      if (!active) return
      if (e.key === 'Escape') {
        if (draft) setDraft(null)
        else if (panel) setPanel(false)
        else toggle()
        return
      }
      if (isEditable(e.target) || draft) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void copy()
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        void send()
      } else if (!mod && e.key.toLowerCase() === 's') setTool('select')
      else if (!mod && e.key.toLowerCase() === 'd') setTool('draw')
      else if (!mod && e.key.toLowerCase() === 'l') setPanel((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, draft, panel, hotkey, toggle, copy, send])

  const saveDraft = (action: Action, note: string) => {
    if (!draft) return
    dispatch({
      type: 'add',
      draft,
      action,
      note,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })
    setDraft(null)
  }

  return (
    <>
      <div className="rl-layer">
        {active ? <Pins entries={entries} /> : null}
        {active && !draft && tool === 'select' ? (
          <SelectLayer host={host} onPick={setDraft} />
        ) : null}
        {active && !draft && tool === 'draw' ? <DrawLayer host={host} onDraw={setDraft} /> : null}
        {draft ? (
          <NotePopover draft={draft} onSave={saveDraft} onCancel={() => setDraft(null)} />
        ) : null}
      </div>
      <Toolbar
        active={active}
        tool={tool}
        count={entries.length}
        panelOpen={panel}
        position={position}
        hotkey={hotkey}
        onToggle={toggle}
        onTool={setTool}
        onPanel={() => setPanel((p) => !p)}
        onCopy={() => void copy()}
        onSend={() => void send()}
        onClear={clear}
      />
      {active && panel ? (
        <ListPanel
          entries={entries}
          onNote={(id, note) => dispatch({ type: 'note', id, note })}
          onRemove={(id) => dispatch({ type: 'remove', id })}
          onClose={() => setPanel(false)}
        />
      ) : null}
      {toast ? (
        <div className="rl-fixed rl-toast" role="status" data-testid="rl-toast">
          {toast}
        </div>
      ) : null}
    </>
  )
}
