import type { Rect } from '../types'
import type { Layout } from './layout'

/** Fraction of the drawn box a container must cover to be chosen (PRD §8.4). */
const MIN_COVERAGE = 0.6

export interface Placement {
  container: Element
  /** Insert before this child; `container.children.length` means "at end". */
  childIndex: number
}

/**
 * Draw-mode container resolution (PRD §8.4): among decorated elements under
 * the box centre, the deepest whose rect covers ≥ 60 % of the box; else the
 * centre element's nearest decorated ancestor. The child index is how many
 * children lie above the box's vertical centre.
 */
export function resolveContainer(box: Rect, layout: Layout): Placement | null {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const stack = layout.elementsFromPoint(cx, cy) // top-most (deepest) first
  const decorated = stack.filter((el) => el.hasAttribute('data-rl'))
  let container: Element | null =
    decorated.find((el) => coverage(layout.rectOf(el), box) >= MIN_COVERAGE) ?? null
  if (!container) container = stack[0]?.closest('[data-rl]') ?? null
  if (!container) return null
  return { container, childIndex: childIndexFor(container, cy, layout) }
}

/** How much of `box` lies inside `rect`, 0..1. */
export function coverage(rect: Rect, box: Rect): number {
  const area = box.w * box.h
  if (area <= 0) return 0
  const w = Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x)
  const h = Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y)
  return w <= 0 || h <= 0 ? 0 : (w * h) / area
}

function childIndexFor(container: Element, cy: number, layout: Layout): number {
  const children = Array.from(container.children)
  const i = children.findIndex((child) => {
    const r = layout.rectOf(child)
    return cy < r.y + r.h / 2
  })
  return i === -1 ? children.length : i
}
