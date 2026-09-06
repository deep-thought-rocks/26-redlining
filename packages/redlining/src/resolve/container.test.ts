// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Rect } from '../types'
import { coverage, resolveContainer } from './container'
import type { Layout } from './layout'

function layoutWith(rects: Map<Element, Rect>, stack: Element[]): Layout {
  return {
    rectOf: (el) => rects.get(el) ?? { x: 0, y: 0, w: 0, h: 0 },
    elementsFromPoint: () => stack,
  }
}

describe('coverage', () => {
  test('is the fraction of the box inside the rect', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 }
    expect(coverage({ x: 0, y: 0, w: 100, h: 100 }, box)).toBe(1)
    expect(coverage({ x: 50, y: 0, w: 100, h: 100 }, box)).toBe(0.5)
    expect(coverage({ x: 200, y: 200, w: 10, h: 10 }, box)).toBe(0)
    expect(coverage({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 0, h: 0 })).toBe(0)
  })
})

describe('resolveContainer', () => {
  document.body.innerHTML =
    '<main data-rl="app/page.tsx:3"><section data-rl="app/page.tsx:7"><input><ul></ul><footer></footer></section><aside></aside></main>'
  const main = document.querySelector('main')!
  const section = document.querySelector('section')!
  const [input, ul, footer] = Array.from(section.children)
  const aside = document.querySelector('aside')!
  const rects = new Map<Element, Rect>([
    [main, { x: 0, y: 0, w: 1000, h: 1000 }],
    [section, { x: 0, y: 0, w: 500, h: 600 }],
    [input!, { x: 0, y: 0, w: 500, h: 100 }],
    [ul!, { x: 0, y: 100, w: 500, h: 200 }],
    [footer!, { x: 0, y: 300, w: 500, h: 100 }],
    [aside, { x: 600, y: 0, w: 300, h: 300 }],
  ])

  test('picks the deepest decorated element covering ≥ 60 % of the box and places it between children', () => {
    const box = { x: 10, y: 260, w: 400, h: 80 } // centre y = 300: below ul's midpoint (200), above footer's (350)
    const r = resolveContainer(box, layoutWith(rects, [ul!, section, main]))
    expect(r).toEqual({ container: section, childIndex: 2 })
  })

  test('falls back to the outer decorated element when the deepest covers less than 60 %', () => {
    const box = { x: 300, y: 0, w: 500, h: 100 } // section covers 200/500 = 40 %, main covers all
    const r = resolveContainer(box, layoutWith(rects, [section, main]))
    expect(r!.container).toBe(main)
    expect(r!.childIndex).toBe(0) // centre y = 50 is above section's midpoint (300)
  })

  test('uses the nearest decorated ancestor of the centre element when nothing covers enough', () => {
    const box = { x: 0, y: 0, w: 2000, h: 2000 } // nothing covers 60 %
    const r = resolveContainer(box, layoutWith(rects, [aside, main]))
    expect(r!.container).toBe(main)
  })

  test('childIndex is children.length below every child, and 0 for an empty container', () => {
    const below = { x: 0, y: 500, w: 400, h: 50 }
    expect(resolveContainer(below, layoutWith(rects, [section, main]))!.childIndex).toBe(3)
    const inUl = { x: 0, y: 150, w: 400, h: 50 }
    expect(resolveContainer(inUl, layoutWith(rects, [ul!, section]))!.childIndex).toBe(1)
    const empty = document.createElement('div')
    empty.setAttribute('data-rl', 'app/x.tsx:1')
    document.body.appendChild(empty)
    const emptyRects = new Map<Element, Rect>([[empty, { x: 0, y: 0, w: 100, h: 100 }]])
    expect(
      resolveContainer({ x: 10, y: 10, w: 50, h: 50 }, layoutWith(emptyRects, [empty])),
    ).toEqual({ container: empty, childIndex: 0 })
  })

  test('returns null when there is no decorated element anywhere', () => {
    document.body.innerHTML = '<div><p></p></div>'
    const p = document.querySelector('p')!
    expect(resolveContainer({ x: 0, y: 0, w: 10, h: 10 }, layoutWith(new Map(), [p]))).toBeNull()
  })
})
