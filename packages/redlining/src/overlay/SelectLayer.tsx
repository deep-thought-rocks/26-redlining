import { useEffect, useRef, useState } from 'react'
import { anchorFor, domLayout } from '../resolve'
import { ancestorsOf, holdBodyStyle, isOverlay, pageRect } from './dom'
import type { Draft } from './session'

interface Hover {
  base: Element
  /** How many ancestors up from `base` the selection currently sits (`[` / `]`). */
  depth: number
}

function targetOf(h: Hover | null): Element | null {
  return h ? (ancestorsOf(h.base)[h.depth] ?? h.base) : null
}

export interface SelectLayerProps {
  host: Element
  onPick(draft: Draft): void
  /** Shown before the badge, e.g. "Move to" while picking a move target. */
  prefix?: string
  /** While a note is open: Shift+click adds anchors; other clicks are swallowed. */
  onExtend?(draft: Draft): void
}

export function SelectLayer({ host, onPick, prefix, onExtend }: SelectLayerProps) {
  // The ref is the source of truth (a click can follow a mousemove before React
  // commits); the state only drives rendering.
  const hoverRef = useRef<Hover | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const update = (h: Hover | null) => {
    hoverRef.current = h
    setHover(h)
  }

  useEffect(() => {
    const elementAt = (x: number, y: number): Element | null => {
      const el = document.elementFromPoint(x, y)
      return !el || isOverlay(host, el) || el === document.body || el === document.documentElement
        ? null
        : el
    }
    const move = (e: MouseEvent) => {
      const el = elementAt(e.clientX, e.clientY)
      const cur = hoverRef.current
      if (!el) update(null)
      else if (!cur || cur.base !== el) update({ base: el, depth: 0 })
    }
    const key = (e: KeyboardEvent) => {
      const cur = hoverRef.current
      if (!cur) return
      if (e.key === '[')
        update({ ...cur, depth: Math.min(cur.depth + 1, ancestorsOf(cur.base).length - 1) })
      if (e.key === ']') update({ ...cur, depth: Math.max(cur.depth - 1, 0) })
    }
    const wheel = (e: WheelEvent) => {
      // Option+scroll walks the ancestor chain, like [ and ].
      const cur = hoverRef.current
      if (!cur || !e.altKey) return
      e.preventDefault()
      const depth =
        e.deltaY < 0
          ? Math.min(cur.depth + 1, ancestorsOf(cur.base).length - 1)
          : Math.max(cur.depth - 1, 0)
      update({ ...cur, depth })
    }
    const click = (e: MouseEvent) => {
      if (isOverlay(host, e.target as Element)) return
      e.preventDefault()
      e.stopPropagation()
      let cur = hoverRef.current
      if (!cur) {
        const el = elementAt(e.clientX, e.clientY)
        if (!el) return
        cur = { base: el, depth: 0 }
      }
      const target = targetOf(cur)
      if (!target) return
      const draft: Draft = {
        kind: 'select',
        element: target,
        anchor: anchorFor(target, domLayout(document)),
      }
      if (onExtend) {
        if (e.shiftKey) onExtend(draft)
      } else {
        onPick(draft)
      }
    }
    document.addEventListener('mousemove', move, true)
    document.addEventListener('click', click, true)
    document.addEventListener('wheel', wheel, { capture: true, passive: false })
    window.addEventListener('keydown', key)
    const release = holdBodyStyle({ cursor: 'crosshair' })
    return () => {
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('wheel', wheel, { capture: true })
      window.removeEventListener('keydown', key)
      release()
    }
  }, [host, onPick, onExtend])

  const target = targetOf(hover)
  if (!target) return null
  const rect = pageRect(target)
  const anchor = anchorFor(target, domLayout(document))
  const owner = anchor.owners[anchor.owners.length - 1]
  return (
    <>
      <div
        className="rl-outline"
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
      <div
        className="rl-badge"
        style={{
          left: rect.x,
          top: rect.y - 26 < window.scrollY ? rect.y + rect.h + 4 : rect.y - 26,
        }}
      >
        {prefix ? <span>{prefix} </span> : null}
        {owner ? <b>{owner}</b> : null}
        {owner ? ' · ' : null}
        {anchor.file ? `${anchor.file}:${anchor.line}` : <span>unresolved</span>}
        <span> · &lt;{anchor.tag}&gt;</span>
      </div>
    </>
  )
}
