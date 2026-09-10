import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { parseReply, toMarkdown, type ReplyLine } from '../export'
import type { Action, Change, Styling } from '../types'
import { findByAnchor, pageRect } from './dom'
import { DeviceFrame, frameWidth } from './DeviceFrame'
import { ConfirmDialog } from './ConfirmDialog'
import { DrawLayer } from './DrawLayer'
import { HelpPopover } from './HelpPopover'
import { detectFramework, FRAMEWORK_LABEL, type FrameworkKind } from './framework'
import { Inspector } from './Inspector'
import { ListPanel } from './ListPanel'
import { NotePopover } from './NotePopover'
import { Pins } from './Pins'
import { SelectLayer } from './SelectLayer'
import { SettingsPopover } from './SettingsPopover'
import { Toolbar, type Position as Corner, type Tool } from './Toolbar'
import { TweakLayer } from './TweakLayer'
import { downloadFiles, exportFiles } from './download'
import { isEditable, matchesHotkey } from './hotkey'
import { dataUrlBytes } from './image'
import { apply, remPx, reset, rootTokens, snapshot, type Snapshot } from './preview'
import { applyPreviews, removePreview, resetPreviews } from './previews'
import {
  archiveEntries,
  ARCHIVE_KEY,
  clearArchive,
  deleteArchived,
  loadArchive,
  toAnnotation,
} from './archive'
import { captureScreenshot } from './screenshot'
import { reduce, toSession, type Draft, type Entry, type Position } from './session'
import {
  clearRoute,
  loadEntries,
  loadOtherSessions,
  loadSettings,
  saveEntries,
  saveSettings,
  storageKey,
  type Settings,
} from './storage'
import type { ThemeContext } from './theme'
import { fetchLatest, markUpdateSeen, updateNotice, updateSeen } from './update'
import { verifyEntry, type Verdict } from './verify'
import { VERSION } from '../version'

const CORNERS: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
const CORNER_KEY = 'redlining:position'
const SAVED_KEY = 'redlining:saved'

/** When each route was last saved, so a newer agent reply triggers a verify on open. */
function savedAt(route: string): string | null {
  try {
    const map = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, string>
    return map[route] ?? null
  } catch {
    return null
  }
}
function markSaved(route: string): void {
  try {
    const map = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, string>
    map[route] = new Date().toISOString()
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(map))
  } catch {
    // storage unavailable: auto-verify just will not trigger
  }
}

/** PRD §7.6: larger batches degrade agent output. */
const WARN_AT = 10

export interface AppProps {
  host: HTMLElement
  endpoint: string | false
  hotkey: string
  position: Corner
  maxAnnotations: number
  screenshot: boolean
  /** Styling idiom set in code; the settings can still override it. */
  framework?: FrameworkKind
}

/** An element being tweaked: live changes previewed on the page, not yet an entry. */
interface Tweak {
  element: Element
  anchor: Draft['anchor']
  changes: Change[]
  snapshot: Snapshot
}

