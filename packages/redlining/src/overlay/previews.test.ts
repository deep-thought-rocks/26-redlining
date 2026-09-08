// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Change } from '../types'
import { applyPreviews, groupByElement, removePreview, resetPreviews } from './previews'
import type { Entry } from './session'

const style = (property: string, to: string): Change => ({ kind: 'style', property, from: '', to })
const entry = (id: string, index: number, element: Element, changes: Change[]): Entry => ({
  id,
  index,
  action: 'change',
  anchor: {
    tag: 'p',
    owners: [],
    selector: 'p',
    rect: { x: 0, y: 0, w: 1, h: 1 },
    resolved: 'exact',
  },
  note: '',
  createdAt: 't',
  element,
  changes,
})

describe('previews', () => {
  test('two entries on one element compose; removing one keeps the other', () => {
    const p = document.createElement('p')
    p.style.cssText = 'color: red'
    document.body.appendChild(p)
    const a = entry('a', 1, p, [style('font-size', '20px')])
    const b = entry('b', 2, p, [style('padding-left', '8px')])
    expect(
      groupByElement([b, a])
        .get(p)
        ?.map((e) => e.id),
    ).toEqual(['a', 'b'])
    applyPreviews([b, a])
    expect(p.style.fontSize).toBe('20px')
    expect(p.style.paddingLeft).toBe('8px')
    expect(p.style.color).toBe('red')
    removePreview([a, b], 'a')
    expect(p.style.fontSize).toBe('')
    expect(p.style.paddingLeft).toBe('8px')
    resetPreviews([b])
    expect(p.style.paddingLeft).toBe('')
    expect(p.style.color).toBe('red')
  })

  test('onlyMissing skips elements that still carry their preview', () => {
    const p = document.createElement('p')
    document.body.appendChild(p)
    const a = entry('a', 1, p, [style('font-size', '20px')])
    applyPreviews([a])
    p.style.fontSize = '30px' // a later change that must not be clobbered
    applyPreviews([a], true)
    expect(p.style.fontSize).toBe('30px')
    p.removeAttribute('data-rl-preview')
    applyPreviews([a], true)
    expect(p.style.fontSize).toBe('20px')
  })
})
