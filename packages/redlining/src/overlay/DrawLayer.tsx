import { useEffect, useState } from 'react'
import { anchorFor, resolveContainer } from '../resolve'
import type { Rect } from '../types'
import { holdBodyStyle, isOverlay, layoutIgnoring } from './dom'
import type { Draft } from './session'

const MIN_SIZE = 4

export function DrawLayer({ host, onDraw }: { host: Element; onDraw(draft: Draft): void }) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<Rect | null>(null)

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || isOverlay(host, e.target as Element)) return
      e.preventDefault()
      setStart({ x: e.clientX, y: e.clientY })
      setBox(null)
    }
    document.addEventListener('mousedown', down, true)
    const release = holdBodyStyle({ cursor: 'crosshair' })
    return () => {
      document.removeEventListener('mousedown', down, true)
      release()
    }
  }, [host])

  useEffect(() => {
    if (!start) return
    const move = (e: MouseEvent) => setBox(normalise(start, e))
    const up = (e: MouseEvent) => {
      e.preventDefault()
      const final = normalise(start, e)
      setStart(null)
      setBox(null)
      if (final.w < MIN_SIZE || final.h < MIN_SIZE) return
      const layout = layoutIgnoring(host)
      const placement = resolveContainer(final, layout)
      if (!placement) return
      onDraw({
        kind: 'draw',
        element: placement.container,
        anchor: anchorFor(placement.container, layout),
        box: { ...final, childIndex: placement.childIndex },
      })
    }
    const click = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('mousemove', move, true)
    document.addEventListener('mouseup', up, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('mouseup', up, true)
      document.removeEventListener('click', click, true)
    }
  }, [start, host, onDraw])

  if (!box) return null
  return (
    <div className="rl-drawbox" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
  )
}

function normalise(start: { x: number; y: number }, e: MouseEvent): Rect {
  return {
    x: Math.min(start.x, e.clientX),
    y: Math.min(start.y, e.clientY),
    w: Math.abs(e.clientX - start.x),
    h: Math.abs(e.clientY - start.y),
  }
}
