import type { Rect } from '../types'

/** The only DOM geometry the resolvers read. Injected so tests can run without layout. */
export interface Layout {
  rectOf(el: Element): Rect
  elementsFromPoint(x: number, y: number): Element[]
}

export function domLayout(doc: Document): Layout {
  return {
    rectOf(el) {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    },
    elementsFromPoint(x, y) {
      return doc.elementsFromPoint(x, y)
    },
  }
}