export function App({
  host,
  endpoint,
  hotkey,
  position,
  maxAnnotations,
  screenshot: screenshotDefault,
  framework: frameworkProp,
}: AppProps) {
  /** Inside a device frame this document IS the narrow viewport; outside, a preset opens one. */
  const framed = useMemo(() => frameWidth(), [])
  // Inside the frame the overlay opens by itself; the outer page stays the controller.
  const [active, setActive] = useState(framed !== null)
  const [tool, setTool] = useState<Tool>('select')
  // Session persistence per route (PRD §6): restored on first render, saved on change.
  const [entries, dispatch] = useReducer(reduce, undefined, () =>
    reduce([], {
      type: 'load',
      entries: loadEntries(window.localStorage, window.location.pathname),
    }),
  )
  /**
   * The route the entries in memory belong to. The overlay lives in the root layout and
   * survives client-side navigation, so the pathname can change without a remount.
   */
  const routeRef = useRef(window.location.pathname)
  /** Same value as `routeRef`, for rendering. */
  const [route, setRoute] = useState(window.location.pathname)
  const [draft, setDraft] = useState<Draft | null>(null)
  /** Move mode, step one: the element to move; the next pick is its destination. */
  const [moveSource, setMoveSource] = useState<Draft | null>(null)
  const [tweak, setTweak] = useState<Tweak | null>(null)
  const [panel, setPanel] = useState(false)
  const [screenshot, setScreenshot] = useState(screenshotDefault)
  const [beforeAfter, setBeforeAfter] = useState(false)
  const [viewport, setViewport] = useState<number | null>(null)
  // The corner is remembered per browser; the prop is the default.
  const [corner, setCorner] = useState<Corner>(() => {
    try {
      const saved = window.localStorage.getItem(CORNER_KEY) as Corner | null
      return saved && CORNERS.includes(saved) ? saved : position
    } catch {
      return position
    }
  })
  const nextCorner = useCallback(() => {
    setCorner((c) => {
      const next = CORNERS[(CORNERS.indexOf(c) + 1) % CORNERS.length]!
      try {
        window.localStorage.setItem(CORNER_KEY, next)
      } catch {
        // storage unavailable: the choice just does not persist
      }
      return next
    })
  }, [])
  const [toast, setToast] = useState<string | null>(null)
  /** A pending confirmation, shown as the overlay's own dialog. */
  const [confirm, setConfirm] = useState<{
    message: string
    action: string
    danger?: boolean
    run: () => void
  } | null>(null)
  const [routesTick, setRoutesTick] = useState(0)
  /** Verify results by entry id and the agent's reply lines by index. */
  const [verdicts, setVerdicts] = useState<Map<string, Verdict>>(() => new Map())
  const [reply, setReply] = useState<Map<number, ReplyLine>>(() => new Map())
  const [settings, setSettings] = useState<Settings>(() => loadSettings(window.localStorage))
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** The history: annotations that left a session (any route). */
  const [archive, setArchive] = useState(() => loadArchive(window.localStorage))
  /** Newest version on npm, when the check is on and answered. */
  const [latest, setLatest] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(window.localStorage, next)
  }, [])
  // The styling idiom: settings override the prop, the prop overrides the detection.
  const detected = useMemo(() => detectFramework(document), [])
  const frameworkKind: FrameworkKind =
    settings.framework !== 'auto' ? settings.framework : (frameworkProp ?? detected.kind)
  const styling: Styling = useMemo(() => {
    const override = settings.framework !== 'auto' || !!frameworkProp
    return {
      kind: frameworkKind,
      label: FRAMEWORK_LABEL[frameworkKind],
      ...(override ? {} : { evidence: detected.evidence }),
      override,
    }
  }, [settings.framework, frameworkProp, frameworkKind, detected])
  const theme: ThemeContext = useMemo(() => ({ tokens: rootTokens(), remPx: remPx() }), [])

  const notify = useCallback((message: string) => setToast(message), [])

  useEffect(() => {
    try {
      saveEntries(window.localStorage, routeRef.current, entries)
    } catch (err) {
      const message = `Browser storage is full; the session will not survive a reload (${String(err)})`
      queueMicrotask(() => notify(message))
    }
  }, [entries, notify])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Client-side navigation: swap the session for the new route instead of carrying the old
  // one along (and saving it under the new key). Detected on popstate and on any DOM change.
  const syncRoute = useCallback(() => {
    const next = window.location.pathname
    if (next === routeRef.current) return
    resetPreviews(entries)
    routeRef.current = next
    setRoute(next)
    setDraft(null)
    setMoveSource(null)
    setTweak(null)
    setVerdicts(new Map())
    setReply(new Map())
    dispatch({ type: 'load', entries: loadEntries(window.localStorage, next) })
    setRoutesTick((n) => n + 1)
  }, [entries])

  // Tweak previews are re-applied to their elements on load and after HMR replaces them.
  useEffect(() => {
    const observe = () => {
      syncRoute()
      applyPreviews(entries, true)
    }
    observe()
    const mo = new MutationObserver(observe)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('popstate', syncRoute)
    return () => {
      mo.disconnect()
      window.removeEventListener('popstate', syncRoute)
    }
  }, [entries, syncRoute])

  // Annotations made in the device frame (another document, same storage key) show up here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      setRoutesTick((n) => n + 1)
      if (e.key === ARCHIVE_KEY) setArchive(loadArchive(window.localStorage))
      if (e.key !== storageKey(window.location.pathname)) return
      dispatch({
        type: 'load',
        entries: loadEntries(window.localStorage, window.location.pathname),
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Other routes' sessions in this browser; re-read when storage changes or a route is cleared.
  const others = useMemo(
    () =>
      loadOtherSessions(window.localStorage, window.location.pathname, window.location.origin, {
        w: window.innerWidth,
        h: window.innerHeight,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storage is read, not a dependency
    [routesTick, panel],
  )
  /** Another route's session goes to the archive (nothing is deleted), then its key is removed. */
  const clearOther = useCallback((route: string) => {
    const theirs = loadEntries(window.localStorage, route)
    setArchive(archiveEntries(window.localStorage, route, theirs, 'archived'))
    clearRoute(window.localStorage, route)
    setRoutesTick((n) => n + 1)
  }, [])

  const session = useCallback(() => {
    const out = toSession(entries, window.location, { w: window.innerWidth, h: window.innerHeight })
    if (framed) out.preset = framed
    out.version = VERSION
    out.styling = styling
    if (settings.routes && others.length) out.others = others
    return out
  }, [entries, framed, styling, settings.routes, others])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(session()))
      notify('Copied prompt')
    } catch (err) {
      notify(
        `Clipboard blocked by the browser (${err instanceof Error ? err.message : String(err)}) — use Save, or copy from the list panel.`,
      )
    }
  }, [session, notify])

  /** One annotation as a complete prompt: header, styling, the block, the footer. */
  const copyOne = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id)
      if (!entry) return
      const whole = session()
      delete whole.others // one annotation, this route only
      const one = { ...whole, annotations: whole.annotations.filter((a) => a.id === id) }
      try {
        await navigator.clipboard.writeText(toMarkdown(one))
        notify(`Copied annotation ${entry.index}`)
      } catch (err) {
        notify(
          `Clipboard blocked by the browser (${err instanceof Error ? err.message : String(err)}).`,
        )
      }
    },
    [entries, session, notify],
  )

  const send = useCallback(async () => {
    try {
      const payload = session()
      if (screenshot) {
        // A failing capture must neither leave the previews reset nor abort the save.
        const capture = async () => {
          try {
            return await captureScreenshot(entries, host)
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        }
        if (beforeAfter && entries.some((e) => e.changes?.length)) {
          resetPreviews(entries)
          let before: Awaited<ReturnType<typeof capture>>
          try {
            before = await capture()
          } finally {
            applyPreviews(entries)
          }
          if ('dataUrl' in before) payload.screenshotBefore = before.dataUrl
        }
        const shot = await capture()
        if ('dataUrl' in shot) {
          payload.screenshot = shot.dataUrl
          if (Object.keys(shot.crops).length) payload.crops = shot.crops
        } else notify(`Saving without screenshot: ${shot.error}`)
      }
      // No endpoint (or none answering): hand the same files to the browser as downloads.
      const routes = [window.location.pathname, ...(payload.others ?? []).map((o) => o.route)]
      const download = (why: string) => {
        downloadFiles(exportFiles(payload))
        for (const r of routes) markSaved(r)
        notify(
          `${why}Downloaded annotations.md — move the files into .redlining/ and run /redline.`,
        )
      }
      if (endpoint === false) {
        download('')
        return
      }
      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: payload }),
        })
      } catch {
        download('No save endpoint reachable. ')
        return
      }
      if (res.status === 404) {
        download('No save endpoint at this path. ')
        return
      }
      if (res.status === 413) {
        download('The export is larger than the endpoint accepts. ')
        return
      }
      if (res.ok) for (const r of routes) markSaved(r)
      notify(
        res.ok
          ? 'Saved — run /redline, or hand .redlining/ to your agent.'
          : `Save failed: ${res.status} ${await res.text()}`,
      )
    } catch (err) {
      notify(`Save failed: ${String(err)}`)
    }
  }, [endpoint, session, notify, screenshot, beforeAfter, entries, host])

  /** Reads the agent's reply.md through the endpoint; null when there is none or no GET. */
  const fetchReply = useCallback(async (): Promise<{
    lines: ReplyLine[]
    mtime: string
  } | null> => {
    if (endpoint === false) return null
    try {
      const res = await fetch(endpoint, { method: 'GET' })
      if (!res.ok) return null
      const body = (await res.json()) as { reply: string | null; mtime: string | null }
      if (!body.reply || !body.mtime) return null
      return { lines: parseReply(body.reply), mtime: body.mtime }
    } catch {
      return null
    }
  }, [endpoint])

  /** Checks every entry against the page with its preview removed, then restores the previews. */
  const verify = useCallback(async () => {
    const got = await fetchReply()
    const route = window.location.pathname
    setReply(
      new Map(
        (got?.lines ?? []).filter((l) => !l.route || l.route === route).map((l) => [l.index, l]),
      ),
    )
    const next = new Map<string, Verdict>()
    resetPreviews(entries)
    try {
      for (const e of entries) {
        const el = e.element?.isConnected ? e.element : findByAnchor(e.anchor)
        next.set(e.id, verifyEntry(e, el))
      }
    } finally {
      applyPreviews(entries)
    }
    setVerdicts(next)
    const applied = Array.from(next.values()).filter((v) => v.state === 'applied').length
    notify(
      `${applied} of ${entries.length} applied${got ? ' · the agent replied' : ''} — see the list (L)`,
    )
  }, [entries, fetchReply, notify])

  const removeApplied = useCallback(() => {
    const done = entries.filter((e) => verdicts.get(e.id)?.state === 'applied')
    const keep = entries.filter((e) => !done.includes(e))
    resetPreviews(entries)
    applyPreviews(keep)
    setArchive(
      archiveEntries(window.localStorage, routeRef.current, done, 'applied', (e) => ({
        verdict: 'applied',
        reply: reply.get(e.index)?.text,
      })),
    )
    for (const e of done) dispatch({ type: 'remove', id: e.id })
    setVerdicts(new Map())
  }, [entries, verdicts, reply])

  /** One annotation to the archive (the row ×). */
  const archiveOne = useCallback(
    (id: string) => {
      const e = entries.find((x) => x.id === id)
      if (!e) return
      removePreview(entries, id)
      setArchive(archiveEntries(window.localStorage, routeRef.current, [e], 'archived'))
      dispatch({ type: 'remove', id })
    },
    [entries],
  )

  const restore = useCallback(
    (id: string) => {
      const item = archive.find((a) => a.id === id)
      if (!item || item.route !== routeRef.current) return
      dispatch({ type: 'restore', annotation: toAnnotation(item) })
      setArchive(deleteArchived(window.localStorage, [id]))
    },
    [archive],
  )

  const copyArchived = useCallback(
    async (id: string) => {
      const item = archive.find((a) => a.id === id)
      if (!item) return
      const whole = session()
      delete whole.others
      const one = {
        ...whole,
        route: item.route,
        annotations: [{ ...toAnnotation(item), index: 1 }],
      }
      try {
        await navigator.clipboard.writeText(toMarkdown(one))
        notify('Copied archived annotation')
      } catch (err) {
        notify(
          `Clipboard blocked by the browser (${err instanceof Error ? err.message : String(err)}).`,
        )
      }
    },
    [archive, session, notify],
  )

  // Once per opening: is there a newer redlining on npm? One toast per new version.
  useEffect(() => {
    if (!active || !settings.updates) return
    let cancelled = false
    void fetchLatest().then((version) => {
      if (cancelled || !version) return
      setLatest(version)
      const notice = updateNotice(version)
      if (notice && !updateSeen(window.localStorage, version)) {
        markUpdateSeen(window.localStorage, version)
        notify(`redlining ${notice} — npm i -D redlining@latest`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [active, settings.updates, notify])

  // A reply newer than the last save means the agent ran: verify when the overlay opens.
  useEffect(() => {
    if (!active || entries.length === 0) return
    let cancelled = false
    void fetchReply().then((got) => {
      if (cancelled || !got) return
      const last = savedAt(window.location.pathname)
      if (last && got.mtime > last) {
        setPanel(true)
        void verify()
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [active])

  const clear = useCallback(() => {
    if (entries.length === 0) return
    setConfirm({
      message: `Archive ${entries.length} annotation${entries.length === 1 ? '' : 's'} on this page?`,
      action: 'Archive',
      run: () => {
        resetPreviews(entries)
        setArchive(archiveEntries(window.localStorage, routeRef.current, entries, 'archived'))
        dispatch({ type: 'clear' })
      },
    })
  }, [entries])

  const cancelTweak = useCallback(() => {
    setTweak((t) => {
      if (t) reset(t.element)
      return null
    })
  }, [])

  const reset_ = useCallback(() => {
    setDraft(null)
    setMoveSource(null)
    cancelTweak()
  }, [cancelTweak])

  const toggle = useCallback(() => {
    setActive((a) => !a)
    reset_()
    setPanel(false)
  }, [reset_])

  const switchTool = useCallback(
    (t: Tool) => {
      setTool(t)
      reset_()
    },
    [reset_],
  )

  const setTweakChanges = useCallback((changes: Change[]) => {
    setTweak((t) => {
      if (!t) return t
      apply(t.element, changes)
      return { ...t, changes }
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchesHotkey(e, hotkey)) {
        e.preventDefault()
        toggle()
        return
      }
      if (!active || typeof e.key !== 'string') return
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        if (draft) setDraft(null)
        else if (tweak) cancelTweak()
        else if (moveSource) setMoveSource(null)
        else if (helpOpen) setHelpOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
        else if (panel) setPanel(false)
        else toggle()
        return
      }
      if (tweak && mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setTweakChanges(tweak.changes.slice(0, -1))
        return
      }
      if (isEditable(e.target) || draft) return
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
      else if (!mod && key === 't') switchTool('tweak')
      else if (!mod && key === 'l') setPanel((p) => !p)
      else if (!mod && e.key === '?') {
        setHelpOpen((h) => !h)
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    active,
    draft,
    tweak,
    moveSource,
    panel,
    settingsOpen,
    helpOpen,
    hotkey,
    toggle,
    switchTool,
    copy,
    send,
    cancelTweak,
    setTweakChanges,
  ])

  const full = entries.length >= maxAnnotations
  const fullMessage = `Session is full (${maxAnnotations}). Save it and start a new one.`

  const saveDraft = (action: Action, note: string, position?: Position, refs?: string[]) => {
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
      appliesAt: framed ?? undefined,
      refs,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })
    setDraft(null)
    setMoveSource(null)
    setTweak(null) // the entry now owns the preview
    if (entries.length + 1 === WARN_AT)
      notify(`${WARN_AT} annotations — smaller batches land better. Consider saving.`)
  }

  const pick = useCallback(
    (d: Draft) => {
      if (full) {
        notify(fullMessage)
        return
      }
      if (tool === 'tweak') {
        setTweak({
          element: d.element,
          anchor: d.anchor,
          changes: [],
          snapshot: snapshot(d.element),
        })
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

  const extend = useCallback((d: Draft) => {
    setDraft((cur) => {
      if (!cur || cur.kind !== 'select') return cur
      if (cur.element === d.element || cur.extra?.some((x) => x.element === d.element)) return cur
      return { ...cur, extra: [...(cur.extra ?? []), { element: d.element, anchor: d.anchor }] }
    })
  }, [])

  const finishTweak = () => {
    if (!tweak || tweak.changes.length === 0) return
    setDraft({
      kind: 'tweak',
      element: tweak.element,
      anchor: tweak.anchor,
      changes: tweak.changes,
      snapshot: tweak.snapshot,
    })
  }

  const sourceRect = moveSource ? pageRect(moveSource.element) : null
  const picking = active && !draft && !tweak

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
        {tweak && !draft ? (
          <TweakLayer
            host={host}
            element={tweak.element}
            changes={tweak.changes}
            onChange={setTweakChanges}
            framework={frameworkKind}
            theme={theme}
          />
        ) : null}
        {picking && (tool === 'select' || tool === 'tweak') ? (
          <SelectLayer host={host} onPick={pick} prefix={tool === 'tweak' ? 'Tweak' : undefined} />
        ) : null}
        {active && draft?.kind === 'select' && tool === 'select' ? (
          <SelectLayer host={host} onPick={pick} onExtend={extend} />
        ) : null}
        {picking && tool === 'move' ? (
          <SelectLayer host={host} onPick={pick} prefix={moveSource ? 'Move to' : 'Move'} />
        ) : null}
        {picking && tool === 'draw' ? <DrawLayer host={host} onDraw={pick} /> : null}
        {tweak && !draft ? (
          <Inspector
            element={tweak.element}
            anchor={tweak.anchor}
            changes={tweak.changes}
            onChange={setTweakChanges}
            onUndo={() => setTweakChanges(tweak.changes.slice(0, -1))}
            onReset={() => setTweakChanges([])}
            onDone={finishTweak}
            onCancel={cancelTweak}
            framework={frameworkKind}
            theme={theme}
            snapDefault={settings.snap}
          />
        ) : null}
        {draft ? (
          <NotePopover
            draft={draft}
            refBytes={dataUrlBytes(entries.flatMap((e) => e.refs ?? []))}
            onSave={saveDraft}
            onCancel={draft.kind === 'tweak' ? () => setDraft(null) : reset_}
          />
        ) : null}
      </div>
      {active && viewport && !framed ? (
        <DeviceFrame width={viewport} onClose={() => setViewport(null)} />
      ) : null}
      <Toolbar
        active={active}
        tool={tool}
        count={entries.length}
        panelOpen={panel}
        settingsOpen={settingsOpen}
        helpOpen={helpOpen}
        screenshot={screenshot}
        beforeAfter={beforeAfter}
        viewport={framed ? null : viewport}
        framed={framed}
        position={corner}
        hotkey={hotkey}
        download={endpoint === false}
        onToggle={toggle}
        onTool={switchTool}
        onPanel={() => setPanel((p) => !p)}
        onSettings={() => {
          setSettingsOpen((s) => !s)
          setHelpOpen(false)
        }}
        onHelp={() => {
          setHelpOpen((h) => !h)
          setSettingsOpen(false)
        }}
        onScreenshot={() => setScreenshot((v) => !v)}
        onBeforeAfter={() => setBeforeAfter((v) => !v)}
        onViewport={setViewport}
        onCorner={nextCorner}
        onCopy={() => void copy()}
        onSend={() => void send()}
      />
      {active && helpOpen ? (
        <HelpPopover
          position={corner}
          panelOpen={panel}
          hotkey={hotkey}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}
      {active && settingsOpen ? (
        <SettingsPopover
          settings={settings}
          detected={detected}
          fromProp={frameworkProp}
          position={corner}
          panelOpen={panel}
          latest={latest}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {active && panel ? (
        <ListPanel
          entries={entries}
          others={others.map((o) => ({ route: o.route, count: o.annotations.length }))}
          othersIncluded={settings.routes}
          onClearRoute={clearOther}
          onClear={clear}
          verdicts={verdicts}
          reply={reply}
          onVerify={() => void verify()}
          onRemoveApplied={removeApplied}
          onCopy={() => void copy()}
          onCopyOne={(id) => void copyOne(id)}
          onNote={(id, note) => dispatch({ type: 'note', id, note })}
          onRemove={archiveOne}
          archive={archive}
          route={route}
          onRestore={restore}
          onCopyArchived={(id) => void copyArchived(id)}
          onDeleteArchived={(id) => setArchive(deleteArchived(window.localStorage, [id]))}
          onDeleteArchive={() =>
            setConfirm({
              message: `Delete all ${archive.length} archived annotation${archive.length === 1 ? '' : 's'} for good?`,
              action: 'Delete',
              danger: true,
              run: () => {
                clearArchive(window.localStorage)
                setArchive([])
              },
            })
          }
          onClose={() => setPanel(false)}
        />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          message={confirm.message}
          action={confirm.action}
          danger={confirm.danger}
          onConfirm={() => {
            confirm.run()
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
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

export type { Entry }
