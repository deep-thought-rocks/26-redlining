import { useEffect, useRef, useState } from 'react'
import type { Change, Rect } from '../types'
import { provenance } from './cascade'
import type { FrameworkKind } from './framework'
import type { ThemeContext } from './theme'
import { holdBodyStyle, isOverlay, pageRect } from './dom'
import { suggestionFor, upsert } from './Inspector'
import { computed, isInline, relativeTo } from './preview'

export interface TweakLayerProps {
  host: Element
  element: Element
  changes: Change[]
  onChange(changes: Change[]): void
  framework: FrameworkKind
  theme: ThemeContext
}

type Edge = 'n' | 's' | 'e' | 'w'
type Handle = Edge | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSOR: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}
const SIDE: Record<Edge, string> = { n: 'top', s: 'bottom', e: 'right', w: 'left' }

interface Drag {
  kind: 'resize' | 'padding' | 'margin' | 'nudge'
  handle?: Handle
  startX: number
  startY: number
  /** Computed values when the drag started, so each move sets an absolute target. */
  base: Record<string, number>
  changes: Change[]
}

/** Parses a nudge value, "12px -4px" (the CSS translate property) or the older "translate(12px, -4px)". */
export function parseNudge(value: string | undefined): { dx: number; dy: number } {
  const m = value
    ? (/^(-?[\d.]+)px\s+(-?[\d.]+)px$/.exec(value.trim()) ??
      /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(value))
    : null
  return m ? { dx: parseFloat(m[1]!), dy: parseFloat(m[2]!) } : { dx: 0, dy: 0 }
}

/** The human form of a nudge, e.g. "+12px right, −4px up". */
export function describeNudge(dx: number, dy: number): string {
  const parts: string[] = []
  if (dx) parts.push(`${dx > 0 ? '+' : '−'}${Math.abs(dx)}px ${dx > 0 ? 'right' : 'left'}`)
  if (dy) parts.push(`${dy > 0 ? '+' : '−'}${Math.abs(dy)}px ${dy > 0 ? 'down' : 'up'}`)
  return parts.join(', ') || 'none'
}

export function nudgeChange(changes: Change[], dx: number, dy: number, from: string): Change[] {
  if (!dx && !dy) return changes.filter((c) => c.kind !== 'nudge')
  return upsert(changes, {
    kind: 'nudge',
    property: 'transform',
    from,
    to: `${dx}px ${dy}px`,
    input: describeNudge(dx, dy),
  })
}

