import { useEffect, useState } from 'react'
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
        const el = entry.element?.isConnected ? entry.element : findByAnchor(entry.anchor)
        if (!el) return null
        const rect = pageRect(el)
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
              style={{
                left: rect.x + (entry.box ? entry.box.x : 0),
                top: rect.y + (entry.box ? entry.box.y : 0),
              }}
            >
              {entry.index}
            </div>
          </span>
        )
      })}
    </>
  )
}
