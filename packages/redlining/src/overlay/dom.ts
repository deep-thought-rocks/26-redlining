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

const CONTAINED = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'click',
  'focusin',
  'focusout',
]

/**
 * Pointer and focus events that start inside the overlay stop at the host. The host sits in
 * <body>, so to the page's dismiss logic (a Radix dialog's "pointer down outside", a menu's
 * document mousedown handler) a click on the toolbar would look like a click outside their
 * element and close it. Capture-phase listeners on `document` and React's delegation on the
 * shadow root run before the host and are unaffected.
 */
export function containEvents(host: Element): () => void {
  const stop = (e: Event) => e.stopPropagation()
  for (const type of CONTAINED) host.addEventListener(type, stop)
  return () => {
    for (const type of CONTAINED) host.removeEventListener(type, stop)
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')
}
