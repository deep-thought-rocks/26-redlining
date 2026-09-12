// Where a popover goes so it never covers the element it belongs to: below it, else above,
// else beside (left, then right), else clamped; always clear of the edges and of the toolbar
// corner at the bottom. Viewport coordinates in, viewport coordinates out.
import type { Rect } from '../types'

export interface Placement {
  left: number
  top: number
}

export interface PlaceOptions {
  /** Gap between the element and the popover, and to the viewport edges. Default 8. */
  margin?: number
  /** Space kept free at the bottom for the toolbar. Default 80. */
  reserveBottom?: number
}

export function placeNear(
  rect: Rect,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  { margin = 8, reserveBottom = 80 }: PlaceOptions = {},
): Placement {
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.w - size.w - margin))
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.h - reserveBottom - size.h))
  if (rect.y + rect.h + margin + size.h <= viewport.h - reserveBottom) {
    return { left: clampX(rect.x), top: rect.y + rect.h + margin }
  }
  if (rect.y - margin - size.h >= margin) {
    // An element inside the toolbar band pushes the popover further up, never over the toolbar.
    return { left: clampX(rect.x), top: clampY(rect.y - margin - size.h) }
  }
  if (rect.x - size.w - margin >= margin) {
    return { left: rect.x - size.w - margin, top: clampY(rect.y) }
  }
  if (rect.x + rect.w + margin + size.w <= viewport.w - margin) {
    return { left: rect.x + rect.w + margin, top: clampY(rect.y) }
  }
  return { left: clampX(rect.x), top: clampY(rect.y + rect.h + margin) }
}
