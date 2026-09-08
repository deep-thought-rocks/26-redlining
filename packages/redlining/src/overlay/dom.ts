import type { Anchor, Rect } from '../types'
import { domLayout, type Layout } from '../resolve'

/** Element rect in page coordinates (scroll included). */
export function pageRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }
}

/** `el` and its ancestors up to, excluding, <body>. */
export function ancestorsOf(el: Element): Element[] {
  const out: Element[] = []
  let cur: Element | null = el
  while (cur && cur !== document.body && cur !== document.documentElement) {
    out.push(cur)
    cur = cur.parentElement
  }
  return out
}

/** Re-finds an element after HMR: by its exact data-rl, then by selector. */
export function findByAnchor(anchor: Anchor): Element | null {
  if (anchor.resolved === 'exact' && anchor.file) {
    const value = `${anchor.file}:${anchor.line}${anchor.column === undefined ? '' : `:${anchor.column}`}`
    const hit = document.querySelector(`[data-rl="${cssEscape(value)}"]`)
    if (hit) return hit
  }
  try {
    return document.querySelector(anchor.selector)
  } catch {
    return null
  }
}

/** Sets inline body styles for an interaction and returns the restore function (exact previous values). */
export function holdBodyStyle(
  values: Partial<Record<'cursor' | 'userSelect', string>>,
): () => void {
  const body = document.body
  const previous = {
    cursor: body.style.cursor,
    userSelect: body.style.userSelect,
  }
  if (values.cursor !== undefined) body.style.cursor = values.cursor
  if (values.userSelect !== undefined) body.style.userSelect = values.userSelect
  return () => {
    body.style.cursor = previous.cursor
    body.style.userSelect = previous.userSelect
  }
}

/** Layout that ignores the overlay's own host element. */
export function layoutIgnoring(host: Element): Layout {
  const base = domLayout(document)
  return {
    rectOf: base.rectOf,
    elementsFromPoint: (x, y) =>
      base.elementsFromPoint(x, y).filter((el) => el !== host && !host.contains(el)),
  }
}

export function isOverlay(host: Element, el: Element | null): boolean {
  return !!el && (el === host || host.contains(el))
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')
}
