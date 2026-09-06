// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Entry } from './session'
import { drawPins, pinsFor, type PinCanvas } from './screenshot'

function recorder() {
  const calls: string[] = []
  const ctx: PinCanvas = {
    beginPath: () => calls.push('beginPath'),
    arc: (x, y, r) => calls.push(`arc(${x},${y},${r})`),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillText: (t, x, y) => calls.push(`text(${t},${x},${y})`),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  }
  return { ctx, calls }
}

describe('drawPins', () => {
  test('paints a filled, stroked circle and a centred label per pin, scaled', () => {
    const { ctx, calls } = recorder()
    drawPins(
      ctx,
      [
        { label: '1', x: 10, y: 20 },
        { label: '→1', x: 30, y: 40 },
      ],
      2,
    )
    expect(calls).toEqual([
      'beginPath',
      'arc(20,40,22)',
      'fill',
      'stroke',
      'text(1,20,41)',
      'beginPath',
      'arc(60,80,22)',
      'fill',
      'stroke',
      'text(→1,60,81)',
    ])
    expect(ctx.font).toContain('22px')
    expect(ctx.lineWidth).toBe(4)
  })
})

describe('pinsFor', () => {
  test('places pins at the element, offset by a draw box, plus a target pin for moves', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b" data-rl="x.tsx:1:1"></div>'
    const a = document.getElementById('a')!
    const b = document.getElementById('b')!
    a.getBoundingClientRect = () =>
      ({ x: 10, y: 20, left: 10, top: 20, width: 100, height: 50 }) as DOMRect
    b.getBoundingClientRect = () =>
      ({ x: 300, y: 400, left: 300, top: 400, width: 10, height: 10 }) as DOMRect
    const base = { note: '', createdAt: '', selector: '', owners: [] }
    const entries: Entry[] = [
      {
        id: '1',
        index: 1,
        action: 'add',
        anchor: {
          tag: 'div',
          owners: [],
          selector: '#a',
          rect: { x: 0, y: 0, w: 0, h: 0 },
          resolved: 'selector-only',
        },
        box: { x: 5, y: 6, w: 1, h: 1 },
        element: a,
        note: base.note,
        createdAt: base.createdAt,
      },
      {
        id: '2',
        index: 2,
        action: 'move',
        anchor: {
          tag: 'div',
          owners: [],
          selector: '#a',
          rect: { x: 0, y: 0, w: 0, h: 0 },
          resolved: 'selector-only',
        },
        target: {
          tag: 'div',
          owners: [],
          selector: '#b',
          rect: { x: 0, y: 0, w: 0, h: 0 },
          resolved: 'exact',
          file: 'x.tsx',
          line: 1,
          column: 1,
          position: 'after',
        },
        element: null,
        note: base.note,
        createdAt: base.createdAt,
      },
      {
        id: '3',
        index: 3,
        action: 'change',
        anchor: {
          tag: 'p',
          owners: [],
          selector: 'p.missing',
          rect: { x: 0, y: 0, w: 0, h: 0 },
          resolved: 'selector-only',
        },
        element: null,
        note: base.note,
        createdAt: base.createdAt,
      },
    ]
    expect(pinsFor(entries)).toEqual([
      { label: '1', x: 15, y: 26 },
      { label: '2', x: 10, y: 20 },
      { label: '→2', x: 300, y: 400 },
    ])
  })
})