/** Resize handles, Alt-drag spacing, body-drag nudge and arrow-key nudging around the tweaked element. */
export function TweakLayer({
  host,
  element,
  changes,
  onChange,
  framework,
  theme,
}: TweakLayerProps) {
  const [, tick] = useState(0)
  /** Alt+hover: the element measured against; a ruler, records nothing. */
  const [measure, setMeasure] = useState<Element | null>(null)
  const dragRef = useRef<Drag | null>(null)
  /** Restores the body's own cursor/user-select after a drag. */
  const releaseRef = useRef<(() => void) | null>(null)
  const changesRef = useRef(changes)
  useEffect(() => {
    changesRef.current = changes
  }, [changes])

  useEffect(() => {
    const bump = () => tick((n) => n + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
    }
  }, [])

  const styleValue = (property: string): number => {
    const c = changesRef.current.find((x) => x.kind === 'style' && x.property === property)
    return parseFloat(c ? c.to : computed(element, property)) || 0
  }
  const setStyle = (list: Change[], property: string, px: number, input: string): Change[] => {
    const value = `${Math.max(0, Math.round(px))}px`
    const base =
      changesRef.current.find((c) => c.kind === 'style' && c.property === property)?.from ??
      computed(element, property)
    const source =
      changesRef.current.find((c) => c.kind === 'style' && c.property === property)?.source ??
      provenance(element, property)
    const change: Change = { kind: 'style', property, from: base, to: value, input, source }
    if (property === 'width' || property === 'height') {
      const rel = relativeTo(element, property, parseFloat(value))
      if (rel) change.relative = rel
    }
    const suggestion = suggestionFor(element, property, value, source, framework, theme)
    if (suggestion) change.suggestion = suggestion
    return upsert(list, change)
  }

  const start = (kind: Drag['kind'], e: MouseEvent | React.MouseEvent, handle?: Handle) => {
    const base: Record<string, number> = {
      width: styleValue('width'),
      height: styleValue('height'),
    }
    for (const side of Object.values(SIDE)) {
      base[`padding-${side}`] = styleValue(`padding-${side}`)
      base[`margin-${side}`] = styleValue(`margin-${side}`)
    }
    const n = parseNudge(changesRef.current.find((c) => c.kind === 'nudge')?.to)
    base.dx = n.dx
    base.dy = n.dy
    dragRef.current = {
      kind,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      base,
      changes: changesRef.current,
    }
    releaseRef.current?.()
    releaseRef.current = holdBodyStyle({
      cursor: kind === 'nudge' ? 'move' : handle ? CURSOR[handle] : 'move',
      userSelect: 'none',
    })
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) {
        if (!e.altKey) {
          setMeasure((m) => (m ? null : m))
          return
        }
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const ok =
          el &&
          !isOverlay(host, el) &&
          el !== element &&
          !element.contains(el) &&
          el !== document.body &&
          el !== document.documentElement
        setMeasure((m) => (ok ? (m === el ? m : el) : null))
        return
      }
      e.preventDefault()
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      let list = d.changes
      if (d.kind === 'nudge') {
        const from =
          changesRef.current.find((c) => c.kind === 'nudge')?.from ??
          computed(element, 'translate') ??
          'none'
        list = nudgeChange(
          list,
          Math.round(d.base.dx! + dx),
          Math.round(d.base.dy! + dy),
          from || 'none',
        )
      } else if (d.kind === 'resize' && d.handle) {
        const h = d.handle
        if (isInline(element) && !list.some((c) => c.property === 'display')) {
          list = upsert(list, {
            kind: 'style',
            property: 'display',
            from: 'inline',
            to: 'inline-block',
          })
        }
        let w = d.base.width!
        let ht = d.base.height!
        if (h.includes('e')) w += dx
        if (h.includes('w')) w -= dx
        if (h.includes('s')) ht += dy
        if (h.includes('n')) ht -= dy
        if (e.shiftKey && h.length === 2 && d.base.width) ht = (w / d.base.width) * d.base.height!
        if (h.includes('e') || h.includes('w'))
          list = setStyle(list, 'width', w, `${Math.round(w)}`)
        if (h.includes('s') || h.includes('n') || (e.shiftKey && h.length === 2))
          list = setStyle(list, 'height', ht, `${Math.round(ht)}`)
      } else if (d.handle && d.handle.length === 1) {
        const edge = d.handle as Edge
        const prop = `${d.kind}-${SIDE[edge]}`
        // Dragging the edge outward grows the box; padding/margin follow the same direction.
        const delta = edge === 'e' ? dx : edge === 'w' ? -dx : edge === 's' ? dy : -dy
        list = setStyle(list, prop, d.base[prop]! + delta, `${Math.round(d.base[prop]! + delta)}`)
      }
      onChange(list)
    }
    const up = () => {
      if (!dragRef.current) return
      dragRef.current = null
      releaseRef.current?.()
      releaseRef.current = null
    }
    // Body drag = nudge. Capture phase, like the other layers, so the host page does not react.
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || dragRef.current) return
      const target = e.target as Element
      if (isOverlay(host, target)) return
      if (target !== element && !element.contains(target)) return
      e.preventDefault()
      e.stopPropagation()
      start('nudge', e)
    }
    const click = (e: MouseEvent) => {
      const target = e.target as Element
      if (!isOverlay(host, target) && (target === element || element.contains(target))) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const key = (e: KeyboardEvent) => {
      if (!e.key?.startsWith('Arrow')) return
      const t = e.target as HTMLElement | null
      if (t && typeof t.closest === 'function' && t.closest('input, textarea, select')) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const n = parseNudge(changesRef.current.find((c) => c.kind === 'nudge')?.to)
      const dx = n.dx + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)
      const dy = n.dy + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0)
      const from =
        changesRef.current.find((c) => c.kind === 'nudge')?.from ??
        computed(element, 'translate') ??
        'none'
      onChange(nudgeChange(changesRef.current, dx, dy, from || 'none'))
    }
    document.addEventListener('mousemove', move, true)
    document.addEventListener('mouseup', up, true)
    document.addEventListener('mousedown', down, true)
    document.addEventListener('click', click, true)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('mouseup', up, true)
      document.removeEventListener('mousedown', down, true)
      document.removeEventListener('click', click, true)
      window.removeEventListener('keydown', key)
      releaseRef.current?.()
      releaseRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, element, onChange])

  const rect = pageRect(element)
  const pos = (h: Handle) => ({
    left: rect.x + (h.includes('e') ? rect.w : h.includes('w') ? 0 : rect.w / 2),
    top: rect.y + (h.includes('s') ? rect.h : h.includes('n') ? 0 : rect.h / 2),
  })
  const nudge = parseNudge(changes.find((c) => c.kind === 'nudge')?.to)
  const gaps = measure ? gapsBetween(rect, pageRect(measure)) : []

  return (
    <>
      {measure ? (
        <div
          className="rl-outline rl-outline--measure"
          style={{
            left: pageRect(measure).x,
            top: pageRect(measure).y,
            width: pageRect(measure).w,
            height: pageRect(measure).h,
          }}
        />
      ) : null}
      {gaps.map((g, i) => (
        <div
          key={i}
          className={`rl-ruler rl-ruler--${g.axis}`}
          data-testid="rl-ruler"
          style={{
            left: g.x,
            top: g.y,
            width: g.axis === 'x' ? g.length : 0,
            height: g.axis === 'y' ? g.length : 0,
          }}
        >
          <span>{Math.round(g.length)}px</span>
        </div>
      ))}
      <div
        className="rl-outline rl-outline--tweak"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
      {HANDLES.map((h) => (
        <div
          key={h}
          className="rl-handle"
          data-handle={h}
          data-testid={`rl-handle-${h}`}
          title={
            h.length === 1
              ? 'Drag: resize · ⌥ drag: padding · ⌥⇧ drag: margin'
              : 'Drag: resize · ⇧ keeps ratio'
          }
          style={{ ...pos(h), cursor: CURSOR[h] }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const kind: Drag['kind'] =
              e.altKey && h.length === 1 ? (e.shiftKey ? 'margin' : 'padding') : 'resize'
            start(kind, e, h)
          }}
        />
      ))}
      {nudge.dx || nudge.dy ? (
        <div className="rl-badge" style={{ left: rect.x, top: rect.y + rect.h + 4 }}>
          <b>nudge</b> {describeNudge(nudge.dx, nudge.dy)} <span>· arrows move, ⇧ ×10</span>
        </div>
      ) : null}
    </>
  )
}

interface Gap {
  axis: 'x' | 'y'
  x: number
  y: number
  length: number
}

/** The horizontal and vertical distances between two rects (edge to nearest edge). */
export function gapsBetween(a: Rect, b: Rect): Gap[] {
  const gaps: Gap[] = []
  const ax2 = a.x + a.w
  const bx2 = b.x + b.w
  const ay2 = a.y + a.h
  const by2 = b.y + b.h
  const midY = (Math.max(a.y, b.y) + Math.min(ay2, by2)) / 2
  const midX = (Math.max(a.x, b.x) + Math.min(ax2, bx2)) / 2
  if (bx2 <= a.x) gaps.push({ axis: 'x', x: bx2, y: midY, length: a.x - bx2 })
  else if (b.x >= ax2) gaps.push({ axis: 'x', x: ax2, y: midY, length: b.x - ax2 })
  if (by2 <= a.y) gaps.push({ axis: 'y', x: midX, y: by2, length: a.y - by2 })
  else if (b.y >= ay2) gaps.push({ axis: 'y', x: midX, y: ay2, length: b.y - ay2 })
  return gaps
}
