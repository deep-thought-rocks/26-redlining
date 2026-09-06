import { useEffect, useState } from 'react'
import type { Anchor, Rect } from '../types'
import { findByAnchor, pageRect } from './dom'
import type { Entry } from './session'

/** Numbered pins, re-attached to their elements on every scroll, resize or mutation. */
export function Pins({ entries }: { entries: Entry[] }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const bump = () => tick((n) => n + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    const mo = new MutationObserver(bump)
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-rl', 'class', 'style'],
    })
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
      mo.disconnect()
    }
  }, [])

  return (
    <>
      {entries.map((entry) => {
        const rect = liveRect(entry.element, entry.anchor)
        if (!rect) return null
        const extras = (entry.anchors ?? [])
          .slice(1)
          .map((a, i) => liveRect(entry.extraElements?.[i] ?? null, a))
        const targetRect = entry.target ? liveRect(null, entry.target) : null
        const offset = { x: entry.box?.x ?? 0, y: entry.box?.y ?? 0 }
        return (
          <span key={entry.id}>
            {entry.box ? (
              <div
                className="rl-pinbox"
                style={{
                  left: rect.x + entry.box.x,
                  top: rect.y + entry.box.y,
                  width: entry.box.w,
                  height: entry.box.h,
                }}
              />
            ) : null}
            <div
              className="rl-pin"
              data-testid="rl-pin"
              style={{ left: rect.x + offset.x, top: rect.y + offset.y }}
            >
              {entry.index}
            </div>
            {extras.map((r, i) =>
              r ? (
                <div
                  key={i}
                  className="rl-pin"
                  data-testid="rl-pin"
                  style={{ left: r.x, top: r.y }}
                >
                  {entry.index}
                </div>
              ) : null,
            )}
            {targetRect ? (
              <>
                <div
                  className="rl-pinbox"
                  style={{
                    left: targetRect.x,
                    top: targetRect.y,
                    width: targetRect.w,
                    height: targetRect.h,
                  }}
                />
                <div
                  className="rl-pin rl-pin--target"
                  style={{ left: targetRect.x, top: targetRect.y }}
                >
                  →{entry.index}
                </div>
              </>
            ) : null}
          </span>
        )
      })}
    </>
  )
}

/** The element's current page rect, re-finding it after HMR; null when it is gone. */
export function liveRect(element: Element | null, anchor: Anchor): Rect | null {
  const el = element?.isConnected ? element : findByAnchor(anchor)
  return el ? pageRect(el) : null
}
