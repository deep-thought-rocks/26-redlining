// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Change } from '../types'
import type { Entry } from './session'
import { verifyEntry } from './verify'

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 'a',
  index: 1,
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
  element: null,
  ...over,
})
const style = (property: string, to: string): Change => ({ kind: 'style', property, from: '0', to })
const reader = (values: Record<string, string>) => (_el: Element, p: string) => values[p] ?? ''

describe('verifyEntry', () => {
  test('missing elements: a remove is applied, anything else is missing', () => {
    expect(verifyEntry(entry({ action: 'remove' }), null).state).toBe('applied')
    expect(verifyEntry(entry(), null)).toEqual({
      state: 'missing',
      details: ['element not found — removed or restructured?'],
    })
  })

  test('note-only annotations are for the eye', () => {
    const el = document.createElement('p')
    expect(verifyEntry(entry(), el).state).toBe('manual')
    expect(verifyEntry(entry({ action: 'remove' }), el).details).toEqual([
      'element is still present',
    ])
  })

  test('style changes compare within half a pixel and colours by value', () => {
    const el = document.createElement('p')
    const e = entry({
      changes: [
        style('font-size', '17px'),
        style('color', 'rgb(37, 99, 235)'),
        style('font-weight', '600'),
      ],
    })
    expect(
      verifyEntry(e, el, reader({ 'font-size': '17.2px', color: '#2563eb', 'font-weight': '600' })),
    ).toEqual({ state: 'applied', details: [] })
    expect(
      verifyEntry(
        e,
        el,
        reader({ 'font-size': '15px', color: 'rgb(37, 99, 235)', 'font-weight': '600' }),
      ),
    ).toEqual({
      state: 'differs',
      details: ['font-size is 15px, expected 17px'],
    })
  })

  test('text, visibility and nudges', () => {
    const el = document.createElement('button')
    el.textContent = 'Export CSV'
    const text: Change = { kind: 'text', property: 'text', from: 'Export CSV', to: 'Download CSV' }
    expect(verifyEntry(entry({ changes: [text] }), el).details).toEqual([
      'text is "Export CSV", expected "Download CSV"',
    ])
    el.textContent = 'Download CSV'
    expect(verifyEntry(entry({ changes: [text] }), el).state).toBe('applied')
    const hide: Change = { kind: 'visibility', property: 'display', from: 'block', to: 'none' }
    expect(
      verifyEntry(entry({ changes: [hide] }), el, reader({ display: 'block' })).details,
    ).toEqual(['element is still visible'])
    const nudge: Change = {
      kind: 'nudge',
      property: 'transform',
      from: 'none',
      to: 'translate(2px, 0px)',
    }
    expect(verifyEntry(entry({ changes: [nudge] }), el).state).toBe('manual')
    expect(verifyEntry(entry({ changes: [nudge, text] }), el, reader({}))).toEqual({
      state: 'applied',
      details: ['visual nudge: check the spacing by eye'],
    })
  })
})
