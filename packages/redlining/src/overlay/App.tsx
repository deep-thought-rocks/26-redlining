import { useCallback, useEffect, useReducer, useState } from 'react'
import { toMarkdown } from '../export'
import type { Action } from '../types'
import { pageRect } from './dom'
import { DrawLayer } from './DrawLayer'
import { ListPanel } from './ListPanel'
import { NotePopover } from './NotePopover'
import { Pins } from './Pins'
import { SelectLayer } from './SelectLayer'
import { Toolbar, type Position as Corner, type Tool } from './Toolbar'
import { isEditable, matchesHotkey } from './hotkey'
import { reduce, toSession, type Draft, type Position } from './session'
import { captureScreenshot } from './screenshot'
import { loadEntries, saveEntries } from './storage'

/** PRD §7.6: larger batches degrade agent output. */
const WARN_AT = 10

export interface AppProps {
  host: HTMLElement
  endpoint: string
  hotkey: string
  position: Corner
  maxAnnotations: number
  screenshot: boolean
}

export function App({
  host,
  endpoint,
  hotkey,
  position,
  maxAnnotations,
  screenshot: screenshotDefault,
}: AppProps) {
  const [active, setActive] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  // Session persistence per route (PRD §6): restored on first render, saved on change.
  const [entries, dispatch] = useReducer(reduce, undefined, () =>
    reduce([], {
      type: 'load',
      entries: loadEntries(window.localStorage, window.location.pathname),
    }),
  )
  const [draft, setDraft] = useState<Draft | null>(null)
  /** Move mode, step one: the element to move; the next pick is its destination. */
  const [moveSource, setMoveSource] = useState<Draft | null>(null)
  const [panel, setPanel] = useState(false)
  const [screenshot, setScreenshot] = useState(screenshotDefault)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string) => setToast(message), [])

  useEffect(() => {
    saveEntries(window.localStorage, window.location.pathname, entries)
  }, [entries])
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
      const payload = session()
      if (screenshot) {
        const shot = await captureScreenshot(entries, host)
        if ('dataUrl' in shot) payload.screenshot = shot.dataUrl
        else notify(`Saving without screenshot: ${shot.error}`)
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session: payload }),
      })
      notify(
        res.ok
          ? 'Saved — run /redline in Claude Code.'
          : `Save failed: ${res.status} ${await res.text()}`,
      )
    } catch (err) {
      notify(`Save failed: ${String(err)}`)
    }
  }, [endpoint, session, notify, screenshot, entries, host])

  const clear = useCallback(() => {
    if (entries.length === 0 || window.confirm(`Discard ${entries.length} annotation(s)?`))
      dispatch({ type: 'clear' })
  }, [entries.length])

  const reset = useCallback(() => {
    setDraft(null)
    setMoveSource(null)
  }, [])

  const toggle = useCallback(() => {
    setActive((a) => !a)
    reset()
    setPanel(false)
  }, [reset])

  const switchTool = useCallback(
    (t: Tool) => {
      setTool(t)
      reset()
    },
    [reset],
  )

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
        else if (moveSource) setMoveSource(null)
        else if (panel) setPanel(false)
        else toggle()
        return
      }
      if (isEditable(e.target) || draft) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && e.shiftKey && key === 'c') {
        e.preventDefault()
        void copy()
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        void send()
      } else if (!mod && key === 's') switchTool('select')
      else if (!mod && key === 'd') switchTool('draw')
      else if (!mod && key === 'm') switchTool('move')
      else if (!mod && key === 'l') setPanel((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, draft, moveSource, panel, hotkey, toggle, switchTool, copy, send])

  const full = entries.length >= maxAnnotations
  const fullMessage = `Session is full (${maxAnnotations}). Save it and start a new one.`

  const saveDraft = (action: Action, note: string, position?: Position) => {
    if (!draft) return
    if (full) {
      notify(fullMessage)
      return
    }
    dispatch({
      type: 'add',
      draft,
      action,
      note,
      position,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })
    reset()
    if (entries.length + 1 === WARN_AT)
      notify(`${WARN_AT} annotations — smaller batches land better. Consider saving.`)
  }

  const pick = useCallback(
    (d: Draft) => {
      if (full) {
        notify(fullMessage)
        return
      }
      if (tool !== 'move') {
        setDraft(d)
        return
      }
      if (!moveSource) {
        setMoveSource({ ...d, kind: 'move' })
        return
      }
      if (d.element === moveSource.element) return
      setDraft({ ...moveSource, target: { element: d.element, anchor: d.anchor } })
    },
    [full, fullMessage, notify, tool, moveSource],
  )

  const sourceRect = moveSource ? pageRect(moveSource.element) : null
  const picking = active && !draft

  return (
    <>
      <div className="rl-layer">
        {active ? <Pins entries={entries} /> : null}
        {sourceRect ? (
          <div
            className="rl-outline rl-outline--source"
            style={{
              left: sourceRect.x,
              top: sourceRect.y,
              width: sourceRect.w,
              height: sourceRect.h,
            }}
          />
        ) : null}
        {picking && tool === 'select' ? <SelectLayer host={host} onPick={pick} /> : null}
        {picking && tool === 'move' ? (
          <SelectLayer host={host} onPick={pick} prefix={moveSource ? 'Move to' : 'Move'} />
        ) : null}
        {picking && tool === 'draw' ? <DrawLayer host={host} onDraw={pick} /> : null}
        {draft ? <NotePopover draft={draft} onSave={saveDraft} onCancel={reset} /> : null}
      </div>
      <Toolbar
        active={active}
        tool={tool}
        count={entries.length}
        panelOpen={panel}
        screenshot={screenshot}
        position={position}
        hotkey={hotkey}
        onToggle={toggle}
        onTool={switchTool}
        onPanel={() => setPanel((p) => !p)}
        onScreenshot={() => setScreenshot((v) => !v)}
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
